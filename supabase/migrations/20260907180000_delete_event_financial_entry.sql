-- Exclui somente o lancamento financeiro originado pelo fechamento de evento.

create or replace function public.delete_event_financial_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  delete from public.financial_entries
  where id=p_entry_id and source_type='event';

  if not found then
    raise exception 'Receita de evento não encontrada.';
  end if;
end;
$$;

revoke all on function public.delete_event_financial_entry(uuid) from public,anon;
grant execute on function public.delete_event_financial_entry(uuid) to authenticated;

notify pgrst, 'reload schema';
