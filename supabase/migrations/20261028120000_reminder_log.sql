-- R-05: catatan pengiriman pengingat, coba ulang 1x setelah 5 menit, dan mute per slot.

-- Anggota bisa mematikan pengingat pagi atau sore.
alter table public.members
  add column telegram_mute_morning boolean not null default false,
  add column telegram_mute_evening boolean not null default false;
grant select (telegram_mute_morning, telegram_mute_evening) on public.members to authenticated;

-- Satu baris per anggota per slot per hari. Hanya Edge Function (service_role) yang menulis.
create table public.reminder_log (
  member_id uuid not null references public.members (id) on delete cascade,
  slot text not null check (slot in ('morning', 'evening')),
  for_date date not null,
  status text not null check (status in ('sent', 'failed')),
  attempts smallint not null default 1,
  error text,
  updated_at timestamptz not null default now(),
  primary key (member_id, slot, for_date)
);

alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;
grant select, insert, update on public.reminder_log to service_role;

-- Mencatat hasil satu kiriman (error kosong = terkirim) dan menambah hitungan percobaan.
create function public.log_reminder(
  member_id uuid,
  slot text,
  error text default null,
  for_date date default (now() at time zone 'Asia/Jakarta')::date
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.reminder_log as l (member_id, slot, for_date, status, error)
  values (member_id, slot, for_date, case when error is null then 'sent' else 'failed' end, error)
  on conflict (member_id, slot, for_date) do update
    set status = excluded.status,
        error = excluded.error,
        attempts = l.attempts + 1,
        updated_at = now();
$$;

revoke all on function public.log_reminder(uuid, text, text, date) from public, anon, authenticated;
grant execute on function public.log_reminder(uuid, text, text, date) to service_role;

-- Pesan yang masih perlu dikirim: belum terkirim, belum 2 kali gagal, dan slot tidak dimute.
-- Jadwal kedua 5 menit kemudian hanya akan menemukan yang gagal di percobaan pertama.
create or replace function public.reminder_messages(
  slot text,
  for_date date default (now() at time zone 'Asia/Jakarta')::date
)
returns table (member_id uuid, chat_id bigint, text text)
language sql
stable
security definer
set search_path = ''
as $$
  -- Nama parameter ditulis lengkap karena reminder_log punya kolom slot dan for_date.
  select m.id, m.telegram_chat_id,
    private.reminder_text(m.id, reminder_messages.slot, reminder_messages.for_date)
  from public.members m
  left join public.reminder_log l
    on l.member_id = m.id and l.slot = reminder_messages.slot and l.for_date = reminder_messages.for_date
  where reminder_messages.slot in ('morning', 'evening')
    and m.telegram_chat_id is not null
    and m.is_active
    and m.deleted_at is null
    and not (case when reminder_messages.slot = 'morning' then m.telegram_mute_morning
      else m.telegram_mute_evening end)
    and (l.member_id is null or (l.status = 'failed' and l.attempts < 2));
$$;

-- Mute/unmute: diri sendiri, atau ayah/ibu untuk anggota keluarganya.
create function public.set_telegram_mute(member_id uuid, slot text, muted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
begin
  update public.members m
  set telegram_mute_morning = case when slot = 'morning' then muted else m.telegram_mute_morning end,
      telegram_mute_evening = case when slot = 'evening' then muted else m.telegram_mute_evening end
  where m.id = set_telegram_mute.member_id
    and m.family_id = me.family_id
    and m.deleted_at is null
    and (m.id = me.id or me.role in ('father', 'mother'))
    and slot in ('morning', 'evening');

  if not found then
    raise exception 'Anggota tidak ditemukan' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.set_telegram_mute(uuid, text, boolean) from public, anon;
grant execute on function public.set_telegram_mute(uuid, text, boolean) to authenticated;

-- Coba ulang 5 menit setelah jadwal utama (R-04), memakai perintah yang sama.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'kita-reminder-morning') then
    perform cron.schedule('kita-reminder-morning-retry', '5 0 * * *',
      (select command from cron.job where jobname = 'kita-reminder-morning'));
    perform cron.schedule('kita-reminder-evening-retry', '5 10 * * *',
      (select command from cron.job where jobname = 'kita-reminder-evening'));
  end if;
end;
$$;
