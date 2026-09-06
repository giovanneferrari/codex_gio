create table if not exists public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  event_type text not null,
  event_date date not null,
  starts_at time,
  ends_at time,
  location text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_event_operators (
  event_id uuid not null references public.schedule_events(id) on delete cascade,
  operator_id uuid not null references public.operators(id) on delete cascade,
  primary key (event_id, operator_id)
);

create index if not exists schedule_events_date_idx on public.schedule_events(event_date);
create index if not exists schedule_event_operators_operator_idx on public.schedule_event_operators(operator_id);

drop trigger if exists operators_set_updated_at on public.operators;
create trigger operators_set_updated_at before update on public.operators
for each row execute function public.set_updated_at();
drop trigger if exists schedule_events_set_updated_at on public.schedule_events;
create trigger schedule_events_set_updated_at before update on public.schedule_events
for each row execute function public.set_updated_at();

alter table public.operators enable row level security;
alter table public.schedule_events enable row level security;
alter table public.schedule_event_operators enable row level security;

grant select on public.operators, public.schedule_events, public.schedule_event_operators to authenticated;
grant insert, update, delete on public.operators, public.schedule_events, public.schedule_event_operators to authenticated;

create policy "operators_read" on public.operators for select to authenticated using (true);
create policy "operators_admin_write" on public.operators for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "schedule_events_read" on public.schedule_events for select to authenticated using (true);
create policy "schedule_events_write" on public.schedule_events for all to authenticated using (true) with check (true);
create policy "schedule_event_operators_read" on public.schedule_event_operators for select to authenticated using (true);
create policy "schedule_event_operators_write" on public.schedule_event_operators for all to authenticated using (true) with check (true);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='schedule_events') then
    alter publication supabase_realtime add table public.schedule_events;
  end if;
end $$;
