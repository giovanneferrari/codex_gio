-- Contas, cartoes empresariais e separacao entre competencia e caixa.

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  account_type text not null check (account_type in ('cash','bank','wallet')),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.company_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  payment_account_id uuid references public.financial_accounts(id) on delete restrict,
  closing_day integer not null check (closing_day between 1 and 28),
  due_day integer not null check (due_day between 1 and 28),
  credit_limit numeric(14,2) check (credit_limit is null or credit_limit >= 0),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.financial_entries
  add column if not exists competency_on date,
  add column if not exists due_on date,
  add column if not exists settled_on date,
  add column if not exists payment_status text not null default 'settled',
  add column if not exists payment_method_type text not null default 'direct',
  add column if not exists account_id uuid references public.financial_accounts(id) on delete set null,
  add column if not exists card_id uuid references public.company_cards(id) on delete set null,
  add column if not exists invoice_reference date;

update public.financial_entries set
  competency_on=coalesce(competency_on,occurred_on),
  due_on=coalesce(due_on,occurred_on),
  settled_on=case when payment_status='settled' then coalesce(settled_on,occurred_on) else settled_on end;

alter table public.financial_entries alter column competency_on set not null;
alter table public.financial_entries alter column competency_on drop default;
alter table public.financial_entries drop constraint if exists financial_entries_payment_status_check;
alter table public.financial_entries add constraint financial_entries_payment_status_check
  check (payment_status in ('planned','settled'));
alter table public.financial_entries drop constraint if exists financial_entries_payment_method_type_check;
alter table public.financial_entries add constraint financial_entries_payment_method_type_check
  check (payment_method_type in ('direct','credit_card'));

create or replace function public.financial_entry_fill_cash_dates()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.competency_on=coalesce(new.competency_on,new.occurred_on);
  new.due_on=coalesce(new.due_on,new.occurred_on);
  if new.payment_status='settled' then
    new.settled_on=coalesce(new.settled_on,new.due_on,new.occurred_on);
  else
    new.settled_on=null;
  end if;
  return new;
end;
$$;

drop trigger if exists financial_entry_fill_cash_dates_trigger on public.financial_entries;
create trigger financial_entry_fill_cash_dates_trigger
before insert or update of occurred_on,competency_on,due_on,settled_on,payment_status
on public.financial_entries for each row
execute function public.financial_entry_fill_cash_dates();

alter table public.financial_accounts enable row level security;
alter table public.company_cards enable row level security;
grant select,insert,update,delete on public.financial_accounts,public.company_cards to authenticated;
drop policy if exists "financial_accounts_read" on public.financial_accounts;
drop policy if exists "financial_accounts_admin" on public.financial_accounts;
drop policy if exists "company_cards_read" on public.company_cards;
drop policy if exists "company_cards_admin" on public.company_cards;
create policy "financial_accounts_read" on public.financial_accounts for select to authenticated using(true);
create policy "financial_accounts_admin" on public.financial_accounts for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "company_cards_read" on public.company_cards for select to authenticated using(true);
create policy "company_cards_admin" on public.company_cards for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.set_inventory_entry_payment(
  p_movement_id uuid,
  p_payment_method_type text,
  p_account_id uuid,
  p_card_id uuid,
  p_due_on date,
  p_payment_status text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare entry_date date;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem alterar pagamentos.'; end if;
  select occurred_at::date into entry_date from public.inventory_movements where id=p_movement_id;
  update public.financial_entries set
    competency_on=entry_date,
    due_on=coalesce(p_due_on,entry_date),
    payment_status=p_payment_status,
    settled_on=case when p_payment_status='settled' then coalesce(p_due_on,entry_date) else null end,
    payment_method_type=p_payment_method_type,
    account_id=case when p_payment_method_type='direct' then p_account_id else null end,
    card_id=case when p_payment_method_type='credit_card' then p_card_id else null end,
    invoice_reference=case when p_payment_method_type='credit_card' then date_trunc('month',coalesce(p_due_on,entry_date))::date else null end
  where inventory_movement_id=p_movement_id;
end;
$$;

revoke all on function public.set_inventory_entry_payment(uuid,text,uuid,uuid,date,text) from public,anon;
grant execute on function public.set_inventory_entry_payment(uuid,text,uuid,uuid,date,text) to authenticated;

create or replace function public.settle_card_invoice(
  p_card_id uuid,
  p_invoice_reference date,
  p_settled_on date,
  p_account_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  affected integer;
  destination_account uuid;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem pagar faturas.'; end if;
  select coalesce(p_account_id,payment_account_id) into destination_account
  from public.company_cards where id=p_card_id;
  if destination_account is null then raise exception 'Defina a conta usada para pagar a fatura.'; end if;

  update public.financial_entries set
    payment_status='settled',
    settled_on=p_settled_on,
    account_id=destination_account
  where card_id=p_card_id
    and invoice_reference=p_invoice_reference
    and payment_method_type='credit_card'
    and payment_status='planned';
  get diagnostics affected=row_count;
  return affected;
end;
$$;

revoke all on function public.settle_card_invoice(uuid,date,date,uuid) from public,anon;
grant execute on function public.settle_card_invoice(uuid,date,date,uuid) to authenticated;

notify pgrst, 'reload schema';
