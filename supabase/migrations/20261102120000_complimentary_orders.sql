-- Pedidos sem faturamento continuam baixando estoque quando finalizados.

alter table public.orders
  add column if not exists order_purpose text not null default 'sale',
  add column if not exists purpose_note text;

alter table public.orders drop constraint if exists orders_order_purpose_check;
alter table public.orders add constraint orders_order_purpose_check
  check (order_purpose in ('sale','team','partnership'));

create or replace function public.save_order(
  p_order_id uuid, p_client_name text, p_confirmed_total numeric, p_status text,
  p_payment_method_id uuid, p_payment_method_name text, p_ordered_at timestamptz, p_items jsonb,
  p_operation_mode text, p_event_id uuid, p_order_purpose text, p_purpose_note text
)
returns public.orders language plpgsql security invoker set search_path=public as $$
declare
  saved_order public.orders;
  selected_purpose text:=coalesce(nullif(p_order_purpose,''),'sale');
  selected_payment_name text;
begin
  if selected_purpose not in ('sale','team','partnership') then
    raise exception 'Finalidade do pedido inválida.';
  end if;

  selected_payment_name:=case selected_purpose
    when 'team' then 'Consumo da equipe'
    when 'partnership' then 'Parceria / cortesia'
    else p_payment_method_name
  end;

  saved_order:=public.save_order(
    p_order_id,p_client_name,
    case when selected_purpose='sale' then p_confirmed_total else 0 end,
    p_status,
    case when selected_purpose='sale' then p_payment_method_id else null end,
    selected_payment_name,p_ordered_at,p_items,p_operation_mode,p_event_id
  );

  update public.orders set
    order_purpose=selected_purpose,
    purpose_note=case when selected_purpose='sale' then null else nullif(left(trim(coalesce(p_purpose_note,'')),160),'') end
  where id=saved_order.id returning * into saved_order;

  return saved_order;
end;
$$;

revoke all on function public.save_order(uuid,text,numeric,text,uuid,text,timestamptz,jsonb,text,uuid,text,text) from public,anon;
grant execute on function public.save_order(uuid,text,numeric,text,uuid,text,timestamptz,jsonb,text,uuid,text,text) to authenticated;
