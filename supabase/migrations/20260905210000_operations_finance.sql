-- RITO 2.0: planejamento de eventos, custo médio e módulo financeiro.

alter table public.operation_events drop constraint if exists operation_events_status_check;
alter table public.operation_events add constraint operation_events_status_check
  check (status in ('active','closed','cancelled'));

create table if not exists public.operation_event_items (
  event_id uuid not null references public.operation_events(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  planned_quantity integer not null default 0 check (planned_quantity >= 0),
  served_quantity integer not null default 0 check (served_quantity >= 0),
  primary key (event_id, product_name)
);

alter table public.inventory_movements add column if not exists total_cost numeric(14,2);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('income','expense')),
  category text not null,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  occurred_on date not null default current_date,
  recurring boolean not null default false,
  recurrence_frequency text check (recurrence_frequency is null or recurrence_frequency in ('weekly','monthly','yearly')),
  installment_group uuid,
  installment_number integer,
  installment_count integer,
  source_type text not null default 'manual' check (source_type in ('manual','inventory','event')),
  inventory_movement_id uuid unique references public.inventory_movements(id) on delete set null,
  event_id uuid unique references public.operation_events(id) on delete set null,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.operation_event_items enable row level security;
alter table public.financial_entries enable row level security;
grant select,insert,update,delete on public.operation_event_items,public.financial_entries to authenticated;
drop policy if exists "event_items_access" on public.operation_event_items;
create policy "event_items_access" on public.operation_event_items for all to authenticated using(true) with check(true);
drop policy if exists "financial_read" on public.financial_entries;
create policy "financial_read" on public.financial_entries for select to authenticated using(true);
drop policy if exists "financial_admin_write" on public.financial_entries;
create policy "financial_admin_write" on public.financial_entries for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.apply_inventory_movement()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_quantity numeric; old_cost numeric; entry_unit_cost numeric;
begin
  if tg_op = 'INSERT' then
    select quantity_on_hand,unit_cost into old_quantity,old_cost from public.inventory_items where id=new.inventory_item_id for update;
    entry_unit_cost=case when new.movement_type='entry' and new.quantity_delta>0
      then coalesce(new.total_cost/nullif(new.quantity_delta,0),new.unit_cost_snapshot,0) else old_cost end;
    update public.inventory_items set
      quantity_on_hand=quantity_on_hand+new.quantity_delta,
      unit_cost=case when new.movement_type='entry' and new.quantity_delta>0
        then ((greatest(old_quantity,0)*old_cost)+(new.quantity_delta*entry_unit_cost))/nullif(greatest(old_quantity,0)+new.quantity_delta,0)
        else unit_cost end,
      last_entry_at=case when new.movement_type='entry' then new.occurred_at else last_entry_at end
    where id=new.inventory_item_id;
    if new.movement_type='entry' and coalesce(new.total_cost,new.quantity_delta*entry_unit_cost)>0 then
      insert into public.financial_entries(entry_type,category,description,amount,occurred_on,source_type,inventory_movement_id,created_by)
      values('expense','Estoque','Compra de '||(select name from public.inventory_items where id=new.inventory_item_id),
        coalesce(new.total_cost,new.quantity_delta*entry_unit_cost),new.occurred_at::date,'inventory',new.id,new.created_by)
      on conflict(inventory_movement_id) do nothing;
    end if;
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

create or replace function public.close_operation_event(
  p_event_id uuid,p_served_quantity integer,p_manual_revenue numeric,p_manual_cost numeric default 0,p_items jsonb default '[]'::jsonb
)
returns public.operation_events language plpgsql security invoker set search_path=public as $$
declare closed_event public.operation_events; item jsonb;
begin
  update public.operation_events set status='closed',served_quantity=greatest(coalesce(p_served_quantity,0),0),
    manual_revenue=greatest(coalesce(p_manual_revenue,0),0),manual_cost=greatest(coalesce(p_manual_cost,0),0),ends_at=now()
  where id=p_event_id and status='active' returning * into closed_event;
  if closed_event.id is null then raise exception 'Evento ativo não encontrado.'; end if;
  for item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.operation_event_items(event_id,product_id,product_name,planned_quantity,served_quantity)
    values(p_event_id,nullif(item->>'product_id','')::uuid,item->>'product_name',coalesce((item->>'planned_quantity')::integer,0),coalesce((item->>'served_quantity')::integer,0))
    on conflict(event_id,product_name) do update set served_quantity=excluded.served_quantity;
  end loop;
  if closed_event.manual_revenue>0 then
    insert into public.financial_entries(entry_type,category,description,amount,occurred_on,source_type,event_id,created_by)
    values('income','Eventos','Evento: '||closed_event.name,closed_event.manual_revenue,current_date,'event',p_event_id,auth.uid())
    on conflict(event_id) do update set amount=excluded.amount,description=excluded.description,occurred_on=excluded.occurred_on;
  end if;
  if closed_event.manual_cost>0 then
    insert into public.financial_entries(entry_type,category,description,amount,occurred_on,source_type,created_by,notes)
    values('expense','Eventos','Custo do evento: '||closed_event.name,closed_event.manual_cost,current_date,'manual',auth.uid(),'Gerado no fechamento do evento');
  end if;
  return closed_event;
end; $$;

create or replace function public.cancel_operation_event(p_event_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
  update public.operation_events set status='cancelled',ends_at=now(),manual_revenue=0,manual_cost=0
  where id=p_event_id and status='active';
end; $$;

grant execute on function public.close_operation_event(uuid,integer,numeric,numeric,jsonb) to authenticated;
grant execute on function public.cancel_operation_event(uuid) to authenticated;

insert into public.financial_entries(entry_type,category,description,amount,occurred_on,source_type,inventory_movement_id,created_by)
select 'expense','Estoque','Compra de '||stock.name,
  coalesce(movement.total_cost,abs(movement.quantity_delta)*movement.unit_cost_snapshot),movement.occurred_at::date,
  'inventory',movement.id,coalesce(movement.created_by,(select id from auth.users order by created_at limit 1))
from public.inventory_movements movement
join public.inventory_items stock on stock.id=movement.inventory_item_id
where movement.movement_type='entry'
  and coalesce(movement.total_cost,abs(movement.quantity_delta)*movement.unit_cost_snapshot)>0
on conflict(inventory_movement_id) do nothing;

insert into public.financial_entries(entry_type,category,description,amount,occurred_on,source_type,event_id,created_by)
select 'income','Eventos','Evento: '||event.name,event.manual_revenue,coalesce(event.ends_at,event.created_at)::date,
  'event',event.id,event.created_by
from public.operation_events event
where event.status='closed' and event.manual_revenue>0
on conflict(event_id) do nothing;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='financial_entries') then
    alter publication supabase_realtime add table public.financial_entries;
  end if;
end $$;
