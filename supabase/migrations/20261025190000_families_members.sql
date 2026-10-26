-- F-04: tabel inti keluarga dan anggota, plus aturan akses (RLS).
-- Semua tabel keluarga punya family_id; RLS menyaring berdasarkan keluarga milik pengguna yang login.

create type public.member_role as enum ('father', 'mother', 'child', 'art');

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'Asia/Jakarta',
  max_members smallint not null default 5 check (max_members between 1 and 5),
  day_close_time time not null default '21:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null check (length(trim(display_name)) > 0),
  role public.member_role not null,
  pin_hash text,
  language text not null default 'id' check (language in ('id', 'en')),
  telegram_chat_id bigint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index members_family_id_idx on public.members (family_id);

-- updated_at selalu diisi server, dipakai sebagai kursor sync (F-10).
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger families_set_updated_at before update on public.families
  for each row execute function public.set_updated_at();
create trigger members_set_updated_at before update on public.members
  for each row execute function public.set_updated_at();

-- Maksimal anggota aktif per keluarga (default 5), dicek di database.
create function public.enforce_max_members() returns trigger
language plpgsql set search_path = '' as $$
declare
  limit_count smallint;
  current_count integer;
begin
  if new.deleted_at is not null or not new.is_active then
    return new;
  end if;
  select max_members into limit_count from public.families where id = new.family_id for update;
  select count(*) into current_count from public.members
    where family_id = new.family_id and deleted_at is null and is_active and id <> new.id;
  if current_count >= limit_count then
    raise exception 'Keluarga ini sudah punya % anggota (maksimal %)', current_count, limit_count
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger members_enforce_max before insert or update of family_id, is_active, deleted_at
  on public.members for each row execute function public.enforce_max_members();

-- Fungsi bantu untuk policy ada di schema private, yang tidak dibuka lewat API Supabase.
create schema private;
grant usage on schema private to authenticated;

-- Baris anggota milik pengguna yang sedang login.
-- security definer supaya bisa dipakai di dalam policy tabel members tanpa rekursi.
create function private.my_member() returns public.members
language sql stable security definer set search_path = '' as $$
  select m.* from public.members m
  where m.auth_user_id = auth.uid() and m.deleted_at is null and m.is_active
  limit 1;
$$;

revoke all on function private.my_member() from public, anon;
grant execute on function private.my_member() to authenticated;

alter table public.families enable row level security;
alter table public.members enable row level security;

create policy "families: anggota bisa lihat keluarganya" on public.families
  for select to authenticated
  using (id = (private.my_member()).family_id);

create policy "members: anggota bisa lihat anggota keluarganya" on public.members
  for select to authenticated
  using (family_id = (private.my_member()).family_id);

-- Hak akses eksplisit. Penulisan data keluarga & anggota lewat fungsi server (F-05, F-06).
-- pin_hash dan telegram_chat_id tidak pernah bisa dibaca dari aplikasi.
revoke all on public.families, public.members from anon, authenticated;
grant select on public.families to authenticated;
grant select (
  id, family_id, auth_user_id, display_name, role, language, is_active,
  created_at, updated_at, deleted_at
) on public.members to authenticated;
