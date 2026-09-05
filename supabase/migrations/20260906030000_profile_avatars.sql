alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "profile_avatars_public_read" on storage.objects;
create policy "profile_avatars_public_read"
on storage.objects for select to public
using (bucket_id='profile-avatars');

drop policy if exists "profile_avatars_own_insert" on storage.objects;
create policy "profile_avatars_own_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "profile_avatars_own_update" on storage.objects;
create policy "profile_avatars_own_update"
on storage.objects for update to authenticated
using (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
)
with check (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "profile_avatars_own_delete" on storage.objects;
create policy "profile_avatars_own_delete"
on storage.objects for delete to authenticated
using (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop function if exists public.update_own_profile(text);
create function public.update_own_profile(p_name text,p_avatar_url text default null)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare updated_profile public.profiles;
begin
  update public.profiles
  set name=trim(p_name),avatar_url=coalesce(p_avatar_url,avatar_url)
  where id=auth.uid() and length(trim(p_name))>0
  returning * into updated_profile;
  if updated_profile.id is null then raise exception 'Não foi possível atualizar o perfil.'; end if;
  return updated_profile;
end; $$;

revoke all on function public.update_own_profile(text,text) from public,anon;
grant execute on function public.update_own_profile(text,text) to authenticated;
