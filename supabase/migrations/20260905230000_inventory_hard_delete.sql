-- Exclusão física de insumos com preservação dos dados exibidos no histórico.

alter table public.inventory_movements
  add column if not exists inventory_item_name text,
  add column if not exists inventory_unit text;

update public.inventory_movements movement
set inventory_item_name=item.name,
    inventory_unit=item.unit
from public.inventory_items item
where movement.inventory_item_id=item.id
  and (movement.inventory_item_name is null or movement.inventory_unit is null);

create or replace function public.snapshot_inventory_movement_item()
returns trigger language plpgsql security definer set search_path=public as $$
declare saved_item public.inventory_items;
begin
  if new.inventory_item_id is not null then
    select * into saved_item from public.inventory_items where id=new.inventory_item_id;
    new.inventory_item_name=coalesce(new.inventory_item_name,saved_item.name);
    new.inventory_unit=coalesce(new.inventory_unit,saved_item.unit);
  end if;
  return new;
end; $$;

drop trigger if exists inventory_movement_snapshot_item on public.inventory_movements;
create trigger inventory_movement_snapshot_item
before insert or update of inventory_item_id on public.inventory_movements
for each row execute function public.snapshot_inventory_movement_item();

alter table public.inventory_movements
  alter column inventory_item_id drop not null,
  drop constraint if exists inventory_movements_inventory_item_id_fkey;
alter table public.inventory_movements
  add constraint inventory_movements_inventory_item_id_fkey
  foreign key (inventory_item_id) references public.inventory_items(id) on delete set null;

alter table public.stock_closing_items
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists inventory_item_name text,
  add column if not exists inventory_unit text;

update public.stock_closing_items closing_item
set inventory_item_name=item.name,
    inventory_unit=item.unit
from public.inventory_items item
where closing_item.inventory_item_id=item.id
  and (closing_item.inventory_item_name is null or closing_item.inventory_unit is null);

alter table public.stock_closing_items
  drop constraint if exists stock_closing_items_pkey,
  drop constraint if exists stock_closing_items_inventory_item_id_fkey,
  alter column inventory_item_id drop not null,
  alter column id set not null;
alter table public.stock_closing_items add primary key (id);
alter table public.stock_closing_items
  add constraint stock_closing_items_inventory_item_id_fkey
  foreign key (inventory_item_id) references public.inventory_items(id) on delete set null;

create unique index if not exists stock_closing_item_current_unique
on public.stock_closing_items(closing_id,inventory_item_id)
where inventory_item_id is not null;

create or replace function public.snapshot_stock_closing_item()
returns trigger language plpgsql security definer set search_path=public as $$
declare saved_item public.inventory_items;
begin
  if new.inventory_item_id is not null then
    select * into saved_item from public.inventory_items where id=new.inventory_item_id;
    new.inventory_item_name=coalesce(new.inventory_item_name,saved_item.name);
    new.inventory_unit=coalesce(new.inventory_unit,saved_item.unit);
  end if;
  return new;
end; $$;

drop trigger if exists stock_closing_snapshot_item on public.stock_closing_items;
create trigger stock_closing_snapshot_item
before insert or update of inventory_item_id on public.stock_closing_items
for each row execute function public.snapshot_stock_closing_item();

create or replace function public.close_stock_day(p_date date,p_notes text,p_items jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare closing_id uuid; item jsonb; expected numeric; actual numeric; stock_id uuid;
begin
  insert into public.stock_closings(closing_date,notes,closed_by)
  values(p_date,p_notes,auth.uid()) returning id into closing_id;
  for item in select * from jsonb_array_elements(p_items) loop
    stock_id=(item->>'inventory_item_id')::uuid;
    actual=(item->>'actual_quantity')::numeric;
    select quantity_on_hand into expected from public.inventory_items where id=stock_id;
    insert into public.stock_closing_items(
      closing_id,inventory_item_id,expected_quantity,actual_quantity,difference_quantity,unit_cost_snapshot
    ) values(
      closing_id,stock_id,expected,actual,actual-expected,
      (select unit_cost from public.inventory_items where id=stock_id)
    );
    if actual<>expected then
      insert into public.inventory_movements(inventory_item_id,movement_type,quantity_delta,note,created_by)
      values(stock_id,'closing',actual-expected,'Fechamento de '||p_date,auth.uid());
    end if;
  end loop;
  return closing_id;
end; $$;

create or replace function public.delete_inventory_item(p_item_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem excluir insumos.'; end if;
  if not exists(select 1 from public.inventory_items where id=p_item_id) then
    raise exception 'Insumo não encontrado.';
  end if;
  delete from public.product_recipes where inventory_item_id=p_item_id;
  delete from public.inventory_items where id=p_item_id;
end; $$;

revoke all on function public.delete_inventory_item(uuid) from public;
grant execute on function public.delete_inventory_item(uuid) to authenticated;
