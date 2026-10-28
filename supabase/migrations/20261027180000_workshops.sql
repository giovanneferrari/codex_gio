create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  event_date date not null,
  starts_at time not null,
  location_name text,
  address text,
  price numeric(10,2) not null check (price >= 0),
  capacity integer check (capacity is null or capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workshop_registrations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 3 and 100),
  whatsapp text not null check (char_length(regexp_replace(whatsapp, '\\D', '', 'g')) between 10 and 13),
  dietary_restriction text check (dietary_restriction is null or char_length(dietary_restriction) <= 240),
  confirmed boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists workshop_registration_phone_unique
  on public.workshop_registrations (workshop_id, regexp_replace(whatsapp, '\\D', '', 'g'));
create index if not exists workshop_registrations_created_idx
  on public.workshop_registrations (workshop_id, created_at desc);

alter table public.workshops enable row level security;
alter table public.workshop_registrations enable row level security;

grant select, insert, update, delete on public.workshops to authenticated;
grant select, insert, update, delete on public.workshop_registrations to authenticated;

drop policy if exists "workshops_authenticated_read" on public.workshops;
create policy "workshops_authenticated_read" on public.workshops
  for select to authenticated using (true);
drop policy if exists "workshops_authenticated_write" on public.workshops;
create policy "workshops_authenticated_write" on public.workshops
  for all to authenticated using (true) with check (true);
drop policy if exists "workshop_registrations_authenticated_read" on public.workshop_registrations;
create policy "workshop_registrations_authenticated_read" on public.workshop_registrations
  for select to authenticated using (true);
drop policy if exists "workshop_registrations_authenticated_write" on public.workshop_registrations;
create policy "workshop_registrations_authenticated_write" on public.workshop_registrations
  for all to authenticated using (true) with check (true);

create or replace function public.register_workshop_participant(
  p_workshop_slug text,
  p_full_name text,
  p_whatsapp text,
  p_dietary_restriction text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_workshop public.workshops;
  registration_id uuid;
  clean_name text := trim(coalesce(p_full_name, ''));
  clean_phone text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  clean_restriction text := nullif(trim(coalesce(p_dietary_restriction, '')), '');
begin
  select * into selected_workshop
  from public.workshops
  where slug = p_workshop_slug and active = true and event_date >= current_date;

  if selected_workshop.id is null then
    raise exception 'Workshop indisponível para inscrições.';
  end if;
  if char_length(clean_name) < 3 or char_length(clean_name) > 100 then
    raise exception 'Informe o nome completo.';
  end if;
  if char_length(clean_phone) < 10 or char_length(clean_phone) > 13 then
    raise exception 'Informe um WhatsApp válido.';
  end if;
  if clean_restriction is not null and char_length(clean_restriction) > 240 then
    raise exception 'A restrição alimentar deve ter até 240 caracteres.';
  end if;
  if selected_workshop.capacity is not null and (
    select count(*) from public.workshop_registrations
    where workshop_id = selected_workshop.id and confirmed = true
  ) >= selected_workshop.capacity then
    raise exception 'As vagas deste workshop foram preenchidas.';
  end if;

  insert into public.workshop_registrations (
    workshop_id, full_name, whatsapp, dietary_restriction
  ) values (
    selected_workshop.id, clean_name, clean_phone, clean_restriction
  ) returning id into registration_id;

  return registration_id;
exception
  when unique_violation then
    raise exception 'Este WhatsApp já está inscrito no workshop.';
end;
$$;

revoke all on function public.register_workshop_participant(text,text,text,text) from public;
grant execute on function public.register_workshop_participant(text,text,text,text) to anon, authenticated;

insert into public.workshops (
  slug, title, event_date, starts_at, location_name, address, price, capacity, active
) values (
  'cafe-sp-2026-11-29',
  'Workshop de Café',
  '2026-11-29',
  '10:00',
  'Condomínio Side Alto da Boa Vista',
  'R. Cel. Luís Barroso, 345 · Santo Amaro · São Paulo',
  130,
  15,
  true
) on conflict (slug) do update set
  title = excluded.title,
  event_date = excluded.event_date,
  starts_at = excluded.starts_at,
  location_name = excluded.location_name,
  address = excluded.address,
  price = excluded.price,
  capacity = excluded.capacity,
  active = excluded.active,
  updated_at = now();

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workshop_registrations'
  ) then
    alter publication supabase_realtime add table public.workshop_registrations;
  end if;
end $$;
