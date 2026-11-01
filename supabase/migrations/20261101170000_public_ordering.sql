alter table public.orders alter column created_by drop not null;
alter table public.orders add column if not exists order_source text not null default 'internal';
alter table public.orders add column if not exists payment_status text not null default 'not_applicable';
alter table public.orders add column if not exists public_order_token uuid;
alter table public.orders add column if not exists public_client_id uuid;
alter table public.orders add column if not exists request_key uuid;
alter table public.orders add column if not exists customer_note text;

alter table public.orders drop constraint if exists orders_order_source_check;
alter table public.orders add constraint orders_order_source_check check (order_source in ('internal','public_qr'));
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check (payment_status in ('not_applicable','pay_on_site','pix_pending','paid'));
create unique index if not exists orders_public_token_unique on public.orders(public_order_token) where public_order_token is not null;
create unique index if not exists orders_request_key_unique on public.orders(request_key) where request_key is not null;
create index if not exists orders_public_client_recent_idx on public.orders(public_client_id,created_at desc) where public_client_id is not null;

create table if not exists public.public_ordering_config (
  id boolean primary key default true check (id = true),
  enabled boolean not null default false,
  venue_name text not null default 'RITO Café',
  intro_text text not null default 'Escolha suas bebidas e envie o pedido diretamente para nossa equipe.',
  pix_value text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.public_ordering_config(id) values(true) on conflict(id) do nothing;
alter table public.public_ordering_config enable row level security;
grant select,update on public.public_ordering_config to authenticated;
drop policy if exists "public_ordering_config_authenticated_read" on public.public_ordering_config;
create policy "public_ordering_config_authenticated_read" on public.public_ordering_config for select to authenticated using(true);
drop policy if exists "public_ordering_config_authenticated_update" on public.public_ordering_config;
create policy "public_ordering_config_authenticated_update" on public.public_ordering_config for update to authenticated using(true) with check(true);

create or replace function public.get_public_ordering_catalog()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'enabled',config.enabled,
    'venue_name',config.venue_name,
    'intro_text',config.intro_text,
    'pix_available',nullif(trim(config.pix_value),'') is not null,
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',product.id,'name',product.name,'category',product.category,'price',product.price) order by product.category,product.name) from public.products product where product.active=true),'[]'::jsonb)
  ) from public.public_ordering_config config where config.id=true;
$$;

create or replace function public.create_public_order(
  p_client_name text,
  p_payment_mode text,
  p_items jsonb,
  p_customer_note text,
  p_client_id uuid,
  p_request_key uuid
) returns table(order_number bigint,public_token uuid,total numeric,pix_value text)
language plpgsql security definer set search_path=public as $$
declare
  config public.public_ordering_config;
  saved_order public.orders;
  item jsonb;
  selected_product public.products;
  selected_quantity integer;
  calculated_total numeric(12,2):=0;
  total_quantity integer:=0;
  active_event_id uuid;
  clean_name text:=left(trim(coalesce(p_client_name,'')),80);
  clean_note text:=nullif(left(trim(coalesce(p_customer_note,'')),240),'');
begin
  select * into config from public.public_ordering_config where id=true;
  if config.enabled is not true then raise exception 'Os pedidos pelo QR Code estão fechados no momento.'; end if;
  if p_client_id is null or p_request_key is null then raise exception 'Não foi possível identificar este dispositivo.'; end if;
  if char_length(clean_name)<2 then raise exception 'Informe seu nome.'; end if;
  if p_payment_mode not in ('onsite','pix') then raise exception 'Escolha uma forma de pagamento.'; end if;
  if p_payment_mode='pix' and nullif(trim(config.pix_value),'') is null then raise exception 'O pagamento via Pix está indisponível no momento.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>20 then raise exception 'Escolha ao menos um produto.'; end if;

  select * into saved_order from public.orders where request_key=p_request_key;
  if saved_order.id is not null then
    return query select saved_order.order_number,saved_order.public_order_token,saved_order.confirmed_total,case when p_payment_mode='pix' then config.pix_value else null end;
    return;
  end if;

  if (select count(*) from public.orders where public_client_id=p_client_id and created_at>now()-interval '1 minute')>=3 then
    raise exception 'Aguarde um instante antes de enviar outro pedido.';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    begin selected_quantity:=(item->>'quantity')::integer; exception when others then raise exception 'Quantidade inválida.'; end;
    if selected_quantity<1 or selected_quantity>20 then raise exception 'Quantidade inválida.'; end if;
    select * into selected_product from public.products where id=(item->>'product_id')::uuid and active=true;
    if selected_product.id is null then raise exception 'Um produto não está mais disponível.'; end if;
    calculated_total:=calculated_total+(selected_product.price*selected_quantity);
    total_quantity:=total_quantity+selected_quantity;
  end loop;
  if total_quantity>50 then raise exception 'O pedido ultrapassa o limite de itens.'; end if;

  select id into active_event_id from public.operation_events where status='active' order by starts_at desc limit 1;
  insert into public.orders(client_name,confirmed_total,status,payment_method_id,payment_method_name,ordered_at,created_by,operation_mode,event_id,order_source,payment_status,public_order_token,public_client_id,request_key,customer_note)
  values(clean_name,calculated_total,'A fazer',null,case when p_payment_mode='pix' then 'Pix · confirmar recebimento' else 'Pagamento presencial' end,now(),null,case when active_event_id is null then 'service' else 'event' end,active_event_id,'public_qr',case when p_payment_mode='pix' then 'pix_pending' else 'pay_on_site' end,gen_random_uuid(),p_client_id,p_request_key,clean_note)
  returning * into saved_order;

  for item in select * from jsonb_array_elements(p_items) loop
    selected_quantity:=(item->>'quantity')::integer;
    select * into selected_product from public.products where id=(item->>'product_id')::uuid and active=true;
    insert into public.order_items(order_id,product_id,product_name,product_category,unit_price,quantity)
    values(saved_order.id,selected_product.id,selected_product.name,selected_product.category,selected_product.price,selected_quantity);
  end loop;

  return query select saved_order.order_number,saved_order.public_order_token,saved_order.confirmed_total,case when p_payment_mode='pix' then config.pix_value else null end;
end;
$$;

create or replace function public.get_public_order_status(p_token uuid)
returns table(order_number bigint,status text,payment_status text,total numeric)
language sql stable security definer set search_path=public as $$
  select orders.order_number,orders.status,orders.payment_status,orders.confirmed_total from public.orders where orders.public_order_token=p_token and orders.order_source='public_qr';
$$;

revoke all on function public.get_public_ordering_catalog() from public;
grant execute on function public.get_public_ordering_catalog() to anon,authenticated;
revoke all on function public.create_public_order(text,text,jsonb,text,uuid,uuid) from public;
grant execute on function public.create_public_order(text,text,jsonb,text,uuid,uuid) to anon,authenticated;
revoke all on function public.get_public_order_status(uuid) from public;
grant execute on function public.get_public_order_status(uuid) to anon,authenticated;
