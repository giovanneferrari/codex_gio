-- Integra a Agenda ao ciclo operacional e financeiro dos eventos.

alter table public.schedule_events
  add column if not exists billing_model text not null default 'consumption',
  add column if not exists contracted_value numeric(14,2) not null default 0,
  add column if not exists expected_guests integer not null default 0,
  add column if not exists lifecycle_status text not null default 'scheduled',
  add column if not exists operation_event_id uuid references public.operation_events(id) on delete set null;

alter table public.schedule_events drop constraint if exists schedule_events_billing_model_check;
alter table public.schedule_events add constraint schedule_events_billing_model_check
  check (billing_model in ('consumption','fixed','per_person'));
alter table public.schedule_events drop constraint if exists schedule_events_lifecycle_status_check;
alter table public.schedule_events add constraint schedule_events_lifecycle_status_check
  check (lifecycle_status in ('scheduled','active','closed','cancelled'));
alter table public.schedule_events drop constraint if exists schedule_events_contracted_value_check;
alter table public.schedule_events add constraint schedule_events_contracted_value_check check (contracted_value >= 0);
alter table public.schedule_events drop constraint if exists schedule_events_expected_guests_check;
alter table public.schedule_events add constraint schedule_events_expected_guests_check check (expected_guests >= 0);

alter table public.operation_events
  add column if not exists schedule_event_id uuid references public.schedule_events(id) on delete set null,
  add column if not exists billing_model text not null default 'consumption',
  add column if not exists contracted_value numeric(14,2) not null default 0,
  add column if not exists expected_guests integer not null default 0,
  add column if not exists actual_guests integer not null default 0,
  add column if not exists extra_revenue numeric(14,2) not null default 0,
  add column if not exists closing_notes text;

create unique index if not exists operation_events_schedule_unique
  on public.operation_events(schedule_event_id) where schedule_event_id is not null;

create or replace function public.start_schedule_operation(p_schedule_event_id uuid)
returns public.operation_events language plpgsql security definer set search_path=public as $$
declare agenda public.schedule_events; active_count integer; started public.operation_events;
begin
  select * into agenda from public.schedule_events where id=p_schedule_event_id for update;
  if agenda.id is null then raise exception 'Compromisso não encontrado.'; end if;
  if agenda.confirmation_status <> 'confirmed' then raise exception 'Confirme o compromisso antes de iniciar.'; end if;
  if agenda.lifecycle_status <> 'scheduled' then raise exception 'Este compromisso já foi iniciado ou encerrado.'; end if;
  select count(*) into active_count from public.operation_events where status='active';
  if active_count > 0 then raise exception 'Encerre o evento atual antes de iniciar outro.'; end if;

  insert into public.operation_events(
    name,status,contracted_quantity,manual_revenue,manual_cost,starts_at,created_by,
    schedule_event_id,billing_model,contracted_value,expected_guests,actual_guests,extra_revenue
  ) values (
    agenda.title,'active',agenda.expected_guests,0,0,now(),auth.uid(),agenda.id,
    agenda.billing_model,agenda.contracted_value,agenda.expected_guests,0,0
  ) returning * into started;
  update public.schedule_events set lifecycle_status='active',operation_event_id=started.id where id=agenda.id;
  return started;
end $$;

revoke all on function public.start_schedule_operation(uuid) from public,anon;
grant execute on function public.start_schedule_operation(uuid) to authenticated;

create or replace function public.close_schedule_operation(
  p_event_id uuid,
  p_actual_guests integer,
  p_manual_cost numeric default 0,
  p_items jsonb default '[]'::jsonb,
  p_notes text default null
)
returns public.operation_events language plpgsql security invoker set search_path=public as $$
declare
  current_event public.operation_events;
  closed_event public.operation_events;
  item jsonb;
  product_uuid uuid;
  product_label text;
  confirmed_qty integer;
  ordered_qty integer;
  qty_difference integer;
  extras numeric;
  base_revenue numeric;
  total_revenue numeric;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into current_event from public.operation_events where id=p_event_id and status='active' for update;
  if current_event.id is null then raise exception 'Evento ativo não encontrado.'; end if;

  select coalesce(sum(confirmed_total),0) into extras
    from public.orders where event_id=p_event_id and status='Finalizado';
  base_revenue=case current_event.billing_model
    when 'fixed' then current_event.contracted_value
    when 'per_person' then current_event.contracted_value*greatest(coalesce(p_actual_guests,0),0)
    else 0 end;
  total_revenue=base_revenue+extras;

  for item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    product_uuid=nullif(item->>'product_id','')::uuid;
    product_label=coalesce(nullif(item->>'product_name',''),(select name from public.products where id=product_uuid),'Produto');
    confirmed_qty=greatest(coalesce((item->>'served_quantity')::integer,0),0);
    select coalesce(sum(order_item.quantity),0)::integer into ordered_qty
      from public.order_items order_item
      join public.orders customer_order on customer_order.id=order_item.order_id
      where customer_order.event_id=p_event_id and customer_order.status='Finalizado'
        and order_item.product_id=product_uuid;
    qty_difference=confirmed_qty-ordered_qty;

    insert into public.operation_event_items(event_id,product_id,product_name,planned_quantity,served_quantity)
    values(p_event_id,product_uuid,product_label,0,confirmed_qty)
    on conflict(event_id,product_name) do update set
      product_id=excluded.product_id,served_quantity=excluded.served_quantity;

    if qty_difference<>0 then
      insert into public.inventory_movements(
        inventory_item_id,event_id,movement_type,quantity_delta,unit_cost_snapshot,note,created_by
      )
      select recipe.inventory_item_id,p_event_id,'closing',-(recipe.quantity_per_unit*qty_difference),
        stock.unit_cost,'Ajuste no encerramento do evento: '||current_event.name,auth.uid()
      from public.product_recipes recipe
      join public.inventory_items stock on stock.id=recipe.inventory_item_id
      where recipe.product_id=product_uuid;
    end if;
  end loop;

  update public.operation_events set
    status='closed',served_quantity=(select coalesce(sum(served_quantity),0) from public.operation_event_items where event_id=p_event_id),
    actual_guests=greatest(coalesce(p_actual_guests,0),0),extra_revenue=extras,
    manual_revenue=total_revenue,manual_cost=greatest(coalesce(p_manual_cost,0),0),
    closing_notes=nullif(trim(coalesce(p_notes,'')),''),ends_at=now()
  where id=p_event_id returning * into closed_event;

  update public.schedule_events set lifecycle_status='closed'
    where id=current_event.schedule_event_id;

  if total_revenue>0 then
    insert into public.financial_entries(entry_type,category,description,amount,occurred_on,source_type,event_id,created_by,notes)
    values('income','Eventos','Evento: '||current_event.name,total_revenue,current_date,'event',p_event_id,auth.uid(),p_notes)
    on conflict(event_id) do update set amount=excluded.amount,description=excluded.description,
      occurred_on=excluded.occurred_on,notes=excluded.notes;
  end if;
  if coalesce(p_manual_cost,0)>0 then
    insert into public.financial_entries(entry_type,category,description,amount,occurred_on,source_type,created_by,notes)
    values('expense','Eventos','Custo do evento: '||current_event.name,p_manual_cost,current_date,'manual',auth.uid(),p_notes);
  end if;
  return closed_event;
end $$;

revoke all on function public.close_schedule_operation(uuid,integer,numeric,jsonb,text) from public,anon;
grant execute on function public.close_schedule_operation(uuid,integer,numeric,jsonb,text) to authenticated;
