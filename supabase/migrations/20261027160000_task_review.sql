-- T-08: orang tua menyetujui atau menolak tugas yang sudah dicentang, dan hari ditutup
-- pukul 21:00 WIB. Tugas yang belum direview tetap menunggu, tidak pernah disetujui otomatis.

alter table public.task_instances add column rejection_reason text;

-- Setujui (approve = true) atau tolak beberapa tugas sekaligus. Hanya tugas berstatus
-- "done" yang berubah. Disetujui: dihitung mulai besok (counts_on = tanggal WIB + 1).
-- Ditolak: kembali ke "open" dengan alasan. Mengembalikan jumlah tugas yang berubah.
create function public.review_tasks(instance_ids uuid[], approve boolean, reason text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
  changed integer;
begin
  if me.role is null or me.role not in ('father', 'mother') then
    raise exception 'Hanya ayah atau ibu yang bisa menyetujui tugas' using errcode = 'insufficient_privilege';
  end if;

  if not approve and coalesce(trim(reason), '') = '' then
    raise exception 'Alasan penolakan wajib diisi' using errcode = 'check_violation';
  end if;

  update public.task_instances i
  set status = case when approve then 'approved' else 'open' end::public.task_status,
      approved_by_id = case when approve then me.id end,
      approved_at = case when approve then now() end,
      counts_on = case when approve then (now() at time zone 'Asia/Jakarta')::date + 1 end,
      rejection_reason = case when approve then null else trim(reason) end
  where i.id = any (instance_ids)
    and i.family_id = me.family_id
    and i.status = 'done';

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.review_tasks(uuid[], boolean, text) from public, anon;
grant execute on function public.review_tasks(uuid[], boolean, text) to authenticated;

-- Tutup hari: tugas yang masih "open" sampai hari itu menjadi "missed" (skor 0).
-- Tugas "done" tidak disentuh: tetap menunggu review orang tua.
create function private.close_day(
  for_date date default (now() at time zone 'Asia/Jakarta')::date
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with missed as (
    update public.task_instances
    set status = 'missed'
    where status = 'open' and due_date <= for_date and deleted_at is null
    returning 1
  )
  select count(*)::integer from missed;
$$;

revoke all on function private.close_day(date) from public, anon, authenticated;

-- Centang yang datang setelah hari ditutup tetap masuk sebagai "done" (terlambat,
-- perlu review), bukan diabaikan.
create or replace function private.mark_instance_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_instances
  set status = 'done'
  where id = new.instance_id and status in ('open', 'rejected', 'missed');
  return new;
end;
$$;

-- Jadwal 14:00 UTC = 21:00 WIB (jam tutup bawaan keluarga).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('kita-close-day', '0 14 * * *', 'select private.close_day()');
  end if;
end;
$$;
