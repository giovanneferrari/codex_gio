-- Restaura a aplicação automática das movimentações e reconcilia saldos
-- que possam ter ficado desatualizados enquanto o gatilho estava ausente.

create or replace function public.apply_inventory_movement()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_quantity numeric; old_cost numeric; entry_unit_cost numeric;
begin
  if tg_op = 'INSERT' then
    select quantity_on_hand,unit_cost into old_quantity,old_cost
    from public.inventory_items where id=new.inventory_item_id for update;
    entry_unit_cost=case when new.movement_type='entry' and new.quantity_delta>0
      then coalesce(new.total_cost/nullif(new.quantity_delta,0),new.unit_cost_snapshot,0)
      else old_cost end;
    update public.inventory_items set
      quantity_on_hand=quantity_on_hand+new.quantity_delta,
      unit_cost=case when new.movement_type='entry' and new.quantity_delta>0
        then ((greatest(old_quantity,0)*old_cost)+(new.quantity_delta*entry_unit_cost))
          /nullif(greatest(old_quantity,0)+new.quantity_delta,0)
        else unit_cost end,
      last_entry_at=case when new.movement_type='entry' then new.occurred_at else last_entry_at end
    where id=new.inventory_item_id;
    if new.movement_type='entry' and coalesce(new.total_cost,new.quantity_delta*entry_unit_cost)>0 then
      insert into public.financial_entries(
        entry_type,category,description,amount,occurred_on,source_type,inventory_movement_id,created_by
      ) values(
        'expense','Estoque','Compra de '||(select name from public.inventory_items where id=new.inventory_item_id),
        coalesce(new.total_cost,new.quantity_delta*entry_unit_cost),new.occurred_at::date,'inventory',new.id,new.created_by
      ) on conflict(inventory_movement_id) do nothing;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.inventory_items set quantity_on_hand=quantity_on_hand-old.quantity_delta
    where id=old.inventory_item_id;
    return old;
  else
    update public.inventory_items set quantity_on_hand=quantity_on_hand-old.quantity_delta
    where id=old.inventory_item_id;
    update public.inventory_items set quantity_on_hand=quantity_on_hand+new.quantity_delta
    where id=new.inventory_item_id;
    return new;
  end if;
end; $$;

drop trigger if exists inventory_movement_apply on public.inventory_movements;
create trigger inventory_movement_apply
after insert or update or delete on public.inventory_movements
for each row execute function public.apply_inventory_movement();

update public.inventory_items item
set quantity_on_hand=coalesce((
  select sum(movement.quantity_delta)
  from public.inventory_movements movement
  where movement.inventory_item_id=item.id
),0);
