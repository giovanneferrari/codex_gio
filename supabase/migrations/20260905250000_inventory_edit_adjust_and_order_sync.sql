-- Edição de compras, ajustes por desperdício e garantia da baixa de pedidos.

create or replace function public.recalculate_inventory_average(p_item_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.inventory_items item set unit_cost=coalesce((
    select sum(coalesce(movement.total_cost,movement.quantity_delta*movement.unit_cost_snapshot))
      / nullif(sum(movement.quantity_delta),0)
    from public.inventory_movements movement
    where movement.inventory_item_id=p_item_id and movement.movement_type='entry'
  ),0) where item.id=p_item_id;
end; $$;

create or replace function public.save_inventory_entry(
  p_movement_id uuid,
  p_inventory_item_id uuid,
  p_package_count numeric,
  p_package_quantity numeric,
  p_purchase_unit_price numeric,
  p_occurred_at timestamptz,
  p_note text default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid; old_item_id uuid; total_quantity numeric; total_paid numeric;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem editar entradas.'; end if;
  if p_package_count<=0 or p_package_quantity<=0 or p_purchase_unit_price<0 then
    raise exception 'Os valores da entrada são inválidos.';
  end if;
  total_quantity=p_package_count*p_package_quantity;
  total_paid=p_package_count*p_purchase_unit_price;

  if p_movement_id is null then
    insert into public.inventory_movements(
      inventory_item_id,movement_type,quantity_delta,unit_cost_snapshot,total_cost,
      package_count,package_quantity,purchase_unit_price,occurred_at,note,created_by
    ) values(
      p_inventory_item_id,'entry',total_quantity,total_paid/nullif(total_quantity,0),total_paid,
      p_package_count,p_package_quantity,p_purchase_unit_price,p_occurred_at,p_note,auth.uid()
    ) returning id into saved_id;
  else
    select inventory_item_id into old_item_id from public.inventory_movements
    where id=p_movement_id and movement_type='entry';
    if old_item_id is null then raise exception 'Entrada não encontrada.'; end if;
    delete from public.financial_entries where inventory_movement_id=p_movement_id;
    update public.inventory_movements set
      inventory_item_id=p_inventory_item_id,quantity_delta=total_quantity,
      unit_cost_snapshot=total_paid/nullif(total_quantity,0),total_cost=total_paid,
      package_count=p_package_count,package_quantity=p_package_quantity,
      purchase_unit_price=p_purchase_unit_price,occurred_at=p_occurred_at,note=p_note
    where id=p_movement_id returning id into saved_id;
    if total_paid>0 then
      insert into public.financial_entries(
        entry_type,category,description,amount,occurred_on,source_type,inventory_movement_id,created_by
      ) values(
        'expense','Estoque','Compra de '||(select name from public.inventory_items where id=p_inventory_item_id),
        total_paid,p_occurred_at::date,'inventory',saved_id,auth.uid()
      );
    end if;
    perform public.recalculate_inventory_average(old_item_id);
  end if;
  perform public.recalculate_inventory_average(p_inventory_item_id);
  return saved_id;
end; $$;

create or replace function public.adjust_inventory_balance(
  p_inventory_item_id uuid,p_actual_quantity numeric,p_reason text
)
returns uuid language plpgsql security definer set search_path=public as $$
declare expected numeric; movement_id uuid; difference numeric;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  if p_actual_quantity<0 then raise exception 'O saldo não pode ser negativo.'; end if;
  select quantity_on_hand into expected from public.inventory_items
  where id=p_inventory_item_id for update;
  if expected is null then raise exception 'Insumo não encontrado.'; end if;
  difference=p_actual_quantity-expected;
  if difference=0 then return null; end if;
  insert into public.inventory_movements(
    inventory_item_id,movement_type,quantity_delta,unit_cost_snapshot,note,created_by
  ) values(
    p_inventory_item_id,case when difference<0 then 'loss' else 'adjustment' end,difference,
    (select unit_cost from public.inventory_items where id=p_inventory_item_id),
    coalesce(nullif(trim(p_reason),''),'Ajuste manual de saldo'),auth.uid()
  ) returning id into movement_id;
  return movement_id;
end; $$;

drop trigger if exists orders_refresh_inventory on public.orders;
create trigger orders_refresh_inventory
after update of status,event_id,operation_mode on public.orders
for each row execute function public.orders_refresh_inventory_trigger();

drop trigger if exists order_items_refresh_inventory on public.order_items;
create trigger order_items_refresh_inventory
after insert or update or delete on public.order_items
for each row execute function public.order_items_refresh_inventory_trigger();

revoke all on function public.save_inventory_entry(uuid,uuid,numeric,numeric,numeric,timestamptz,text) from public;
revoke all on function public.adjust_inventory_balance(uuid,numeric,text) from public;
grant execute on function public.save_inventory_entry(uuid,uuid,numeric,numeric,numeric,timestamptz,text) to authenticated;
grant execute on function public.adjust_inventory_balance(uuid,numeric,text) to authenticated;
