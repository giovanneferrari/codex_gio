-- Permite ignorar uma ocorrência recorrente ou encerrar a recorrência a partir de uma competência.

alter table public.financial_entries
  add column if not exists recurrence_until date;

create table if not exists public.financial_recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  source_entry_id uuid not null references public.financial_entries(id) on delete cascade,
  excluded_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  unique(source_entry_id,excluded_on)
);

alter table public.financial_recurrence_exceptions enable row level security;
grant select,insert,delete on public.financial_recurrence_exceptions to authenticated;

drop policy if exists "financial_recurrence_exceptions_read" on public.financial_recurrence_exceptions;
create policy "financial_recurrence_exceptions_read"
on public.financial_recurrence_exceptions for select to authenticated using(true);

drop policy if exists "financial_recurrence_exceptions_admin_write" on public.financial_recurrence_exceptions;
create policy "financial_recurrence_exceptions_admin_write"
on public.financial_recurrence_exceptions for all to authenticated
using(public.is_admin()) with check(public.is_admin());
