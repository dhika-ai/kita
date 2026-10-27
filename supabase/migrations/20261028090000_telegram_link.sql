-- R-02: anggota menghubungkan Telegram dengan kode sekali pakai (tanpa nomor HP).
-- Aplikasi membuat kode, anggota membuka bot lewat tautan t.me/<bot>?start=<kode>,
-- lalu bot (Edge Function, role service_role) menukar kode itu dengan chat_id.

-- chat_id tetap tidak bisa dibaca aplikasi; cukup status terhubung atau belum.
alter table public.members
  add column telegram_connected boolean generated always as (telegram_chat_id is not null) stored;
grant select (telegram_connected, language) on public.members to authenticated;

-- Di schema private supaya tidak terbuka lewat API.
create table private.telegram_link_codes (
  code text primary key,
  member_id uuid not null references public.members (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);

-- Membuat kode untuk diri sendiri, atau (ayah/ibu) untuk anggota keluarganya.
-- Bahasa pesan Telegram ikut bahasa aplikasi saat tombol ditekan.
create function public.create_telegram_link_code(member_id uuid, language text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
  new_code text := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
begin
  if language not in ('id', 'en') then
    raise exception 'Bahasa harus id atau en' using errcode = 'check_violation';
  end if;

  update public.members m
  set language = create_telegram_link_code.language
  where m.id = create_telegram_link_code.member_id
    and m.family_id = me.family_id
    and m.deleted_at is null
    and (m.id = me.id or me.role in ('father', 'mother'));

  if not found then
    raise exception 'Anggota tidak ditemukan' using errcode = 'no_data_found';
  end if;

  delete from private.telegram_link_codes c where c.member_id = create_telegram_link_code.member_id;
  insert into private.telegram_link_codes (code, member_id)
  values (new_code, create_telegram_link_code.member_id);
  return new_code;
end;
$$;

revoke all on function public.create_telegram_link_code(uuid, text) from public, anon;
grant execute on function public.create_telegram_link_code(uuid, text) to authenticated;

-- Dipanggil bot. Kode yang benar dan belum kedaluwarsa dipakai sekali, lalu dihapus.
-- Mengembalikan nama dan bahasa anggota, atau kosong jika kode tidak berlaku.
create function public.link_telegram(code text, chat_id bigint)
returns table (display_name text, language text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  valid boolean;
begin
  delete from private.telegram_link_codes c
  where c.code = upper(trim(link_telegram.code))
  returning c.member_id, c.expires_at > now() into target, valid;

  if not coalesce(valid, false) then
    return;
  end if;

  return query
  update public.members m
  set telegram_chat_id = link_telegram.chat_id
  where m.id = target and m.deleted_at is null
  returning m.display_name, m.language;
end;
$$;

revoke all on function public.link_telegram(text, bigint) from public, anon, authenticated;
grant execute on function public.link_telegram(text, bigint) to service_role;
