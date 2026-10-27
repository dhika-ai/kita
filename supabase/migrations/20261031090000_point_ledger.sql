-- G-01: buku poin (point_ledger). Sesuai keputusan Dhika, poin langsung masuk saat tugas
-- dicentang (umpan balik langsung), lalu orang tua mengecek secara acak. Kalau tugas
-- ditolak, poinnya ditarik kembali. Orang tua juga bisa mengoreksi poin dengan catatan.
-- Saldo = jumlah semua baris; ledger hanya ditambah, tidak pernah diubah.

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null,
  points integer not null check (points <> 0),
  -- task = tugas dicentang, revoked = tugas ditolak, correction = koreksi orang tua,
  -- redeem = tukar hadiah (G-04).
  kind text not null check (kind in ('task', 'revoked', 'correction', 'redeem')),
  instance_id uuid references public.task_instances (id) on delete cascade,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (family_id, member_id) references public.members (family_id, id)
);

create index on public.point_ledger (family_id, member_id);
create index on public.point_ledger (instance_id);

alter table public.point_ledger enable row level security;

create policy "point_ledger: keluarga bisa lihat" on public.point_ledger
  for select to authenticated
  using (family_id = (private.my_member()).family_id);

-- Tidak ada izin tulis langsung: baris masuk lewat trigger dan fungsi di bawah.
revoke all on public.point_ledger from anon, authenticated;
grant select on public.point_ledger to authenticated;

-- Poin tugas mengikuti statusnya: tugas Selesai atau Disetujui bernilai poin template,
-- status lain bernilai 0. Selisihnya dicatat, jadi centang ulang tidak membuat poin dobel.
create function private.sync_task_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target integer;
  have integer;
  member uuid;
begin
  select case when new.status in ('done', 'approved') then t.points else 0 end
  into target
  from public.task_templates t where t.id = new.template_id;

  select coalesce(sum(l.points), 0) into have
  from public.point_ledger l
  where l.instance_id = new.id and l.kind in ('task', 'revoked');

  if coalesce(target, 0) = have then
    return new;
  end if;

  -- Tugas tanpa penanggung jawab: poin untuk yang mencentang terakhir.
  member := coalesce(new.assignee_id, (
    select c.member_id from public.task_completions c
    where c.instance_id = new.id
    order by c.done_at desc limit 1
  ));
  if member is null then
    return new;
  end if;

  insert into public.point_ledger (family_id, member_id, points, kind, instance_id)
  values (new.family_id, member, coalesce(target, 0) - have,
    case when coalesce(target, 0) > have then 'task' else 'revoked' end, new.id);
  return new;
end;
$$;

revoke all on function private.sync_task_points() from public, anon, authenticated;

create trigger sync_task_points after insert or update of status on public.task_instances
  for each row execute function private.sync_task_points();

-- Koreksi oleh ayah/ibu: tambah atau kurangi poin anggota, catatan wajib.
create function public.correct_points(member_id uuid, points integer, note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
  id uuid;
begin
  if me.role is null or me.role not in ('father', 'mother') then
    raise exception 'Hanya ayah atau ibu yang bisa mengoreksi poin' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(points, 0) = 0 then
    raise exception 'Jumlah poin tidak boleh 0' using errcode = 'check_violation';
  end if;
  if coalesce(trim(note), '') = '' then
    raise exception 'Catatan koreksi wajib diisi' using errcode = 'check_violation';
  end if;

  insert into public.point_ledger (family_id, member_id, points, kind, note, created_by)
  values (me.family_id, correct_points.member_id, correct_points.points, 'correction', trim(note), me.id)
  returning point_ledger.id into id;
  return id;
end;
$$;

revoke all on function public.correct_points(uuid, integer, text) from public, anon;
grant execute on function public.correct_points(uuid, integer, text) to authenticated;

-- Saldo poin per anggota.
create view public.point_balances
with (security_invoker = true)
as
select family_id, member_id, sum(points)::integer as balance
from public.point_ledger
group by family_id, member_id;

revoke all on public.point_balances from anon, authenticated;
grant select on public.point_balances to authenticated;

-- Tugas yang sudah dicentang atau disetujui sebelum ledger ada ikut tercatat.
insert into public.point_ledger (family_id, member_id, points, kind, instance_id)
select i.family_id, i.assignee_id, t.points, 'task', i.id
from public.task_instances i
join public.task_templates t on t.id = i.template_id
where i.status in ('done', 'approved') and i.assignee_id is not null and t.points <> 0;

-- Dashboard memakai poin dari ledger, jadi angkanya sama dengan saldo tugas.
create or replace view public.dashboard_daily
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
  coalesce(sum((
    select sum(l.points) from public.point_ledger l
    where l.instance_id = i.id and l.kind in ('task', 'revoked')
  )), 0)::integer as points
from public.task_instances i
cross join today
where i.deleted_at is null
group by i.family_id, i.assignee_id, i.due_date;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.point_ledger;
  end if;
end;
$$;
