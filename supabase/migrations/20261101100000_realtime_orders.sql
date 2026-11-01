-- Garante a publicação dos pedidos no Supabase Realtime em todos os ambientes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;

-- O estado completo permite que alterações e exclusões sejam propagadas de forma confiável.
alter table public.orders replica identity full;
alter table public.order_items replica identity full;
