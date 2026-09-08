-- Completa bancos que receberam as migrations de Agenda sem a coluna de
-- quantidade consolidada da operacao. Preserva todos os eventos existentes.

alter table public.operation_events
  add column if not exists served_quantity integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operation_events_served_quantity_check'
      and conrelid = 'public.operation_events'::regclass
  ) then
    alter table public.operation_events
      add constraint operation_events_served_quantity_check
      check (served_quantity >= 0);
  end if;
end;
$$;

notify pgrst, 'reload schema';
