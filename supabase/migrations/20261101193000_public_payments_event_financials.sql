-- Formas de pagamento públicas e fechamento financeiro detalhado por evento.

create table if not exists public.operation_event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.operation_events(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 2 and 100),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists operation_event_expenses_event_idx on public.operation_event_expenses(event_id);
alter table public.financial_entries add column if not exists related_event_id uuid references public.operation_events(id) on delete set null;
create index if not exists financial_entries_related_event_idx on public.financial_entries(related_event_id) where related_event_id is not null;
alter table public.operation_event_expenses enable row level security;
grant select,insert,update,delete on public.operation_event_expenses to authenticated;
drop policy if exists "operation_event_expenses_authenticated" on public.operation_event_expenses;
create policy "operation_event_expenses_authenticated" on public.operation_event_expenses for all to authenticated using(true) with check(true);

create or replace function public.get_public_ordering_catalog()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'enabled',config.enabled,
    'venue_name',config.venue_name,
    'intro_text',config.intro_text,
    'pix_available',nullif(trim(config.pix_value),'') is not null,
    'payment_methods',coalesce((select jsonb_agg(jsonb_build_object('id',method.id,'name',method.name) order by method.name) from public.payment_methods method where method.active=true),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',product.id,'name',product.name,'category',product.category,'price',product.price) order by product.category,product.name) from public.products product where product.active=true),'[]'::jsonb)
  ) from public.public_ordering_config config where config.id=true;
$$;

create or replace function public.create_public_order_v2(
  p_client_name text,
  p_payment_method_id uuid,
  p_items jsonb,
  p_customer_note text,
  p_client_id uuid,
  p_request_key uuid
) returns table(order_number bigint,public_token uuid,total numeric,pix_value text)
language plpgsql security definer set search_path=public as $$
declare
  config public.public_ordering_config;
  selected_payment public.payment_methods;
  saved_order public.orders;
  item jsonb;
  selected_product public.products;
  selected_quantity integer;
  calculated_total numeric(12,2):=0;
  total_quantity integer:=0;
  active_event_id uuid;
  is_pix boolean:=false;
  clean_name text:=left(trim(coalesce(p_client_name,'')),80);
  clean_note text:=nullif(left(trim(coalesce(p_customer_note,'')),240),'');
begin
  select * into config from public.public_ordering_config where id=true;
  if config.enabled is not true then raise exception 'Os pedidos pelo QR Code estão fechados no momento.'; end if;
  select * into selected_payment from public.payment_methods where id=p_payment_method_id and active=true;
  if selected_payment.id is null then raise exception 'Escolha uma forma de pagamento válida.'; end if;
  is_pix=lower(selected_payment.name) like '%pix%';
  if is_pix and nullif(trim(config.pix_value),'') is null then raise exception 'O pagamento via Pix está indisponível no momento.'; end if;
  if p_client_id is null or p_request_key is null then raise exception 'Não foi possível identificar este dispositivo.'; end if;
  if char_length(clean_name)<2 then raise exception 'Informe seu nome.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>20 then raise exception 'Escolha ao menos um produto.'; end if;
  select * into saved_order from public.orders where request_key=p_request_key;
  if saved_order.id is not null then
    return query select saved_order.order_number,saved_order.public_order_token,saved_order.confirmed_total,case when lower(saved_order.payment_method_name) like '%pix%' then config.pix_value else null end;
    return;
  end if;
  if (select count(*) from public.orders where public_client_id=p_client_id and created_at>now()-interval '1 minute')>=3 then raise exception 'Aguarde um instante antes de enviar outro pedido.'; end if;
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
  values(clean_name,calculated_total,'A fazer',selected_payment.id,selected_payment.name,now(),null,case when active_event_id is null then 'service' else 'event' end,active_event_id,'public_qr',case when is_pix then 'pix_pending' else 'pay_on_site' end,gen_random_uuid(),p_client_id,p_request_key,clean_note)
  returning * into saved_order;
  for item in select * from jsonb_array_elements(p_items) loop
    selected_quantity:=(item->>'quantity')::integer;
    select * into selected_product from public.products where id=(item->>'product_id')::uuid and active=true;
    insert into public.order_items(order_id,product_id,product_name,product_category,unit_price,quantity)
    values(saved_order.id,selected_product.id,selected_product.name,selected_product.category,selected_product.price,selected_quantity);
  end loop;
  return query select saved_order.order_number,saved_order.public_order_token,saved_order.confirmed_total,case when is_pix then config.pix_value else null end;
end;
$$;
revoke all on function public.create_public_order_v2(text,uuid,jsonb,text,uuid,uuid) from public;
grant execute on function public.create_public_order_v2(text,uuid,jsonb,text,uuid,uuid) to anon,authenticated;

create or replace function public.close_schedule_operation_v3(
  p_event_id uuid,
  p_actual_guests integer,
  p_items jsonb,
  p_expenses jsonb,
  p_notes text
) returns public.operation_events language plpgsql security definer set search_path=public as $$
declare
  current_event public.operation_events; closed_event public.operation_events;
  event_item jsonb; expense_item jsonb; selected_product uuid; selected_name text;
  confirmed_qty integer; ordered_qty integer; qty_difference integer;
  extras numeric(14,2):=0; contract_revenue numeric(14,2):=0; total_revenue numeric(14,2):=0;
  total_expenses numeric(14,2):=0; expense_amount numeric(14,2); expense_description text; total_served integer:=0;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into current_event from public.operation_events where id=p_event_id and status='active' for update;
  if current_event.id is null then raise exception 'Evento ativo não encontrado.'; end if;
  select coalesce(sum(confirmed_total),0) into extras from public.orders where event_id=p_event_id and status='Finalizado';
  if current_event.billing_model='fixed' then contract_revenue=current_event.contracted_value;
  elsif current_event.billing_model='per_person' then contract_revenue=current_event.contracted_value*greatest(coalesce(p_actual_guests,0),0); end if;
  total_revenue=contract_revenue+extras;
  for event_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    selected_product=nullif(event_item->>'product_id','')::uuid;
    selected_name=coalesce(nullif(event_item->>'product_name',''),(select name from public.products where id=selected_product),'Produto');
    confirmed_qty=greatest(coalesce((event_item->>'served_quantity')::integer,0),0); total_served=total_served+confirmed_qty;
    select coalesce(sum(line.quantity),0)::integer into ordered_qty from public.order_items line join public.orders customer_order on customer_order.id=line.order_id where customer_order.event_id=p_event_id and customer_order.status='Finalizado' and line.product_id=selected_product;
    qty_difference=confirmed_qty-ordered_qty;
    insert into public.operation_event_items(event_id,product_id,product_name,planned_quantity,served_quantity) values(p_event_id,selected_product,selected_name,0,confirmed_qty)
    on conflict(event_id,product_name) do update set product_id=excluded.product_id,served_quantity=excluded.served_quantity;
    if qty_difference<>0 then
      insert into public.inventory_movements(inventory_item_id,event_id,movement_type,quantity_delta,unit_cost_snapshot,note,created_by)
      select recipe.inventory_item_id,p_event_id,'closing',-(recipe.quantity_per_unit*qty_difference),stock.unit_cost,'Ajuste no encerramento do evento: '||current_event.name,auth.uid() from public.product_recipes recipe join public.inventory_items stock on stock.id=recipe.inventory_item_id where recipe.product_id=selected_product;
    end if;
  end loop;
  delete from public.operation_event_expenses where event_id=p_event_id;
  for expense_item in select value from jsonb_array_elements(coalesce(p_expenses,'[]'::jsonb)) loop
    expense_description=left(trim(coalesce(expense_item->>'description','')),100);
    expense_amount=greatest(coalesce((expense_item->>'amount')::numeric,0),0);
    if char_length(expense_description)>=2 and expense_amount>0 then
      insert into public.operation_event_expenses(event_id,description,amount,created_by) values(p_event_id,expense_description,expense_amount,auth.uid());
      total_expenses=total_expenses+expense_amount;
    end if;
  end loop;
  update public.operation_events set status='closed',served_quantity=total_served,actual_guests=greatest(coalesce(p_actual_guests,0),0),extra_revenue=extras,manual_revenue=total_revenue,manual_cost=total_expenses,closing_notes=nullif(trim(coalesce(p_notes,'')),''),ends_at=now() where id=p_event_id returning * into closed_event;
  update public.schedule_events set lifecycle_status='closed' where id=current_event.schedule_event_id;
  delete from public.financial_entries where event_id=p_event_id or related_event_id=p_event_id;
  if total_revenue>0 then insert into public.financial_entries(entry_type,category,description,amount,occurred_on,source_type,event_id,created_by,notes) values('income','Eventos','Evento: '||current_event.name,total_revenue,current_date,'event',p_event_id,auth.uid(),nullif(trim(coalesce(p_notes,'')),'')); end if;
  insert into public.financial_entries(entry_type,category,description,amount,occurred_on,source_type,related_event_id,created_by,notes)
  select 'expense','Eventos','Evento: '||current_event.name||' · '||expense.description,expense.amount,current_date,'event',p_event_id,auth.uid(),nullif(trim(coalesce(p_notes,'')),'')
  from public.operation_event_expenses expense where expense.event_id=p_event_id;
  return closed_event;
end;
$$;
revoke all on function public.close_schedule_operation_v3(uuid,integer,jsonb,jsonb,text) from public,anon;
grant execute on function public.close_schedule_operation_v3(uuid,integer,jsonb,jsonb,text) to authenticated;
