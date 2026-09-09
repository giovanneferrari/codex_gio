-- Permite alterar a data de um lancamento e deslocar os seguintes da mesma serie.

create or replace function public.move_financial_entry_dates(
  p_source_entry_id uuid,
  p_occurrence_on date,
  p_new_occurred_on date,
  p_scope text default 'only'
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  source_entry public.financial_entries%rowtype;
  target_id uuid;
  target_number integer;
  day_shift integer:=p_new_occurred_on-p_occurrence_on;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem alterar datas.'; end if;
  if p_scope not in ('only','future') then raise exception 'Escopo de edicao invalido.'; end if;
  if p_new_occurred_on is null or p_new_occurred_on=p_occurrence_on then return; end if;

  select * into source_entry from public.financial_entries where id=p_source_entry_id;
  if source_entry.id is null or source_entry.source_type<>'manual' then
    raise exception 'Lancamento nao encontrado.';
  end if;

  if source_entry.installment_group is not null then
    select id,installment_number into target_id,target_number
    from public.financial_entries
    where installment_group=source_entry.installment_group and occurred_on=p_occurrence_on
    order by installment_number limit 1;
    if target_id is null then
      target_id:=source_entry.id;
      target_number:=source_entry.installment_number;
    end if;
    update public.financial_entries entry set
      occurred_on=entry.occurred_on+day_shift,
      competency_on=entry.competency_on+day_shift
    where entry.installment_group=source_entry.installment_group
      and ((p_scope='future' and entry.installment_number>=target_number) or entry.id=target_id);
    return;
  end if;

  if source_entry.recurring then
    if p_scope='future' and p_occurrence_on=source_entry.occurred_on then
      target_id:=source_entry.id;
    else
      select id into target_id from public.financial_entries
      where id<>source_entry.id
        and occurred_on=p_occurrence_on
        and created_by=auth.uid()
        and ((p_scope='only' and recurring=false) or (p_scope='future' and recurring=true))
      order by created_at desc limit 1;
    end if;
    if target_id is null then raise exception 'Ocorrencia editada nao encontrada.'; end if;
    update public.financial_entries set occurred_on=p_new_occurred_on,competency_on=p_new_occurred_on
    where id=target_id;
    return;
  end if;

  update public.financial_entries set occurred_on=p_new_occurred_on,competency_on=p_new_occurred_on
  where id=source_entry.id;
end;
$$;

revoke all on function public.move_financial_entry_dates(uuid,date,date,text) from public,anon;
grant execute on function public.move_financial_entry_dates(uuid,date,date,text) to authenticated;

notify pgrst, 'reload schema';
