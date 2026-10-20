-- RITO CRM: prospectos conectados aos compromissos e eventos da Agenda.
create table if not exists public.commercial_prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(trim(company_name)) > 0),
  segment text,
  contact_name text,
  phone text,
  instagram text,
  address text,
  city text not null default 'Campinas/SP',
  stage text not null default 'mapped',
  source text,
  next_action text,
  next_action_on date,
  first_contact_on date,
  commercial_model text,
  partner_share_percent numeric(5,2) not null default 0 check (partner_share_percent between 0 and 100),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_prospects_stage_check check (stage in ('mapped','contacted','replied','visit','proposal','confirmed','client','paused','lost'))
);

alter table public.schedule_events
  add column if not exists prospect_id uuid references public.commercial_prospects(id) on delete set null;

create index if not exists commercial_prospects_stage_idx on public.commercial_prospects(stage);
create index if not exists commercial_prospects_next_action_idx on public.commercial_prospects(next_action_on);
create index if not exists schedule_events_prospect_idx on public.schedule_events(prospect_id);

drop trigger if exists commercial_prospects_set_updated_at on public.commercial_prospects;
create trigger commercial_prospects_set_updated_at before update on public.commercial_prospects
for each row execute function public.set_updated_at();

alter table public.commercial_prospects enable row level security;
grant select, insert, update, delete on public.commercial_prospects to authenticated;
create policy "commercial_prospects_read" on public.commercial_prospects for select to authenticated using (true);
create policy "commercial_prospects_admin_write" on public.commercial_prospects for all to authenticated
using (public.is_admin()) with check (public.is_admin());

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='commercial_prospects') then
    alter publication supabase_realtime add table public.commercial_prospects;
  end if;
end $$;

create or replace function public.sync_prospect_from_schedule()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.prospect_id is not null and new.confirmation_status = 'confirmed' then
    update public.commercial_prospects
       set stage = case when stage = 'client' then stage else 'confirmed' end,
           next_action = case when stage = 'client' then next_action else 'Preparar evento confirmado' end,
           next_action_on = case when stage = 'client' then next_action_on else new.event_date end
     where id = new.prospect_id;
  end if;
  return new;
end $$;

drop trigger if exists schedule_event_sync_prospect on public.schedule_events;
create trigger schedule_event_sync_prospect after insert or update of confirmation_status, prospect_id
on public.schedule_events for each row execute function public.sync_prospect_from_schedule();

create or replace function public.sync_prospect_from_closed_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare linked_prospect uuid;
begin
  if new.status = 'closed' and old.status is distinct from new.status then
    select prospect_id into linked_prospect from public.schedule_events where id = new.schedule_event_id;
    if linked_prospect is not null then
      update public.commercial_prospects
         set stage = 'client', next_action = 'Planejar próximo evento', next_action_on = current_date + 30
       where id = linked_prospect;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists operation_event_sync_prospect on public.operation_events;
create trigger operation_event_sync_prospect after update of status on public.operation_events
for each row execute function public.sync_prospect_from_closed_event();
