-- Diário aditivo: não altera pedidos, estoque nem observações existentes.
begin;
create table if not exists public.commercial_interactions (
 id uuid primary key,
 prospect_id uuid not null references public.commercial_prospects(id) on delete restrict,
 contacted_at timestamptz not null,
 channel text not null check (channel in ('WhatsApp','Ligação','Visita','Instagram','E-mail','Outro')),
 contact_name text not null check (length(trim(contact_name)) between 1 and 100),
 summary text not null check (length(trim(summary)) between 1 and 4000),
 next_action text,
 next_action_on date,
 created_by uuid not null references auth.users(id),
 author_name text not null,
 created_at timestamptz not null default now()
);
create index if not exists commercial_interactions_history_idx on public.commercial_interactions(prospect_id,contacted_at desc,id);
alter table public.commercial_interactions enable row level security;
revoke all on public.commercial_interactions from anon, authenticated;
grant select on public.commercial_interactions to authenticated;
drop policy if exists commercial_interactions_admin_read on public.commercial_interactions;
create policy commercial_interactions_admin_read on public.commercial_interactions for select to authenticated using (public.is_admin());

create or replace function public.record_commercial_interaction(
 p_id uuid, p_prospect_id uuid, p_contacted_at timestamptz, p_channel text,
 p_contact_name text, p_summary text, p_update_next boolean default false,
 p_next_action text default null, p_next_action_on date default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare author text; existing public.commercial_interactions;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Acesso restrito ao administrador.'; end if;
 if p_id is null or p_contacted_at is null then raise exception 'Informe identificação, data e horário.'; end if;
 -- Serializa registros por cliente e permite repetir com segurança uma requisição sem resposta.
 perform 1 from public.commercial_prospects where id=p_prospect_id for update;
 if not found then raise exception 'Cliente não encontrado.'; end if;
 select * into existing from public.commercial_interactions where id=p_id;
 if found then
  if existing.created_by<>auth.uid() or existing.prospect_id<>p_prospect_id then raise exception 'Identificação já utilizada.'; end if;
  return existing.id;
 end if;
 if p_update_next and (p_next_action is null or length(trim(p_next_action)) not between 1 and 100) then raise exception 'Informe a próxima ação (até 100 caracteres).'; end if;
 select coalesce(nullif(trim(name),''),'Administrador') into author from public.profiles where id=auth.uid();
 insert into public.commercial_interactions(id,prospect_id,contacted_at,channel,contact_name,summary,next_action,next_action_on,created_by,author_name)
 values(p_id,p_prospect_id,p_contacted_at,p_channel,trim(p_contact_name),trim(p_summary),case when p_update_next then trim(p_next_action) end,case when p_update_next then p_next_action_on end,auth.uid(),coalesce(author,'Administrador'));
 if p_update_next then
  update public.commercial_prospects set next_action=trim(p_next_action),next_action_on=p_next_action_on where id=p_prospect_id;
 end if;
 return p_id;
end $$;
revoke all on function public.record_commercial_interaction(uuid,uuid,timestamptz,text,text,text,boolean,text,date) from public, anon;
grant execute on function public.record_commercial_interaction(uuid,uuid,timestamptz,text,text,text,boolean,text,date) to authenticated;
commit;
