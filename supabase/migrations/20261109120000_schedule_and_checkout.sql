-- Executar antes de publicar o frontend. Preserva clientes já conquistados.
begin;
create or replace function public.sync_prospect_from_schedule()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.prospect_id is not null then
    update public.commercial_prospects
      set stage = case when stage='client' then stage
                       when new.confirmation_status='confirmed' then 'confirmed'
                       when stage='confirmed' then stage else 'proposal' end,
          next_action = case when stage in ('client','confirmed') and new.confirmation_status<>'confirmed' then next_action
                             when stage='client' then next_action
                             when new.confirmation_status='confirmed' then 'Preparar evento confirmado'
                             else 'Confirmar evento pendente' end,
          next_action_on = case when stage='client' then next_action_on else new.event_date end
      where id=new.prospect_id;
  end if;
  return new;
end;
$$;

-- A cobrança pode ser definida na entrega, mas vendas finalizadas precisam dela.
create or replace function public.validate_finished_order_payment()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='Finalizado' and new.confirmed_total>0 then
    if tg_op='UPDATE' then
      if old.status='Finalizado' and old.confirmed_total is not distinct from new.confirmed_total
         and old.payment_method_id is not distinct from new.payment_method_id then return new; end if;
    end if;
    if new.payment_method_id is null then
      raise exception 'Selecione uma forma de pagamento para finalizar o pedido.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validate_finished_order_payment on public.orders;
create trigger validate_finished_order_payment before insert or update on public.orders
for each row execute function public.validate_finished_order_payment();
commit;
