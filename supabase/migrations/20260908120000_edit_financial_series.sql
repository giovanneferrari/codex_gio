-- Edicao de um lancamento isolado ou de uma serie recorrente/parcelada.

create or replace function public.update_financial_entry_series(
  p_source_entry_id uuid,
  p_occurrence_on date,
  p_scope text,
  p_entry_type text,
  p_category text,
  p_description text,
  p_amount numeric,
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
  previous_day date:=p_occurrence_on-1;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem editar lancamentos.'; end if;
  if p_scope not in ('only','future') then raise exception 'Escopo de edicao invalido.'; end if;
  if p_amount<0 then raise exception 'O valor nao pode ser negativo.'; end if;

  select * into source_entry from public.financial_entries where id=p_source_entry_id for update;
  if source_entry.id is null or source_entry.source_type<>'manual' then
    raise exception 'Este lancamento nao pode ser editado por este fluxo.';
  end if;

  if source_entry.installment_group is not null then
    select * into target_entry from public.financial_entries
    where installment_group=source_entry.installment_group and occurred_on=p_occurrence_on
    order by installment_number limit 1;
    if target_entry.id is null then target_entry:=source_entry; end if;

    update public.financial_entries entry set
      entry_type=p_entry_type,
      category=p_category,
      description=p_description,
      amount=p_amount,
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
    return;
  end if;

  if source_entry.recurring then
    if p_occurrence_on=source_entry.occurred_on and p_scope='future' then
      update public.financial_entries set
        entry_type=p_entry_type,category=p_category,description=p_description,amount=p_amount,
        payment_method_type=p_payment_method_type,
        account_id=case when p_payment_method_type='direct' then p_account_id else null end,
        card_id=case when p_payment_method_type='credit_card' then p_card_id else null end,
        due_on=p_due_on,payment_status=p_payment_status,
        settled_on=case when p_payment_status='settled' then p_due_on else null end,
        invoice_reference=case when p_payment_method_type='credit_card' then date_trunc('month',p_due_on)::date else null end,
        notes=p_notes
      where id=source_entry.id;
      return;
    end if;

    insert into public.financial_recurrence_exceptions(source_entry_id,excluded_on,created_by)
    values(source_entry.id,p_occurrence_on,auth.uid()) on conflict(source_entry_id,excluded_on) do nothing;

    if p_scope='future' then
      update public.financial_entries set recurrence_until=previous_day where id=source_entry.id;
    end if;

    insert into public.financial_entries(
      entry_type,category,description,amount,occurred_on,competency_on,recurring,
      recurrence_frequency,recurrence_until,source_type,notes,created_by,
      payment_method_type,account_id,card_id,due_on,payment_status,settled_on,invoice_reference
    ) values(
      p_entry_type,p_category,p_description,p_amount,p_occurrence_on,p_occurrence_on,p_scope='future',
      case when p_scope='future' then source_entry.recurrence_frequency else null end,
      case when p_scope='future' then source_entry.recurrence_until else null end,
      'manual',p_notes,auth.uid(),p_payment_method_type,
      case when p_payment_method_type='direct' then p_account_id else null end,
      case when p_payment_method_type='credit_card' then p_card_id else null end,
      p_due_on,p_payment_status,case when p_payment_status='settled' then p_due_on else null end,
      case when p_payment_method_type='credit_card' then date_trunc('month',p_due_on)::date else null end
    );
    return;
  end if;

  update public.financial_entries set
    entry_type=p_entry_type,category=p_category,description=p_description,amount=p_amount,
    occurred_on=p_occurrence_on,competency_on=p_occurrence_on,
    payment_method_type=p_payment_method_type,
    account_id=case when p_payment_method_type='direct' then p_account_id else null end,
    card_id=case when p_payment_method_type='credit_card' then p_card_id else null end,
    due_on=p_due_on,payment_status=p_payment_status,
    settled_on=case when p_payment_status='settled' then p_due_on else null end,
    invoice_reference=case when p_payment_method_type='credit_card' then date_trunc('month',p_due_on)::date else null end,
    notes=p_notes
  where id=source_entry.id;
end;
$$;

revoke all on function public.update_financial_entry_series(uuid,date,text,text,text,text,numeric,text,uuid,uuid,date,text,text) from public,anon;
grant execute on function public.update_financial_entry_series(uuid,date,text,text,text,text,numeric,text,uuid,uuid,date,text,text) to authenticated;

notify pgrst, 'reload schema';
