-- Transação isolada: todos os dados de teste são revertidos.
begin;
do $$
declare admin_id uuid; prospect uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); contact uuid:=gen_random_uuid(); version timestamptz; n integer;
begin
 select id into admin_id from public.profiles where role='admin' limit 1;
 if admin_id is null then raise exception 'Administrador necessário.'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.commercial_prospects(id,company_name,next_action,next_action_on,notes) values(prospect,'Teste transacional de prioridades','Ligar',current_date-1,'Preservar contexto') returning updated_at into version;
 perform public.change_commercial_action(req,prospect,version,'Retornar',current_date+1,false);
 perform public.change_commercial_action(req,prospect,version,'Retornar',current_date+1,false);
 select count(*) into n from public.commercial_action_history where prospect_id=prospect;
 if n<>1 then raise exception 'Repetição duplicou o histórico.'; end if;
 begin
  perform public.change_commercial_action(gen_random_uuid(),prospect,version-interval '1 day',null,null,true);
  raise exception 'Versão desatualizada foi aceita';
 exception when others then
  if sqlerrm<>'O cliente mudou em outra tela. Atualize a ficha antes de salvar.' then raise; end if;
 end;
 select updated_at into version from public.commercial_prospects where id=prospect;
 perform public.record_commercial_interaction_v2(contact,prospect,now(),'WhatsApp','Contato teste','Conversa preservada','Alinhamento',true,version);
 perform public.record_commercial_interaction_v2(contact,prospect,now(),'WhatsApp','Contato teste','Conversa preservada','Alinhamento',true,version);
 if not exists(select 1 from public.commercial_interactions where id=contact and subject='Alinhamento') then raise exception 'Contato ausente'; end if;
 if not exists(select 1 from public.commercial_prospects where id=prospect and next_action is null and next_action_on is null and notes='Preservar contexto') then raise exception 'Conclusão/contexto inválidos'; end if;
 select count(*) into n from public.commercial_action_history where prospect_id=prospect;
 if n<>2 then raise exception 'Conclusão não auditada'; end if;
 -- Valida a leitura como papel autenticado administrador.
 perform set_config('role','authenticated',true);
 select count(*) into n from public.commercial_action_history where prospect_id=prospect;
 if n<>2 then raise exception 'Administrador não leu histórico'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 select count(*) into n from public.commercial_action_history where prospect_id=prospect;
 if n<>0 then raise exception 'RLS expôs histórico sem administrador'; end if;
 begin
  perform public.change_commercial_action(gen_random_uuid(),prospect,version,'Indevida',current_date,false);
  raise exception 'Acesso sem administrador aceito';
 exception when others then
  if sqlerrm<>'Acesso restrito ao administrador.' then raise; end if;
 end;
 perform set_config('role','postgres',true);
end $$;
rollback;
select 'OK: reagendamento, conclusão, histórico, concorrência, idempotência e RLS; dados revertidos' as resultado;
