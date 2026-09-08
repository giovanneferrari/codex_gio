-- Compatibilidade para clientes PWA que ainda chamam a funcao anterior.
-- A exclusao remove somente o compromisso da Agenda e preserva a operacao.

create or replace function public.delete_empty_closed_schedule_event(
  p_schedule_event_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.delete_closed_schedule_event(p_schedule_event_id);
end;
$$;

revoke all on function public.delete_empty_closed_schedule_event(uuid) from public,anon;
grant execute on function public.delete_empty_closed_schedule_event(uuid) to authenticated;

notify pgrst, 'reload schema';
