-- Funções usadas pelo frontend RITO para operações atômicas e seguras.

create or replace function public.save_order(
  p_order_id uuid, p_client_name text, p_confirmed_total numeric, p_status text,
  p_payment_method_id uuid, p_payment_method_name text, p_ordered_at timestamptz, p_items jsonb
)
returns public.orders
language plpgsql security invoker set search_path = public
as $$
declare saved_order public.orders;
begin
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'O pedido precisa ter ao menos um item.'; end if;
  if p_order_id is null then
    insert into public.orders (client_name, confirmed_total, status, payment_method_id, payment_method_name, ordered_at, created_by)
    values (coalesce(nullif(trim(p_client_name), ''), 'Balcão'), p_confirmed_total, p_status, p_payment_method_id, p_payment_method_name, p_ordered_at, auth.uid())
    returning * into saved_order;
  else
    update public.orders set client_name=coalesce(nullif(trim(p_client_name), ''), 'Balcão'), confirmed_total=p_confirmed_total,
      status=p_status, payment_method_id=p_payment_method_id, payment_method_name=p_payment_method_name, ordered_at=p_ordered_at
    where id=p_order_id returning * into saved_order;
    if saved_order.id is null then raise exception 'Pedido não encontrado.'; end if;
    delete from public.order_items where order_id=p_order_id;
  end if;
  insert into public.order_items (order_id, product_id, product_name, product_category, unit_price, quantity)
  select saved_order.id, nullif(item->>'product_id','')::uuid, item->>'product_name', item->>'product_category',
    (item->>'unit_price')::numeric, (item->>'quantity')::integer from jsonb_array_elements(p_items) item;
  return saved_order;
end;
$$;
revoke all on function public.save_order(uuid,text,numeric,text,uuid,text,timestamptz,jsonb) from public, anon;
grant execute on function public.save_order(uuid,text,numeric,text,uuid,text,timestamptz,jsonb) to authenticated;

create or replace function public.update_own_profile(p_name text)
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare updated_profile public.profiles;
begin
  update public.profiles set name=trim(p_name) where id=auth.uid() and length(trim(p_name))>0 returning * into updated_profile;
  if updated_profile.id is null then raise exception 'Não foi possível atualizar o perfil.'; end if;
  return updated_profile;
end;
$$;
revoke all on function public.update_own_profile(text) from public, anon;
grant execute on function public.update_own_profile(text) to authenticated;
