-- Registra a data efetiva de pagamento separadamente do vencimento e da competencia.

create or replace function public.set_inventory_entry_settlement(
  p_movement_id uuid,
  p_payment_status text,
  p_settled_on date
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem alterar pagamentos.'; end if;
  update public.financial_entries set
    payment_status=p_payment_status,
    settled_on=case when p_payment_status='settled' then p_settled_on else null end
  where inventory_movement_id=p_movement_id;
end;
$$;

create or replace function public.set_financial_entry_settlement(
  p_source_entry_id uuid,
  p_occurrence_on date,
  p_scope text,
  p_payment_status text,
  p_settled_on date
)
returns void language plpgsql security definer set search_path=public as $$
declare source_entry public.financial_entries%rowtype; target_id uuid; target_number integer;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem alterar pagamentos.'; end if;
  select * into source_entry from public.financial_entries where id=p_source_entry_id;
  if source_entry.id is null then raise exception 'Lancamento nao encontrado.'; end if;

  if source_entry.installment_group is not null then
    select id,installment_number into target_id,target_number from public.financial_entries
    where installment_group=source_entry.installment_group and occurred_on=p_occurrence_on
    order by installment_number limit 1;
    if target_id is null then target_id:=source_entry.id; target_number:=source_entry.installment_number; end if;
    update public.financial_entries entry set
      payment_status=p_payment_status,
      settled_on=case when p_payment_status='settled' then p_settled_on+(entry.installment_number-target_number)*interval '1 month' else null end
    where entry.installment_group=source_entry.installment_group
      and ((p_scope='future' and entry.installment_number>=target_number) or entry.id=target_id);
  elsif source_entry.recurring then
    if p_scope='future' and source_entry.occurred_on=p_occurrence_on then target_id:=source_entry.id;
    else
      select id into target_id from public.financial_entries
      where occurred_on=p_occurrence_on and created_by=auth.uid()
        and ((p_scope='only' and recurring=false) or (p_scope='future' and recurring=true))
      order by created_at desc limit 1;
    end if;
    update public.financial_entries set payment_status=p_payment_status,
      settled_on=case when p_payment_status='settled' then p_settled_on else null end
    where id=target_id;
  else
    update public.financial_entries set payment_status=p_payment_status,
      settled_on=case when p_payment_status='settled' then p_settled_on else null end
    where id=source_entry.id;
  end if;
end;
$$;

revoke all on function public.set_inventory_entry_settlement(uuid,text,date) from public,anon;
revoke all on function public.set_financial_entry_settlement(uuid,date,text,text,date) from public,anon;
grant execute on function public.set_inventory_entry_settlement(uuid,text,date) to authenticated;
grant execute on function public.set_financial_entry_settlement(uuid,date,text,text,date) to authenticated;
notify pgrst, 'reload schema';
