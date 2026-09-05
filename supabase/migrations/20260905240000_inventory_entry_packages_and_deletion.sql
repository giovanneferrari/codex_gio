-- Entradas por embalagem e exclusão consistente de estoque/financeiro.

alter table public.inventory_movements
  add column if not exists package_count numeric(14,3),
  add column if not exists package_quantity numeric(14,3),
  add column if not exists purchase_unit_price numeric(14,2);

alter table public.inventory_movements drop constraint if exists inventory_movements_package_count_check;
alter table public.inventory_movements add constraint inventory_movements_package_count_check
  check (package_count is null or package_count > 0);
alter table public.inventory_movements drop constraint if exists inventory_movements_package_quantity_check;
alter table public.inventory_movements add constraint inventory_movements_package_quantity_check
  check (package_quantity is null or package_quantity > 0);
alter table public.inventory_movements drop constraint if exists inventory_movements_purchase_unit_price_check;
alter table public.inventory_movements add constraint inventory_movements_purchase_unit_price_check
  check (purchase_unit_price is null or purchase_unit_price >= 0);

create or replace function public.delete_inventory_entry(p_movement_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare saved_item_id uuid;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem excluir entradas.'; end if;
  if not exists(
    select 1 from public.inventory_movements
    where id=p_movement_id and movement_type='entry'
  ) then raise exception 'Entrada de estoque não encontrada.'; end if;

  select inventory_item_id into saved_item_id
  from public.inventory_movements where id=p_movement_id;
  delete from public.financial_entries where inventory_movement_id=p_movement_id;
  delete from public.inventory_movements where id=p_movement_id and movement_type='entry';
  update public.inventory_items item set unit_cost=coalesce((
    select sum(coalesce(movement.total_cost,movement.quantity_delta*movement.unit_cost_snapshot))
      / nullif(sum(movement.quantity_delta),0)
    from public.inventory_movements movement
    where movement.inventory_item_id=saved_item_id and movement.movement_type='entry'
  ),0) where item.id=saved_item_id;
end; $$;

create or replace function public.delete_inventory_item(p_item_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem excluir insumos.'; end if;
  if not exists(select 1 from public.inventory_items where id=p_item_id) then
    raise exception 'Insumo não encontrado.';
  end if;

  delete from public.financial_entries
  where inventory_movement_id in (
    select id from public.inventory_movements where inventory_item_id=p_item_id
  );
  delete from public.inventory_movements where inventory_item_id=p_item_id;
  delete from public.stock_closing_items where inventory_item_id=p_item_id;
  delete from public.product_recipes where inventory_item_id=p_item_id;
  delete from public.inventory_items where id=p_item_id;
end; $$;

revoke all on function public.delete_inventory_entry(uuid) from public;
revoke all on function public.delete_inventory_item(uuid) from public;
grant execute on function public.delete_inventory_entry(uuid) to authenticated;
grant execute on function public.delete_inventory_item(uuid) to authenticated;
