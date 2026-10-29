alter table public.workshops add column if not exists edition_label text;
alter table public.workshops add column if not exists description text;
alter table public.workshops add column if not exists cover_url text;
alter table public.workshops add column if not exists previous_capacity integer;
alter table public.workshops add column if not exists capacity_increased_at timestamptz;

update public.workshops set
  edition_label = coalesce(edition_label, 'SÃO PAULO · EDIÇÃO 01'),
  description = coalesce(description, 'Workshop, degustação e café da manhã em uma experiência sensorial conduzida pela RITO.'),
  cover_url = coalesce(cover_url, '/assets/workshop-sp.png')
where slug = 'cafe-sp-2026-11-29';

create or replace function public.mark_workshop_capacity_increase()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.capacity is not null and old.capacity is not null and new.capacity > old.capacity then
    new.previous_capacity := old.capacity;
    new.capacity_increased_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workshops_capacity_increase on public.workshops;
create trigger workshops_capacity_increase before update on public.workshops
for each row execute function public.mark_workshop_capacity_increase();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('workshop-covers','workshop-covers',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "workshop_covers_authenticated_insert" on storage.objects;
create policy "workshop_covers_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id='workshop-covers');
drop policy if exists "workshop_covers_authenticated_update" on storage.objects;
create policy "workshop_covers_authenticated_update" on storage.objects for update to authenticated using (bucket_id='workshop-covers') with check (bucket_id='workshop-covers');
drop policy if exists "workshop_covers_authenticated_delete" on storage.objects;
create policy "workshop_covers_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id='workshop-covers');

create or replace function public.list_public_workshops()
returns table(id uuid,slug text,title text,edition_label text,description text,event_date date,starts_at time,location_name text,address text,price numeric,capacity integer,cover_url text,previous_capacity integer,capacity_increased_at timestamptz,confirmed bigint)
language sql stable security definer set search_path=public as $$
  select w.id,w.slug,w.title,w.edition_label,w.description,w.event_date,w.starts_at,w.location_name,w.address,w.price,w.capacity,w.cover_url,w.previous_capacity,w.capacity_increased_at,count(r.id) filter(where r.confirmed=true)
  from public.workshops w left join public.workshop_registrations r on r.workshop_id=w.id
  where w.active=true
  group by w.id
  order by (w.event_date>=current_date) desc,w.event_date asc;
$$;

create or replace function public.get_public_workshop(p_workshop_slug text)
returns table(id uuid,slug text,title text,edition_label text,description text,event_date date,starts_at time,location_name text,address text,price numeric,capacity integer,cover_url text,previous_capacity integer,capacity_increased_at timestamptz,confirmed bigint)
language sql stable security definer set search_path=public as $$
  select w.id,w.slug,w.title,w.edition_label,w.description,w.event_date,w.starts_at,w.location_name,w.address,w.price,w.capacity,w.cover_url,w.previous_capacity,w.capacity_increased_at,count(r.id) filter(where r.confirmed=true)
  from public.workshops w left join public.workshop_registrations r on r.workshop_id=w.id
  where w.active=true and w.slug=p_workshop_slug
  group by w.id;
$$;

revoke all on function public.list_public_workshops() from public;
grant execute on function public.list_public_workshops() to anon,authenticated;
revoke all on function public.get_public_workshop(text) from public;
grant execute on function public.get_public_workshop(text) to anon,authenticated;
