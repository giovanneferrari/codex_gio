-- RITO: esquema inicial, autenticação e permissões.
-- Primeiro administrador: ritocoffeesp@gmail.com

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'operation' check (role in ('admin', 'operation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  client_name text not null default 'Balcão',
  confirmed_total numeric(12,2) not null check (confirmed_total >= 0),
  status text not null default 'A fazer' check (status in ('A fazer', 'Em preparo', 'Finalizado')),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  payment_method_name text not null,
  ordered_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_category text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_ordered_at_idx on public.orders (ordered_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_payment_method_idx on public.orders (payment_method_id);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists payment_methods_set_updated_at on public.payment_methods;
create trigger payment_methods_set_updated_at before update on public.payment_methods
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    lower(new.email),
    case when lower(new.email) = 'ritocoffeesp@gmail.com' then 'admin' else 'operation' end
  )
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

-- Garante o perfil se o usuário administrador já tiver sido criado antes da migration.
insert into public.profiles (id, name, email, role)
select
  id,
  coalesce(nullif(raw_user_meta_data ->> 'name', ''), 'Admin'),
  lower(email),
  'admin'
from auth.users
where lower(email) = 'ritocoffeesp@gmail.com'
on conflict (id) do update
set role = 'admin', email = excluded.email;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.payment_methods enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.profiles, public.products, public.payment_methods, public.orders, public.order_items from anon;
grant select on public.profiles, public.products, public.payment_methods, public.orders, public.order_items to authenticated;
grant insert, update, delete on public.products, public.payment_methods to authenticated;
grant insert, update, delete on public.orders, public.order_items to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "products_select_authenticated" on public.products;
create policy "products_select_authenticated"
on public.products for select to authenticated using (true);

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert"
on public.products for insert to authenticated with check (public.is_admin());

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
on public.products for delete to authenticated using (public.is_admin());

drop policy if exists "payment_methods_select_authenticated" on public.payment_methods;
create policy "payment_methods_select_authenticated"
on public.payment_methods for select to authenticated using (true);

drop policy if exists "payment_methods_admin_insert" on public.payment_methods;
create policy "payment_methods_admin_insert"
on public.payment_methods for insert to authenticated with check (public.is_admin());

drop policy if exists "payment_methods_admin_update" on public.payment_methods;
create policy "payment_methods_admin_update"
on public.payment_methods for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payment_methods_admin_delete" on public.payment_methods;
create policy "payment_methods_admin_delete"
on public.payment_methods for delete to authenticated using (public.is_admin());

drop policy if exists "orders_select_authenticated" on public.orders;
create policy "orders_select_authenticated"
on public.orders for select to authenticated using (true);

drop policy if exists "orders_insert_authenticated" on public.orders;
create policy "orders_insert_authenticated"
on public.orders for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "orders_update_authenticated" on public.orders;
create policy "orders_update_authenticated"
on public.orders for update to authenticated using (true) with check (true);

drop policy if exists "orders_delete_authenticated" on public.orders;
create policy "orders_delete_authenticated"
on public.orders for delete to authenticated using (true);

drop policy if exists "order_items_select_authenticated" on public.order_items;
create policy "order_items_select_authenticated"
on public.order_items for select to authenticated using (true);

drop policy if exists "order_items_insert_authenticated" on public.order_items;
create policy "order_items_insert_authenticated"
on public.order_items for insert to authenticated
with check (exists (
  select 1 from public.orders
  where orders.id = order_items.order_id
));

drop policy if exists "order_items_update_authenticated" on public.order_items;
create policy "order_items_update_authenticated"
on public.order_items for update to authenticated using (true) with check (true);

drop policy if exists "order_items_delete_authenticated" on public.order_items;
create policy "order_items_delete_authenticated"
on public.order_items for delete to authenticated using (true);

-- Habilita atualização automática do Kanban entre diferentes dispositivos.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end;
$$;
