-- Fluxo de caixa: saldo inicial, aportes, retiradas e ajustes independentes do DRE.

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('opening','contribution','withdrawal','adjustment_in','adjustment_out')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists cash_movements_single_opening
  on public.cash_movements (movement_type) where movement_type='opening';

alter table public.cash_movements enable row level security;
grant select on public.cash_movements to authenticated;
create policy "cash_movements_read" on public.cash_movements
  for select to authenticated using (true);

create or replace function public.save_cash_movement(
  p_movement_type text,
  p_description text,
  p_amount numeric,
  p_occurred_on date,
  p_notes text default null
)
returns public.cash_movements
language plpgsql
security definer
set search_path=public
as $$
declare saved public.cash_movements;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar o fluxo de caixa.';
  end if;
  if p_movement_type not in ('opening','contribution','withdrawal','adjustment_in','adjustment_out') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  if coalesce(p_amount,0)<=0 then
    raise exception 'Informe um valor maior que zero.';
  end if;

  if p_movement_type='opening' then
    delete from public.cash_movements where movement_type='opening';
  end if;

  insert into public.cash_movements(movement_type,description,amount,occurred_on,notes,created_by)
  values(
    p_movement_type,
    coalesce(nullif(trim(p_description),''),case when p_movement_type='opening' then 'Saldo inicial' else 'Movimentação de caixa' end),
    p_amount,
    coalesce(p_occurred_on,current_date),
    nullif(trim(coalesce(p_notes,'')),''),
    auth.uid()
  ) returning * into saved;
  return saved;
end;
$$;

create or replace function public.delete_cash_movement(p_movement_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar o fluxo de caixa.';
  end if;
  delete from public.cash_movements where id=p_movement_id;
  if not found then raise exception 'Movimentação não encontrada.'; end if;
end;
$$;

revoke all on function public.save_cash_movement(text,text,numeric,date,text) from public,anon;
revoke all on function public.delete_cash_movement(uuid) from public,anon;
grant execute on function public.save_cash_movement(text,text,numeric,date,text) to authenticated;
grant execute on function public.delete_cash_movement(uuid) to authenticated;

do $$ begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='cash_movements'
  ) then
    alter publication supabase_realtime add table public.cash_movements;
  end if;
end $$;

notify pgrst, 'reload schema';
