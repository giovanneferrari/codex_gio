-- Eventos cobrados previamente: pedidos internos e públicos não geram nova cobrança.
begin;

alter table public.schedule_events add column if not exists prepaid boolean not null default false;
alter table public.operation_events add column if not exists prepaid boolean not null default false;

alter table public.schedule_events drop constraint if exists schedule_events_prepaid_fixed_check;
alter table public.schedule_events add constraint schedule_events_prepaid_fixed_check
  check (prepaid is not true or billing_model='fixed');

create or replace function public.start_schedule_operation(p_schedule_event_id uuid)
returns public.operation_events language plpgsql security definer set search_path=public as $$
declare agenda public.schedule_events; started public.operation_events;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Somente administradores podem iniciar eventos.'; end if;
  select * into agenda from public.schedule_events where id=p_schedule_event_id for update;
  if agenda.id is null then raise exception 'Compromisso não encontrado.'; end if;
  if agenda.confirmation_status<>'confirmed' then raise exception 'Confirme o compromisso antes de iniciar.'; end if;
  if agenda.lifecycle_status='closed' then raise exception 'Este evento já foi encerrado.'; end if;
  select * into started from public.operation_events where schedule_event_id=agenda.id and status='active' limit 1;
  if started.id is not null then return started; end if;
  insert into public.operation_events(
    name,status,contracted_quantity,manual_revenue,manual_cost,starts_at,created_by,
    schedule_event_id,billing_model,contracted_value,expected_guests,actual_guests,extra_revenue,prepaid
  ) values(
    agenda.title,'active',0,0,0,now(),auth.uid(),
    agenda.id,agenda.billing_model,agenda.contracted_value,agenda.expected_guests,0,0,agenda.prepaid
  ) returning * into started;
  update public.schedule_events set lifecycle_status='active',operation_event_id=started.id where id=agenda.id;
  return started;
end;
$$;
revoke all on function public.start_schedule_operation(uuid) from public,anon;
grant execute on function public.start_schedule_operation(uuid) to authenticated;

create or replace function public.get_public_ordering_catalog_v2(p_event_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; event_prepaid boolean:=false;
begin
  result:=public.get_public_ordering_catalog();
  if p_event_id is not null then
    select prepaid into event_prepaid from public.operation_events where id=p_event_id and status='active';
  elsif (select count(*) from public.operation_events where status='active')=1 then
    select prepaid into event_prepaid from public.operation_events where status='active' limit 1;
  end if;
  return result||jsonb_build_object('prepaid',coalesce(event_prepaid,false));
end;
$$;
revoke all on function public.get_public_ordering_catalog_v2(uuid) from public;
grant execute on function public.get_public_ordering_catalog_v2(uuid) to anon,authenticated;

create or replace function public.create_public_order_v3(
  p_client_name text,
  p_payment_method_id uuid,
  p_items jsonb,
  p_customer_note text,
  p_client_id uuid,
  p_request_key uuid,
  p_event_id uuid default null
) returns table(order_number bigint,public_token uuid,total numeric,pix_value text)
language plpgsql security definer set search_path=public as $$
declare
  config public.public_ordering_config;
  selected_payment public.payment_methods;
  selected_event public.operation_events;
  saved_order public.orders;
  item jsonb;
  selected_product public.products;
  selected_quantity integer;
  calculated_total numeric(12,2):=0;
  total_quantity integer:=0;
  is_pix boolean:=false;
  clean_name text:=left(trim(coalesce(p_client_name,'')),80);
  clean_note text:=nullif(left(trim(coalesce(p_customer_note,'')),240),'');
begin
  select * into config from public.public_ordering_config where id=true;
  if config.enabled is not true then raise exception 'Os pedidos pelo QR Code estão fechados no momento.'; end if;
  if p_event_id is not null then
    select * into selected_event from public.operation_events where id=p_event_id and status='active' for share;
    if selected_event.id is null then raise exception 'Este evento não está recebendo pedidos.'; end if;
  else
    if (select count(*) from public.operation_events where status='active')>1 then raise exception 'Use o QR Code específico do seu evento.'; end if;
    select * into selected_event from public.operation_events where status='active' limit 1;
  end if;
  if selected_event.prepaid is not true then
    select * into selected_payment from public.payment_methods where id=p_payment_method_id and active=true;
    if selected_payment.id is null then raise exception 'Escolha uma forma de pagamento válida.'; end if;
    is_pix=lower(selected_payment.name) like '%pix%';
    if is_pix and nullif(trim(config.pix_value),'') is null then raise exception 'O pagamento via Pix está indisponível no momento.'; end if;
  end if;
  if p_client_id is null or p_request_key is null then raise exception 'Não foi possível identificar este dispositivo.'; end if;
  if char_length(clean_name)<2 then raise exception 'Informe seu nome.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>20 then raise exception 'Escolha ao menos um produto.'; end if;
  select * into saved_order from public.orders where request_key=p_request_key;
  if saved_order.id is not null then
    return query select saved_order.order_number,saved_order.public_order_token,saved_order.confirmed_total,
      case when lower(saved_order.payment_method_name) like '%pix%' then config.pix_value else null end;
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
  if selected_event.prepaid then calculated_total:=0; end if;
  insert into public.orders(client_name,confirmed_total,status,payment_method_id,payment_method_name,ordered_at,created_by,operation_mode,event_id,order_source,payment_status,public_order_token,public_client_id,request_key,customer_note)
  values(clean_name,calculated_total,'A fazer',case when selected_event.prepaid then null else selected_payment.id end,case when selected_event.prepaid then 'Evento pré-pago' else selected_payment.name end,now(),null,case when selected_event.id is null then 'service' else 'event' end,selected_event.id,'public_qr',case when selected_event.prepaid then 'not_applicable' when is_pix then 'pix_pending' else 'pay_on_site' end,gen_random_uuid(),p_client_id,p_request_key,clean_note)
  returning * into saved_order;
  for item in select * from jsonb_array_elements(p_items) loop
    selected_quantity:=(item->>'quantity')::integer;
    select * into selected_product from public.products where id=(item->>'product_id')::uuid and active=true;
    insert into public.order_items(order_id,product_id,product_name,product_category,unit_price,quantity)
    values(saved_order.id,selected_product.id,selected_product.name,selected_product.category,case when selected_event.prepaid then 0 else selected_product.price end,selected_quantity);
  end loop;
  return query select saved_order.order_number,saved_order.public_order_token,saved_order.confirmed_total,case when is_pix then config.pix_value else null end;
end;
$$;
revoke all on function public.create_public_order_v3(text,uuid,jsonb,text,uuid,uuid,uuid) from public;
grant execute on function public.create_public_order_v3(text,uuid,jsonb,text,uuid,uuid,uuid) to anon,authenticated;

commit;
