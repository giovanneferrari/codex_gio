begin;

create table if not exists public.commercial_event_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 120),
  stage text not null default 'new' check (stage in ('new','assessment','proposal','confirmed','completed','lost','cancelled')),
  event_date date,
  starts_at time,
  ends_at time,
  location text,
  contact_name text,
  phone text,
  expected_guests integer not null default 0 check (expected_guests >= 0),
  service_format text,
  proposal_value numeric(14,2) not null default 0 check (proposal_value >= 0),
  next_action text,
  next_action_on date,
  notes text,
  schedule_event_id uuid references public.schedule_events(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_event_interactions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.commercial_event_opportunities(id) on delete cascade,
  contacted_at timestamptz not null default now(),
  channel text not null,
  contact_name text,
  summary text not null,
  stage_after text check (stage_after in ('new','assessment','proposal','confirmed','completed','lost','cancelled')),
  next_action text,
  next_action_on date,
  author_name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists commercial_event_opportunities_stage_idx on public.commercial_event_opportunities(stage);
create index if not exists commercial_event_opportunities_date_idx on public.commercial_event_opportunities(event_date);
create index if not exists commercial_event_interactions_opportunity_idx on public.commercial_event_interactions(opportunity_id,contacted_at desc);

alter table public.commercial_event_opportunities enable row level security;
alter table public.commercial_event_interactions enable row level security;

drop policy if exists commercial_event_opportunities_admin on public.commercial_event_opportunities;
create policy commercial_event_opportunities_admin on public.commercial_event_opportunities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists commercial_event_interactions_admin on public.commercial_event_interactions;
create policy commercial_event_interactions_admin on public.commercial_event_interactions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_commercial_event_opportunity()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end;
$$;
drop trigger if exists touch_commercial_event_opportunity on public.commercial_event_opportunities;
create trigger touch_commercial_event_opportunity before update on public.commercial_event_opportunities
for each row execute function public.touch_commercial_event_opportunity();

create or replace function public.record_commercial_event_followup(
  p_opportunity_id uuid,p_contacted_at timestamptz,p_channel text,p_contact_name text,
  p_summary text,p_stage text,p_next_action text,p_next_date date
) returns public.commercial_event_opportunities
language plpgsql security definer set search_path=public as $$
declare item public.commercial_event_opportunities; author text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Acesso restrito.'; end if;
  select * into item from public.commercial_event_opportunities where id=p_opportunity_id for update;
  if item.id is null then raise exception 'Oportunidade não encontrada.'; end if;
  if p_stage not in ('new','assessment','proposal','confirmed','completed','lost','cancelled') then raise exception 'Etapa inválida.'; end if;
  select name into author from public.profiles where id=auth.uid();
  insert into public.commercial_event_interactions(opportunity_id,contacted_at,channel,contact_name,summary,stage_after,next_action,next_action_on,author_name,created_by)
  values(item.id,coalesce(p_contacted_at,now()),left(trim(p_channel),40),nullif(left(trim(coalesce(p_contact_name,'')),100),''),left(trim(p_summary),4000),p_stage,nullif(left(trim(coalesce(p_next_action,'')),120),''),p_next_date,coalesce(author,'Usuário'),auth.uid());
  update public.commercial_event_opportunities set stage=p_stage,next_action=nullif(left(trim(coalesce(p_next_action,'')),120),''),next_action_on=p_next_date
  where id=item.id returning * into item;
  return item;
end;
$$;
revoke all on function public.record_commercial_event_followup(uuid,timestamptz,text,text,text,text,text,date) from public,anon;
grant execute on function public.record_commercial_event_followup(uuid,timestamptz,text,text,text,text,text,date) to authenticated;

create or replace function public.confirm_commercial_event_opportunity(p_opportunity_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare item public.commercial_event_opportunities; schedule_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Acesso restrito.'; end if;
  select * into item from public.commercial_event_opportunities where id=p_opportunity_id for update;
  if item.id is null then raise exception 'Oportunidade não encontrada.'; end if;
  if item.schedule_event_id is not null then return item.schedule_event_id; end if;
  if item.event_date is null then raise exception 'Informe a data do evento antes de confirmar.'; end if;
  insert into public.schedule_events(title,confirmation_status,event_type,event_date,billing_model,contracted_value,expected_guests,starts_at,ends_at,location,notes,created_by)
  values(item.title,'confirmed','Evento',item.event_date,case when item.proposal_value>0 then 'fixed' else 'consumption' end,item.proposal_value,item.expected_guests,item.starts_at,item.ends_at,item.location,item.notes,auth.uid())
  returning id into schedule_id;
  update public.commercial_event_opportunities set stage='confirmed',schedule_event_id=schedule_id,next_action='Preparar operação',next_action_on=item.event_date where id=item.id;
  return schedule_id;
end;
$$;
revoke all on function public.confirm_commercial_event_opportunity(uuid) from public,anon;
grant execute on function public.confirm_commercial_event_opportunity(uuid) to authenticated;

commit;
