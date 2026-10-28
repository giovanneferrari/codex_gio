create or replace function public.register_workshop_participant(
  p_workshop_slug text,
  p_full_name text,
  p_whatsapp text,
  p_dietary_restriction text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_workshop public.workshops;
  registration_id uuid;
  clean_name text := trim(coalesce(p_full_name, ''));
  clean_phone text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  clean_restriction text := nullif(trim(coalesce(p_dietary_restriction, '')), '');
begin
  select * into selected_workshop
  from public.workshops
  where slug = p_workshop_slug and active = true and event_date >= current_date;

  if selected_workshop.id is null then raise exception 'Workshop indisponível para inscrições.'; end if;
  if char_length(clean_name) < 3 or char_length(clean_name) > 100 then raise exception 'Informe o nome completo.'; end if;
  if char_length(clean_phone) < 10 or char_length(clean_phone) > 13 then raise exception 'Informe um WhatsApp válido.'; end if;
  if clean_restriction is not null and char_length(clean_restriction) > 240 then raise exception 'A restrição alimentar deve ter até 240 caracteres.'; end if;
  if selected_workshop.capacity is not null and (select count(*) from public.workshop_registrations where workshop_id = selected_workshop.id and confirmed = true) >= selected_workshop.capacity then raise exception 'As vagas deste workshop foram preenchidas.'; end if;

  insert into public.workshop_registrations (workshop_id,full_name,whatsapp,dietary_restriction)
  values (selected_workshop.id,clean_name,clean_phone,clean_restriction)
  returning id into registration_id;
  return registration_id;
exception when unique_violation then raise exception 'Este WhatsApp já está inscrito no workshop.';
end;
$$;

revoke all on function public.register_workshop_participant(text,text,text,text) from public;
grant execute on function public.register_workshop_participant(text,text,text,text) to anon, authenticated;
