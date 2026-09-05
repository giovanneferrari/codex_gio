-- RITO 2.0: estoque, receitas técnicas, eventos e fechamento diário.

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'Insumos',
  unit text not null check (unit in ('g','kg','ml','l','un')),
  quantity_on_hand numeric(14,3) not null default 0,
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity >= 0),
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  active boolean not null default true,
  last_entry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_recipes (
  product_id uuid not null references public.products(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity_per_unit numeric(14,3) not null check (quantity_per_unit > 0),
  primary key (product_id, inventory_item_id)
);

create table if not exists public.operation_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active','closed')),
  contracted_quantity integer check (contracted_quantity is null or contracted_quantity >= 0),
  manual_revenue numeric(14,2) not null default 0 check (manual_revenue >= 0),
  manual_cost numeric(14,2) not null default 0 check (manual_cost >= 0),
  allow_negative_stock boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists operation_mode text not null default 'service';
alter table public.orders drop constraint if exists orders_operation_mode_check;
alter table public.orders add constraint orders_operation_mode_check check (operation_mode in ('service','event'));
alter table public.orders add column if not exists event_id uuid references public.operation_events(id) on delete set null;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  order_id uuid references public.orders(id) on delete cascade,
  event_id uuid references public.operation_events(id) on delete set null,
  movement_type text not null check (movement_type in ('entry','order_consumption','loss','adjustment','closing')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  unit_cost_snapshot numeric(14,4) not null default 0,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists inventory_order_consumption_unique
on public.inventory_movements(order_id, inventory_item_id)
where movement_type = 'order_consumption';

create table if not exists public.stock_closings (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null unique,
  notes text,
  closed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_closing_items (
  closing_id uuid not null references public.stock_closings(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  expected_quantity numeric(14,3) not null,
  actual_quantity numeric(14,3) not null,
  difference_quantity numeric(14,3) not null,
  unit_cost_snapshot numeric(14,4) not null,
  primary key (closing_id, inventory_item_id)
);

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at before update on public.inventory_items
for each row execute function public.set_updated_at();
drop trigger if exists operation_events_set_updated_at on public.operation_events;
create trigger operation_events_set_updated_at before update on public.operation_events
for each row execute function public.set_updated_at();

create or replace function public.apply_inventory_movement()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op = 'INSERT' then
    update public.inventory_items set quantity_on_hand=quantity_on_hand+new.quantity_delta,
      last_entry_at=case when new.movement_type='entry' then new.occurred_at else last_entry_at end
    where id=new.inventory_item_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.inventory_items set quantity_on_hand=quantity_on_hand-old.quantity_delta where id=old.inventory_item_id;
    return old;
  else
    update public.inventory_items set quantity_on_hand=quantity_on_hand-old.quantity_delta where id=old.inventory_item_id;
    update public.inventory_items set quantity_on_hand=quantity_on_hand+new.quantity_delta where id=new.inventory_item_id;
    return new;
  end if;
end; $$;

drop trigger if exists inventory_movement_apply on public.inventory_movements;
create trigger inventory_movement_apply after insert or update or delete on public.inventory_movements
for each row execute function public.apply_inventory_movement();

create or replace function public.refresh_order_inventory(p_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare saved_order public.orders;
begin
  select * into saved_order from public.orders where id=p_order_id;
  delete from public.inventory_movements where order_id=p_order_id and movement_type='order_consumption';
  if saved_order.id is null or saved_order.status <> 'Finalizado' then return; end if;
  insert into public.inventory_movements(inventory_item_id,order_id,event_id,movement_type,quantity_delta,unit_cost_snapshot,note,occurred_at,created_by)
  select recipe.inventory_item_id,p_order_id,saved_order.event_id,'order_consumption',
    -sum(recipe.quantity_per_unit*item.quantity),stock.unit_cost,'Consumo do pedido #'||saved_order.order_number,
    saved_order.updated_at,saved_order.created_by
  from public.order_items item
  join public.product_recipes recipe on recipe.product_id=item.product_id
  join public.inventory_items stock on stock.id=recipe.inventory_item_id
  where item.order_id=p_order_id
  group by recipe.inventory_item_id,stock.unit_cost;
end; $$;

create or replace function public.orders_refresh_inventory_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.refresh_order_inventory(coalesce(new.id,old.id)); return coalesce(new,old); end; $$;
create or replace function public.order_items_refresh_inventory_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.refresh_order_inventory(coalesce(new.order_id,old.order_id)); return coalesce(new,old); end; $$;

drop trigger if exists orders_refresh_inventory on public.orders;
create trigger orders_refresh_inventory after update of status,event_id,operation_mode on public.orders
for each row execute function public.orders_refresh_inventory_trigger();
drop trigger if exists order_items_refresh_inventory on public.order_items;
create trigger order_items_refresh_inventory after insert or update or delete on public.order_items
for each row execute function public.order_items_refresh_inventory_trigger();

drop function if exists public.save_order(uuid,text,numeric,text,uuid,text,timestamptz,jsonb);
create function public.save_order(
  p_order_id uuid, p_client_name text, p_confirmed_total numeric, p_status text,
  p_payment_method_id uuid, p_payment_method_name text, p_ordered_at timestamptz, p_items jsonb,
  p_operation_mode text default 'service', p_event_id uuid default null
)
returns public.orders language plpgsql security invoker set search_path=public as $$
declare saved_order public.orders;
begin
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'O pedido precisa ter ao menos um item.'; end if;
  if p_order_id is null then
    insert into public.orders(client_name,confirmed_total,status,payment_method_id,payment_method_name,ordered_at,created_by,operation_mode,event_id)
    values(coalesce(nullif(trim(p_client_name),''),'Balcão'),p_confirmed_total,p_status,p_payment_method_id,p_payment_method_name,p_ordered_at,auth.uid(),p_operation_mode,p_event_id)
    returning * into saved_order;
  else
    update public.orders set client_name=coalesce(nullif(trim(p_client_name),''),'Balcão'),confirmed_total=p_confirmed_total,
      status=p_status,payment_method_id=p_payment_method_id,payment_method_name=p_payment_method_name,ordered_at=p_ordered_at,
      operation_mode=p_operation_mode,event_id=p_event_id where id=p_order_id returning * into saved_order;
    if saved_order.id is null then raise exception 'Pedido não encontrado.'; end if;
    delete from public.order_items where order_id=p_order_id;
  end if;
  insert into public.order_items(order_id,product_id,product_name,product_category,unit_price,quantity)
  select saved_order.id,nullif(item->>'product_id','')::uuid,item->>'product_name',item->>'product_category',
    (item->>'unit_price')::numeric,(item->>'quantity')::integer from jsonb_array_elements(p_items) item;
  perform public.refresh_order_inventory(saved_order.id);
  return saved_order;
end; $$;
revoke all on function public.save_order(uuid,text,numeric,text,uuid,text,timestamptz,jsonb,text,uuid) from public,anon;
grant execute on function public.save_order(uuid,text,numeric,text,uuid,text,timestamptz,jsonb,text,uuid) to authenticated;

create or replace function public.close_stock_day(p_date date,p_notes text,p_items jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare closing_id uuid; item jsonb; expected numeric; actual numeric; stock_id uuid;
begin
  insert into public.stock_closings(closing_date,notes,closed_by) values(p_date,p_notes,auth.uid()) returning id into closing_id;
  for item in select * from jsonb_array_elements(p_items) loop
    stock_id=(item->>'inventory_item_id')::uuid; actual=(item->>'actual_quantity')::numeric;
    select quantity_on_hand into expected from public.inventory_items where id=stock_id;
    insert into public.stock_closing_items values(closing_id,stock_id,expected,actual,actual-expected,(select unit_cost from public.inventory_items where id=stock_id));
    if actual<>expected then insert into public.inventory_movements(inventory_item_id,movement_type,quantity_delta,note,created_by)
      values(stock_id,'closing',actual-expected,'Fechamento de '||p_date,auth.uid()); end if;
  end loop; return closing_id;
end; $$;
grant execute on function public.close_stock_day(date,text,jsonb) to authenticated;

alter table public.inventory_items enable row level security;
alter table public.product_recipes enable row level security;
alter table public.operation_events enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.stock_closings enable row level security;
alter table public.stock_closing_items enable row level security;
grant select on public.inventory_items,public.product_recipes,public.operation_events,public.inventory_movements,public.stock_closings,public.stock_closing_items to authenticated;
grant insert,update,delete on public.inventory_items,public.product_recipes to authenticated;
grant insert,update,delete on public.operation_events,public.inventory_movements,public.stock_closings,public.stock_closing_items to authenticated;

create policy "inventory_read" on public.inventory_items for select to authenticated using(true);
create policy "inventory_admin_write" on public.inventory_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "recipes_read" on public.product_recipes for select to authenticated using(true);
create policy "recipes_admin_write" on public.product_recipes for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "events_read" on public.operation_events for select to authenticated using(true);
create policy "events_write" on public.operation_events for all to authenticated using(true) with check(created_by=auth.uid());
create policy "movements_read" on public.inventory_movements for select to authenticated using(true);
create policy "movements_write" on public.inventory_movements for all to authenticated using(true) with check(created_by=auth.uid());
create policy "closings_read" on public.stock_closings for select to authenticated using(true);
create policy "closings_write" on public.stock_closings for all to authenticated using(true) with check(closed_by=auth.uid());
create policy "closing_items_read" on public.stock_closing_items for select to authenticated using(true);
create policy "closing_items_write" on public.stock_closing_items for all to authenticated using(true) with check(true);

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='inventory_items') then alter publication supabase_realtime add table public.inventory_items; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='inventory_movements') then alter publication supabase_realtime add table public.inventory_movements; end if;
end $$;
