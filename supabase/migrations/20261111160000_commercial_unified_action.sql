begin;
alter table public.commercial_interactions add column if not exists stage_after text;
alter table public.commercial_interactions add column if not exists completed_action text;
alter table public.commercial_interactions add column if not exists completed_action_on date;
create or replace function public.record_commercial_followup_v2(
 p_id uuid,p_prospect_id uuid,p_contacted_at timestamptz,p_channel text,
 p_contact_name text,p_summary text,p_stage text,p_no_next boolean,
 p_next_action text,p_next_date date,p_expected_updated_at timestamptz
) returns uuid language plpgsql security definer set search_path=public as $$
declare item public.commercial_prospects; previous public.commercial_interactions;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Acesso restrito ao administrador.'; end if;
 select * into item from public.commercial_prospects where id=p_prospect_id for update;
 if not found then raise exception 'Cliente não encontrado.'; end if;
 select * into previous from public.commercial_interactions where id=p_id;
 if found then
  if previous.created_by<>auth.uid() or previous.prospect_id<>p_prospect_id then raise exception 'Identificação já utilizada.'; end if;
  return p_id;
 end if;
 if item.updated_at is distinct from p_expected_updated_at then raise exception 'O cliente mudou em outra tela. Reabra a ficha antes de salvar.'; end if;
 if p_stage is null or p_stage not in ('mapped','contacted','replied','visit','proposal','confirmed','client','paused','lost') then raise exception 'Status inválido.'; end if;
 if p_no_next is null then raise exception 'Informe se haverá próximo passo.'; end if;
 if not p_no_next and (p_next_action is null or length(trim(p_next_action)) not between 1 and 100 or p_next_date is null) then raise exception 'Informe próximo passo e data.'; end if;
 -- A função anterior grava o contato e conclui a ação dentro desta mesma transação.
 perform public.record_commercial_interaction_v2(p_id,p_prospect_id,p_contacted_at,p_channel,p_contact_name,p_summary,left(trim(p_summary),100),nullif(trim(item.next_action),'') is not null,p_expected_updated_at);
 update public.commercial_interactions set stage_after=p_stage,completed_action=item.next_action,completed_action_on=item.next_action_on,
  next_action=case when p_no_next then null else trim(p_next_action) end,
  next_action_on=case when p_no_next then null else p_next_date end where id=p_id;
 -- Mesmo quando não havia ação, elimina eventual data órfã.
 update public.commercial_prospects set stage=p_stage,next_action=case when p_no_next then null else trim(p_next_action) end,
  next_action_on=case when p_no_next then null else p_next_date end where id=p_prospect_id;
 return p_id;
end $$;
revoke all on function public.record_commercial_followup_v2(uuid,uuid,timestamptz,text,text,text,text,boolean,text,date,timestamptz) from public,anon;
grant execute on function public.record_commercial_followup_v2(uuid,uuid,timestamptz,text,text,text,text,boolean,text,date,timestamptz) to authenticated;
commit;
