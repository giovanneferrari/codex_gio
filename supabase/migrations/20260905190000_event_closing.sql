-- RITO 2.0: fechamento consolidado dos eventos.

alter table public.operation_events
  add column if not exists served_quantity integer not null default 0
  check (served_quantity >= 0);

create or replace function public.close_operation_event(
  p_event_id uuid,
  p_served_quantity integer,
  p_manual_revenue numeric,
  p_manual_cost numeric default 0
)
returns public.operation_events
language plpgsql
security invoker
set search_path=public
as $$
declare closed_event public.operation_events;
begin
  update public.operation_events
     set status='closed',
         served_quantity=greatest(coalesce(p_served_quantity,0),0),
         manual_revenue=greatest(coalesce(p_manual_revenue,0),0),
         manual_cost=greatest(coalesce(p_manual_cost,0),0),
         ends_at=now()
   where id=p_event_id and status='active'
   returning * into closed_event;

  if closed_event.id is null then
    raise exception 'Evento ativo não encontrado.';
  end if;
  return closed_event;
end;
$$;

revoke all on function public.close_operation_event(uuid,integer,numeric,numeric) from public,anon;
grant execute on function public.close_operation_event(uuid,integer,numeric,numeric) to authenticated;

drop policy if exists "events_write" on public.operation_events;
create policy "events_write" on public.operation_events
for all to authenticated using(true) with check(true);
