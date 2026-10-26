-- F-06: ayah (pemilik akun keluarga) menambah anggota (maks 5, dijaga trigger dari F-04),
-- mengatur peran, dan membagikan link undangan untuk anggota yang punya akun sendiri.
alter table public.members add column invite_code text unique;
grant select (invite_code) on public.members to authenticated;

-- Benar jika pengguna yang login adalah ayah atau ibu (dipakai fitur orang tua berikutnya).
create function private.is_parent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.my_member()).role in ('father', 'mother'), false);
$$;

revoke all on function private.is_parent() from public, anon;
grant execute on function private.is_parent() to authenticated;

create function public.add_member(display_name text, role public.member_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_member_id uuid;
begin
  if (private.my_member()).role is distinct from 'father' then
    raise exception 'Hanya ayah yang bisa menambah anggota' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(display_name), '') = '' then
    raise exception 'Nama anggota wajib diisi' using errcode = 'check_violation';
  end if;

  insert into public.members (family_id, display_name, role, invite_code)
  values (
    (private.my_member()).family_id,
    trim(display_name),
    role,
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  )
  returning id into new_member_id;

  return new_member_id;
end;
$$;

create function public.set_member_role(member_id uuid, role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (private.my_member()).role is distinct from 'father' then
    raise exception 'Hanya ayah yang bisa mengatur peran' using errcode = 'insufficient_privilege';
  end if;

  if member_id = (private.my_member()).id then
    raise exception 'Tidak bisa mengubah peran sendiri' using errcode = 'check_violation';
  end if;

  update public.members m
  set role = set_member_role.role
  where m.id = set_member_role.member_id
    and m.family_id = (private.my_member()).family_id
    and m.deleted_at is null;

  if not found then
    raise exception 'Anggota tidak ditemukan' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Dipanggil anggota yang mendaftar lewat link undangan.
create function public.join_family(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  joined_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Harus login dulu' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.members where auth_user_id = auth.uid()) then
    raise exception 'Akun ini sudah terdaftar di sebuah keluarga' using errcode = 'unique_violation';
  end if;

  update public.members m
  set auth_user_id = auth.uid(), invite_code = null
  where m.invite_code = join_family.invite_code
    and m.auth_user_id is null
    and m.deleted_at is null
  returning m.family_id into joined_family_id;

  if joined_family_id is null then
    raise exception 'Link undangan tidak berlaku' using errcode = 'no_data_found';
  end if;

  return joined_family_id;
end;
$$;

revoke all on function public.add_member(text, public.member_role) from public, anon;
revoke all on function public.set_member_role(uuid, public.member_role) from public, anon;
revoke all on function public.join_family(text) from public, anon;
grant execute on function public.add_member(text, public.member_role) to authenticated;
grant execute on function public.set_member_role(uuid, public.member_role) to authenticated;
grant execute on function public.join_family(text) to authenticated;
