-- F-07: anak dan ART masuk dengan PIN di perangkat yang sudah login orang tua.
-- PIN disimpan sebagai hash bcrypt. Setelah 5 kali salah, PIN terkunci sampai orang tua
-- membuat PIN baru.
create extension if not exists pgcrypto with schema extensions;

alter table public.members
  add column has_pin boolean generated always as (pin_hash is not null) stored,
  add column pin_failed_attempts smallint not null default 0,
  add column pin_locked boolean not null default false;

grant select (has_pin, pin_locked) on public.members to authenticated;

create function public.set_member_pin(member_id uuid, pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_parent() then
    raise exception 'Hanya ayah atau ibu yang bisa mengatur PIN' using errcode = 'insufficient_privilege';
  end if;

  if pin is null or pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN harus 4 sampai 6 angka' using errcode = 'check_violation';
  end if;

  update public.members m
  set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf')),
      pin_failed_attempts = 0,
      pin_locked = false
  where m.id = set_member_pin.member_id
    and m.family_id = (private.my_member()).family_id
    and m.role in ('child', 'art')
    and m.deleted_at is null;

  if not found then
    raise exception 'PIN hanya untuk anak dan ART di keluarga ini' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Mengembalikan true jika PIN benar. PIN salah menambah hitungan; yang ke-5 mengunci.
create function public.verify_member_pin(member_id uuid, pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.members;
begin
  select * into target
  from public.members m
  where m.id = verify_member_pin.member_id
    and m.family_id = (private.my_member()).family_id
    and m.role in ('child', 'art')
    and m.pin_hash is not null
    and m.deleted_at is null
    and m.is_active;

  if target.id is null then
    raise exception 'Anggota tidak ditemukan' using errcode = 'no_data_found';
  end if;

  if target.pin_locked then
    raise exception 'PIN terkunci. Minta ayah atau ibu membuat PIN baru.' using errcode = 'insufficient_privilege';
  end if;

  if extensions.crypt(pin, target.pin_hash) = target.pin_hash then
    update public.members set pin_failed_attempts = 0 where id = target.id;
    return true;
  end if;

  update public.members
  set pin_failed_attempts = pin_failed_attempts + 1,
      pin_locked = pin_failed_attempts + 1 >= 5
  where id = target.id;
  return false;
end;
$$;

revoke all on function public.set_member_pin(uuid, text) from public, anon;
revoke all on function public.verify_member_pin(uuid, text) from public, anon;
grant execute on function public.set_member_pin(uuid, text) to authenticated;
grant execute on function public.verify_member_pin(uuid, text) to authenticated;
