begin;
alter table public.commercial_interactions add column if not exists subject text check (length(subject)<=100);
create table if not exists public.commercial_action_history(
 id uuid primary key default gen_random_uuid(),
 prospect_id uuid not null references public.commercial_prospects(id) on delete restrict,
 previous_action text,previous_date date,next_action text,next_date date,
 created_by uuid references auth.users(id),author_name text not null,
 created_at timestamptz not null default now()
);
create index if not exists commercial_action_history_prospect_idx on public.commercial_action_history(prospect_id,created_at desc,id);
alter table public.commercial_action_history enable row level security;
revoke all on public.commercial_action_history from anon,authenticated;
grant select on public.commercial_action_history to authenticated;
create policy commercial_action_history_admin_read on public.commercial_action_history for select to authenticated using(public.is_admin());
create table if not exists public.commercial_action_requests(id uuid primary key,prospect_id uuid not null references public.commercial_prospects(id) on delete restrict,created_by uuid not null references auth.users(id));
alter table public.commercial_action_requests enable row level security;
revoke all on public.commercial_action_requests from anon,authenticated;

create or replace function public.audit_commercial_action() returns trigger language plpgsql security definer set search_path=public as $$
declare author text;
begin
 if old.next_action is distinct from new.next_action or old.next_action_on is distinct from new.next_action_on then
  select name into author from public.profiles where id=auth.uid();
  insert into public.commercial_action_history(prospect_id,previous_action,previous_date,next_action,next_date,created_by,author_name)
   values(new.id,old.next_action,old.next_action_on,new.next_action,new.next_action_on,auth.uid(),coalesce(author,'Sistema'));
 end if;
 return new;
end $$;
create trigger commercial_action_audit after update of next_action,next_action_on on public.commercial_prospects for each row execute function public.audit_commercial_action();

create or replace function public.change_commercial_action(p_id uuid,p_prospect_id uuid,p_expected_updated_at timestamptz,p_action text,p_due date,p_complete boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare item public.commercial_prospects; previous public.commercial_action_requests;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Acesso restrito ao administrador.'; end if;
 select * into item from public.commercial_prospects where id=p_prospect_id for update;
 if not found then raise exception 'Cliente não encontrado.'; end if;
 select * into previous from public.commercial_action_requests where id=p_id;
 if found then
  if previous.created_by<>auth.uid() or previous.prospect_id<>p_prospect_id then raise exception 'Identificação já utilizada.'; end if;
  return p_id;
 end if;
 if item.updated_at is distinct from p_expected_updated_at then raise exception 'O cliente mudou em outra tela. Atualize a ficha antes de salvar.'; end if;
 if p_complete is null then raise exception 'Informe a operação.'; end if;
 if not p_complete and (p_action is null or length(trim(p_action)) not between 1 and 100 or p_due is null) then raise exception 'Informe ação e data de retorno.'; end if;
 if p_complete and nullif(trim(item.next_action),'') is null then raise exception 'Não há ação pendente.'; end if;
 insert into public.commercial_action_requests values(p_id,p_prospect_id,auth.uid());
 update public.commercial_prospects set next_action=case when p_complete then null else trim(p_action) end,next_action_on=case when p_complete then null else p_due end where id=p_prospect_id;
 return p_id;
end $$;
revoke all on function public.change_commercial_action(uuid,uuid,timestamptz,text,date,boolean) from public,anon;
grant execute on function public.change_commercial_action(uuid,uuid,timestamptz,text,date,boolean) to authenticated;

create or replace function public.record_commercial_interaction_v2(p_id uuid,p_prospect_id uuid,p_contacted_at timestamptz,p_channel text,p_contact_name text,p_summary text,p_subject text,p_complete boolean,p_expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
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
 if p_subject is null or length(trim(p_subject)) not between 1 and 100 then raise exception 'Informe o assunto (até 100 caracteres).'; end if;
 if p_complete and item.updated_at is distinct from p_expected_updated_at then raise exception 'O cliente mudou em outra tela. Atualize a ficha antes de salvar.'; end if;
 if p_complete and nullif(trim(item.next_action),'') is null then raise exception 'Não há ação pendente.'; end if;
 perform public.record_commercial_interaction(p_id,p_prospect_id,p_contacted_at,p_channel,p_contact_name,p_summary,false,null,null);
 update public.commercial_interactions set subject=trim(p_subject) where id=p_id;
 if p_complete then update public.commercial_prospects set next_action=null,next_action_on=null where id=p_prospect_id; end if;
 return p_id;
end $$;
revoke all on function public.record_commercial_interaction_v2(uuid,uuid,timestamptz,text,text,text,text,boolean,timestamptz) from public,anon;
grant execute on function public.record_commercial_interaction_v2(uuid,uuid,timestamptz,text,text,text,text,boolean,timestamptz) to authenticated;
commit;
