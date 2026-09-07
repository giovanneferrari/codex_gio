-- Reparo da baixa de eventos, inclusive quando não houve produtos servidos.

create or replace function public.close_schedule_operation_v2(
  p_event_id uuid,
  p_actual_guests integer,
  p_manual_cost numeric,
  p_items jsonb,
  p_notes text
)
returns public.operation_events
language plpgsql
security definer
set search_path=public
as $$
declare
  current_event public.operation_events;
  closed_event public.operation_events;
  event_item jsonb;
  selected_product uuid;
  selected_name text;
  confirmed_qty integer;
  ordered_qty integer;
  qty_difference integer;
  extras numeric(14,2) := 0;
  contract_revenue numeric(14,2) := 0;
  total_revenue numeric(14,2) := 0;
  total_served integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;

  select * into current_event
  from public.operation_events
  where id=p_event_id and status='active'
  for update;
  if current_event.id is null then raise exception 'Evento ativo não encontrado.'; end if;

  select coalesce(sum(confirmed_total),0) into extras
  from public.orders
  where event_id=p_event_id and status='Finalizado';

  if current_event.billing_model='fixed' then
    contract_revenue=current_event.contracted_value;
  elsif current_event.billing_model='per_person' then
    contract_revenue=current_event.contracted_value*greatest(coalesce(p_actual_guests,0),0);
  end if;
  total_revenue=contract_revenue+extras;

  for event_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    selected_product=nullif(event_item->>'product_id','')::uuid;
    selected_name=coalesce(nullif(event_item->>'product_name',''),(select name from public.products where id=selected_product),'Produto');
    confirmed_qty=greatest(coalesce((event_item->>'served_quantity')::integer,0),0);
    total_served=total_served+confirmed_qty;

    select coalesce(sum(line.quantity),0)::integer into ordered_qty
    from public.order_items line
    join public.orders customer_order on customer_order.id=line.order_id
    where customer_order.event_id=p_event_id
      and customer_order.status='Finalizado'
      and line.product_id=selected_product;
    qty_difference=confirmed_qty-ordered_qty;

    insert into public.operation_event_items(event_id,product_id,product_name,planned_quantity,served_quantity)
    values(p_event_id,selected_product,selected_name,0,confirmed_qty)
    on conflict(event_id,product_name) do update set
      product_id=excluded.product_id,
      served_quantity=excluded.served_quantity;

    if qty_difference<>0 then
      insert into public.inventory_movements(
        inventory_item_id,event_id,movement_type,quantity_delta,
        unit_cost_snapshot,note,created_by
      )
      select recipe.inventory_item_id,p_event_id,'closing',
        -(recipe.quantity_per_unit*qty_difference),stock.unit_cost,
        'Ajuste no encerramento do evento: '||current_event.name,auth.uid()
      from public.product_recipes recipe
      join public.inventory_items stock on stock.id=recipe.inventory_item_id
      where recipe.product_id=selected_product;
    end if;
  end loop;

  update public.operation_events set
    status='closed',
    served_quantity=total_served,
    actual_guests=greatest(coalesce(p_actual_guests,0),0),
    extra_revenue=extras,
    manual_revenue=total_revenue,
    manual_cost=greatest(coalesce(p_manual_cost,0),0),
    closing_notes=nullif(trim(coalesce(p_notes,'')),''),
    ends_at=now()
  where id=p_event_id
  returning * into closed_event;

  update public.schedule_events set lifecycle_status='closed'
  where id=current_event.schedule_event_id;

  delete from public.financial_entries where event_id=p_event_id;
  if total_revenue>0 then
    insert into public.financial_entries(
      entry_type,category,description,amount,occurred_on,
      source_type,event_id,created_by,notes
    ) values (
      'income','Eventos','Evento: '||current_event.name,total_revenue,current_date,
      'event',p_event_id,auth.uid(),nullif(trim(coalesce(p_notes,'')),'')
    );
  end if;

  if coalesce(p_manual_cost,0)>0 then
    insert into public.financial_entries(
      entry_type,category,description,amount,occurred_on,source_type,created_by,notes
    ) values (
      'expense','Eventos','Custo do evento: '||current_event.name,p_manual_cost,
      current_date,'manual',auth.uid(),nullif(trim(coalesce(p_notes,'')),'')
    );
  end if;
  return closed_event;
end;
$$;

revoke all on function public.close_schedule_operation_v2(uuid,integer,numeric,jsonb,text) from public,anon;
grant execute on function public.close_schedule_operation_v2(uuid,integer,numeric,jsonb,text) to authenticated;
