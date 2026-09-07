alter table public.schedule_events
  add column if not exists confirmation_status text not null default 'planned';

alter table public.schedule_events
  drop constraint if exists schedule_events_confirmation_status_check;

alter table public.schedule_events
  add constraint schedule_events_confirmation_status_check
  check (confirmation_status in ('planned', 'confirmed'));

create index if not exists schedule_events_confirmation_status_idx
  on public.schedule_events(confirmation_status, event_date);
