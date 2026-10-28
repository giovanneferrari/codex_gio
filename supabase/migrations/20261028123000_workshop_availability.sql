create or replace function public.get_workshop_availability(p_workshop_slug text)
returns table(capacity integer, confirmed bigint, remaining integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.capacity,
    count(r.id) filter (where r.confirmed = true) as confirmed,
    greatest(w.capacity - count(r.id) filter (where r.confirmed = true), 0)::integer as remaining
  from public.workshops w
  left join public.workshop_registrations r on r.workshop_id = w.id
  where w.slug = p_workshop_slug and w.active = true and w.event_date >= current_date
  group by w.id, w.capacity;
$$;

revoke all on function public.get_workshop_availability(text) from public;
grant execute on function public.get_workshop_availability(text) to anon, authenticated;
