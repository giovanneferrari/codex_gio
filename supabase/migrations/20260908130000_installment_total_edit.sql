-- Recalcula compras parceladas a partir do valor total, preservando parcelas anteriores.

create or replace function public.update_financial_installment_series(
  p_source_entry_id uuid,
  p_occurrence_on date,
  p_scope text,
  p_total_amount numeric,
  p_entry_type text,
  p_category text,
  p_description text,
  p_payment_method_type text,
  p_account_id uuid,
  p_card_id uuid,
  p_due_on date,
  p_payment_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  source_entry public.financial_entries%rowtype;
  target_entry public.financial_entries%rowtype;
  preserved_amount numeric;
  distributed_amount numeric;
  installment_value numeric;
  remainder numeric;
  affected_count integer;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem editar lancamentos.'; end if;
  if p_scope not in ('only','future') then raise exception 'Escopo de edicao invalido.'; end if;
  if p_total_amount<0 then raise exception 'O valor total nao pode ser negativo.'; end if;

  select * into source_entry from public.financial_entries where id=p_source_entry_id for update;
  if source_entry.id is null or source_entry.source_type<>'manual' or source_entry.installment_group is null then
    raise exception 'Parcelamento nao encontrado.';
  end if;
  select * into target_entry from public.financial_entries
  where installment_group=source_entry.installment_group and occurred_on=p_occurrence_on
  order by installment_number limit 1;
  if target_entry.id is null then target_entry:=source_entry; end if;

  if p_scope='future' then
    select coalesce(sum(amount),0) into preserved_amount from public.financial_entries
    where installment_group=source_entry.installment_group and installment_number<target_entry.installment_number;
    select count(*) into affected_count from public.financial_entries
    where installment_group=source_entry.installment_group and installment_number>=target_entry.installment_number;
  else
    select coalesce(sum(amount),0) into preserved_amount from public.financial_entries
    where installment_group=source_entry.installment_group and id<>target_entry.id;
    affected_count:=1;
  end if;

  distributed_amount:=p_total_amount-preserved_amount;
  if distributed_amount<0 then
    raise exception 'O novo total nao pode ser menor que o valor das parcelas preservadas (%).',preserved_amount;
  end if;
  installment_value:=round(distributed_amount/affected_count,2);
  remainder:=distributed_amount-(installment_value*affected_count);

  update public.financial_entries entry set
    entry_type=p_entry_type,
    category=p_category,
    description=p_description,
    amount=installment_value+case when entry.id=target_entry.id then remainder else 0 end,
    payment_method_type=p_payment_method_type,
    account_id=case when p_payment_method_type='direct' then p_account_id else null end,
    card_id=case when p_payment_method_type='credit_card' then p_card_id else null end,
    due_on=p_due_on+(entry.installment_number-target_entry.installment_number)*interval '1 month',
    payment_status=p_payment_status,
    settled_on=case when p_payment_status='settled' then p_due_on+(entry.installment_number-target_entry.installment_number)*interval '1 month' else null end,
    invoice_reference=case when p_payment_method_type='credit_card' then date_trunc('month',p_due_on+(entry.installment_number-target_entry.installment_number)*interval '1 month')::date else null end,
    notes=p_notes
  where entry.installment_group=source_entry.installment_group
    and ((p_scope='future' and entry.installment_number>=target_entry.installment_number) or entry.id=target_entry.id);
end;
$$;

revoke all on function public.update_financial_installment_series(uuid,date,text,numeric,text,text,text,text,uuid,uuid,date,text,text) from public,anon;
grant execute on function public.update_financial_installment_series(uuid,date,text,numeric,text,text,text,text,uuid,uuid,date,text,text) to authenticated;

notify pgrst, 'reload schema';
