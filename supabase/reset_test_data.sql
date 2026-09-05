-- RITO: execute uma única vez no SQL Editor para limpar os dados de teste.
-- Preserva usuários, perfis e formas de pagamento.

begin;

delete from public.financial_entries;
delete from public.stock_closing_items;
delete from public.stock_closings;
delete from public.inventory_movements;
delete from public.operation_event_items;
delete from public.order_items;
delete from public.orders;
delete from public.product_recipes;
delete from public.products;
delete from public.inventory_items;
delete from public.operation_events;

do $$
declare sequence_name text;
begin
  select pg_get_serial_sequence('public.orders','order_number') into sequence_name;
  if sequence_name is not null then execute format('alter sequence %s restart with 1',sequence_name); end if;
end $$;

commit;
