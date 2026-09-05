-- Permite consultar/registrar o fechamento várias vezes no mesmo dia.
alter table public.stock_closings
  drop constraint if exists stock_closings_closing_date_key;

create index if not exists stock_closings_date_idx
  on public.stock_closings(closing_date desc, created_at desc);

-- Exclui somente ajustes feitos pelo fechamento. O trigger existente em
-- inventory_movements devolve automaticamente a diferença ao saldo atual.
create or replace function public.delete_inventory_adjustment(p_movement_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem desfazer ajustes de fechamento.';
  end if;

  if not exists (
    select 1 from public.inventory_movements
    where id=p_movement_id and movement_type='closing'
  ) then
    raise exception 'Ajuste de fechamento não encontrado.';
  end if;

  delete from public.inventory_movements
  where id=p_movement_id and movement_type='closing';
end; $$;

revoke all on function public.delete_inventory_adjustment(uuid) from public;
grant execute on function public.delete_inventory_adjustment(uuid) to authenticated;
