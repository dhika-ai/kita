-- T-11: angka dashboard per anggota per tanggal tugas. Hanya tugas yang disetujui
-- yang dihitung selesai, dan poinnya baru berlaku mulai counts_on (H+1).
-- security_invoker: view memakai RLS tabel asal, jadi tiap keluarga hanya melihat datanya.
create view public.dashboard_daily
with (security_invoker = true)
as
with today as (select (now() at time zone 'Asia/Jakarta')::date as day)
select
  i.family_id,
  i.assignee_id as member_id,
  i.due_date,
  count(*)::integer as total,
  count(*) filter (where i.status = 'approved')::integer as approved,
  count(*) filter (where i.status = 'done')::integer as waiting,
  -- Terlambat: terlewat saat tutup hari, atau masih Belum/Ditolak setelah tanggalnya.
  count(*) filter (
    where i.status = 'missed'
      or (i.status in ('open', 'rejected') and i.due_date < today.day)
  )::integer as late,
  round(100.0 * count(*) filter (where i.status = 'approved') / count(*))::integer as completion_pct,
  coalesce(sum(t.points) filter (
    where i.status = 'approved' and i.counts_on <= today.day
  ), 0)::integer as points
from public.task_instances i
join public.task_templates t on t.id = i.template_id
cross join today
where i.deleted_at is null
group by i.family_id, i.assignee_id, i.due_date;

revoke all on public.dashboard_daily from anon, authenticated;
grant select on public.dashboard_daily to authenticated;
