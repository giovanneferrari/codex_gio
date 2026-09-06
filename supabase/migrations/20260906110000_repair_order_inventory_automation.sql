-- Reinstala a automação de consumo dos pedidos sem alterar o histórico em lote.

create or replace function public.refresh_order_inventory(p_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare saved_order public.orders;
begin
  select * into saved_order from public.orders where id=p_order_id;

  -- Reverter primeiro torna a função idempotente para edições e mudanças de status.
  delete from public.inventory_movements
  where order_id=p_order_id and movement_type='order_consumption';

  if saved_order.id is null or saved_order.status <> 'Finalizado' then
    return;
  end if;

  insert into public.inventory_movements(
    inventory_item_id,order_id,event_id,movement_type,quantity_delta,
    unit_cost_snapshot,note,occurred_at,created_by
  )
  select
    recipe.inventory_item_id,p_order_id,saved_order.event_id,'order_consumption',
    -sum(recipe.quantity_per_unit*item.quantity),stock.unit_cost,
    'Consumo do pedido #'||saved_order.order_number,
    saved_order.updated_at,saved_order.created_by
  from public.order_items item
  join public.product_recipes recipe on recipe.product_id=item.product_id
  join public.inventory_items stock on stock.id=recipe.inventory_item_id
  where item.order_id=p_order_id
  group by recipe.inventory_item_id,stock.unit_cost;
end; $$;

create or replace function public.orders_refresh_inventory_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_order_inventory(new.id);
  return new;
end; $$;

create or replace function public.order_items_refresh_inventory_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_order_inventory(old.order_id);
    return old;
  end if;
  perform public.refresh_order_inventory(new.order_id);
  if tg_op='UPDATE' and old.order_id is distinct from new.order_id then
    perform public.refresh_order_inventory(old.order_id);
  end if;
  return new;
end; $$;

drop trigger if exists orders_refresh_inventory on public.orders;
create trigger orders_refresh_inventory
after update of status,event_id,operation_mode on public.orders
for each row execute function public.orders_refresh_inventory_trigger();

drop trigger if exists order_items_refresh_inventory on public.order_items;
create trigger order_items_refresh_inventory
after insert or update or delete on public.order_items
for each row execute function public.order_items_refresh_inventory_trigger();

grant execute on function public.refresh_order_inventory(uuid) to authenticated;
