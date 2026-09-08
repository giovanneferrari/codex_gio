-- Remove um compromisso finalizado da Agenda sem apagar os resultados da operacao.

create or replace function public.delete_closed_schedule_event(
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

  if linked_event.id is not null and linked_event.status<>'closed' then
    raise exception 'Encerre o evento antes de excluí-lo da Agenda.';
  end if;

  -- A FK usa on delete set null: pedidos, financeiro, estoque e o fechamento
  -- continuam registrados, mas deixam de depender do compromisso da Agenda.
  delete from public.schedule_events where id=p_schedule_event_id;

  if not found then
    raise exception 'Compromisso não encontrado.';
  end if;
end;
$$;

revoke all on function public.delete_closed_schedule_event(uuid) from public,anon;
grant execute on function public.delete_closed_schedule_event(uuid) to authenticated;

notify pgrst, 'reload schema';
