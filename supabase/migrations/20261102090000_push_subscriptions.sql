-- P-01: pengingat lewat push notification (pengganti Telegram, keputusan brainstorm 27 Okt).
-- Satu HP bisa menerima pengingat beberapa anggota, misalnya HP ayah/ibu juga menerima
-- pengingat si kecil. Satu baris per HP (endpoint) per anggota.

create table public.push_subscriptions (
  endpoint text not null,
  member_id uuid not null references public.members (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  primary key (endpoint, member_id)
);

-- Hanya lewat fungsi di bawah; kunci langganan tidak bisa dibaca aplikasi.
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to service_role;

-- Menyimpan langganan HP ini untuk anggota yang dipilih (menggantikan pilihan sebelumnya).
-- Diri sendiri, atau (ayah/ibu) anggota keluarganya. Bahasa pesan ikut bahasa aplikasi.
create function public.set_push_subscription(
  endpoint text,
  p256dh text,
  auth text,
  member_ids uuid[],
  language text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
begin
  if me.id is null then
    raise exception 'Belum masuk' using errcode = 'insufficient_privilege';
  end if;
  if language not in ('id', 'en') then
    raise exception 'Bahasa harus id atau en' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from unnest(member_ids) as x(id)
    where not exists (
      select 1 from public.members m
      where m.id = x.id
        and m.family_id = me.family_id
        and m.deleted_at is null
        and (m.id = me.id or me.role in ('father', 'mother'))
    )
  ) then
    raise exception 'Anggota tidak ditemukan' using errcode = 'no_data_found';
  end if;

  delete from public.push_subscriptions s
  where s.endpoint = set_push_subscription.endpoint and s.family_id = me.family_id;

  insert into public.push_subscriptions (endpoint, member_id, family_id, p256dh, auth)
  select set_push_subscription.endpoint, x.id, me.family_id,
    set_push_subscription.p256dh, set_push_subscription.auth
  from unnest(member_ids) as x(id);

  update public.members m
  set language = set_push_subscription.language
  where m.id = any (member_ids);
end;
$$;

-- Anggota yang pengingatnya diterima HP ini.
create function public.push_members(endpoint text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.member_id from public.push_subscriptions s
  where s.endpoint = push_members.endpoint
    and s.family_id = (private.my_member()).family_id;
$$;

revoke all on function public.set_push_subscription(text, text, text, uuid[], text) from public, anon;
grant execute on function public.set_push_subscription(text, text, text, uuid[], text) to authenticated;
revoke all on function public.push_members(text) from public, anon;
grant execute on function public.push_members(text) to authenticated;
