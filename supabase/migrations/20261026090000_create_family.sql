-- F-05: ayah yang baru mendaftar membuat keluarganya sendiri.
-- Dipanggil aplikasi setelah login pertama. Satu akun hanya boleh punya satu keluarga.
create function public.create_family(family_name text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Harus login dulu' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.members where auth_user_id = auth.uid()) then
    raise exception 'Akun ini sudah terdaftar di sebuah keluarga' using errcode = 'unique_violation';
  end if;

  if coalesce(trim(family_name), '') = '' or coalesce(trim(display_name), '') = '' then
    raise exception 'Nama keluarga dan nama ayah wajib diisi' using errcode = 'check_violation';
  end if;

  insert into public.families (name) values (trim(family_name))
  returning id into new_family_id;

  insert into public.members (family_id, auth_user_id, display_name, role)
  values (new_family_id, auth.uid(), trim(display_name), 'father');

  return new_family_id;
end;
$$;

revoke all on function public.create_family(text, text) from public, anon;
grant execute on function public.create_family(text, text) to authenticated;
