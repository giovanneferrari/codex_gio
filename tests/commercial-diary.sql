-- Teste transacional: todos os registros de teste são revertidos ao final.
begin;
do $$
declare admin_id uuid; prospect uuid:=gen_random_uuid(); interaction uuid:=gen_random_uuid(); n integer;
begin
 select id into admin_id from public.profiles where role='admin' limit 1;
 if admin_id is null then raise exception 'Administrador necessário para testar.'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.commercial_prospects(id,company_name,next_action,notes) values(prospect,'Teste transacional do diário','Ação anterior','Contexto preservado');
 perform public.record_commercial_interaction(interaction,prospect,now(),'WhatsApp','Contato de teste','Conversa de teste',true,'Retornar',current_date+1);
 perform public.record_commercial_interaction(interaction,prospect,now(),'WhatsApp','Contato de teste','Conversa de teste',true,'Retornar',current_date+1);
 select count(*) into n from public.commercial_interactions where prospect_id=prospect;
 if n<>1 then raise exception 'Repetição duplicou o contato.'; end if;
 if not exists(select 1 from public.commercial_prospects where id=prospect and next_action='Retornar' and notes='Contexto preservado') then raise exception 'Ação/contexto incorretos.'; end if;
 perform public.record_commercial_interaction(gen_random_uuid(),prospect,now(),'Ligação','Contato de teste','Segunda troca',false);
 if not exists(select 1 from public.commercial_prospects where id=prospect and next_action='Retornar') then raise exception 'Próxima ação foi apagada.'; end if;
 begin
  perform public.record_commercial_interaction(gen_random_uuid(),prospect,now(),'Inválido','Contato','Inválido',true,'Não pode atualizar',current_date);
  raise exception 'Canal inválido aceito';
 exception when check_violation then null;
 end;
 if not exists(select 1 from public.commercial_prospects where id=prospect and next_action='Retornar') then raise exception 'Falha alterou a ação.'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.record_commercial_interaction(gen_random_uuid(),prospect,now(),'WhatsApp','Contato','Sem autorização');
  raise exception 'Acesso anônimo aceito';
 exception when others then
  if sqlerrm<>'Acesso restrito ao administrador.' then raise; end if;
 end;
 if has_table_privilege('authenticated','public.commercial_interactions','INSERT') then raise exception 'Inserção direta indevida.'; end if;
 if not exists(select 1 from pg_class where oid='public.commercial_interactions'::regclass and relrowsecurity) then raise exception 'RLS desativado.'; end if;
end $$;
rollback;
select 'OK: gravação, repetição segura, preservação, atomicidade e bloqueio anônimo; teste revertido' as resultado;
