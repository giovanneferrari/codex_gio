create table if not exists public.workshop_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 140),
  category text not null default 'Outros' check (category in ('Espaço','Estrutura','Insumos','Brindes','Comunicação','Equipe','Outros')),
  completed boolean not null default false,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workshop_checklist_workshop_idx
  on public.workshop_checklist_items (workshop_id, completed, sort_order, created_at);

alter table public.workshop_checklist_items enable row level security;
grant select, insert, update, delete on public.workshop_checklist_items to authenticated;

drop policy if exists "workshop_checklist_authenticated_read" on public.workshop_checklist_items;
create policy "workshop_checklist_authenticated_read" on public.workshop_checklist_items
  for select to authenticated using (true);

drop policy if exists "workshop_checklist_authenticated_write" on public.workshop_checklist_items;
create policy "workshop_checklist_authenticated_write" on public.workshop_checklist_items
  for all to authenticated using (true) with check (true);

create or replace function public.touch_workshop_checklist_item()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.completed = true and (old.completed = false or old.completed is null) then
    new.completed_at := now();
  elsif new.completed = false then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists workshop_checklist_item_touch on public.workshop_checklist_items;
create trigger workshop_checklist_item_touch before update on public.workshop_checklist_items
for each row execute function public.touch_workshop_checklist_item();
