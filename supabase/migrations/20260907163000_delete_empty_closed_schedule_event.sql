-- Permite remover testes encerrados sem apagar historico operacional ou financeiro.

create or replace function public.delete_empty_closed_schedule_event(
  p_schedule_event_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  linked_event public.operation_events;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select operation.* into linked_event
  from public.operation_events operation
  where operation.schedule_event_id=p_schedule_event_id
  for update;

  if linked_event.id is null then
    delete from public.schedule_events where id=p_schedule_event_id;
    return;
  end if;

  if linked_event.status<>'closed' then
    raise exception 'Encerre o evento antes de excluí-lo.';
  end if;

  if coalesce(linked_event.manual_revenue,0)<>0
    or coalesce(linked_event.manual_cost,0)<>0
    or coalesce(linked_event.extra_revenue,0)<>0
    or exists(select 1 from public.orders where event_id=linked_event.id)
    or exists(select 1 from public.inventory_movements where event_id=linked_event.id)
    or exists(select 1 from public.financial_entries where event_id=linked_event.id)
  then
    raise exception 'Este evento possui pedidos, receita, custos ou estoque movimentado e deve permanecer no histórico.';
  end if;

  delete from public.operation_events where id=linked_event.id;
  delete from public.schedule_events where id=p_schedule_event_id;
end;
$$;

revoke all on function public.delete_empty_closed_schedule_event(uuid) from public,anon;
grant execute on function public.delete_empty_closed_schedule_event(uuid) to authenticated;

notify pgrst, 'reload schema';
