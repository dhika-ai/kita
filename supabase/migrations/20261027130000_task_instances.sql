-- T-05: tugas harian (task_instances) dibuat dari template setiap pukul 00:05 WIB.

create type public.task_status as enum ('open', 'done', 'approved', 'rejected', 'missed');

create table public.task_instances (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  template_id uuid not null,
  assignee_id uuid,
  assigned_by_id uuid,
  due_date date not null,
  status public.task_status not null default 'open',
  approved_by_id uuid,
  approved_at timestamptz,
  -- Tugas yang disetujui baru dihitung keesokan harinya (H+1).
  counts_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Satu template paling banyak satu tugas per hari, jadi job aman dijalankan ulang.
  unique (template_id, due_date),
  foreign key (family_id, template_id) references public.task_templates (family_id, id),
  foreign key (family_id, assignee_id) references public.members (family_id, id),
  foreign key (family_id, assigned_by_id) references public.members (family_id, id),
  foreign key (family_id, approved_by_id) references public.members (family_id, id)
);

create index on public.task_instances (family_id, due_date);

create trigger set_updated_at before insert or update on public.task_instances
  for each row execute function public.set_updated_at();

alter table public.task_instances enable row level security;

create policy "task_instances: anggota keluarga bisa lihat" on public.task_instances
  for select to authenticated
  using (family_id = (private.my_member()).family_id);

revoke all on public.task_instances from anon, authenticated;
grant select on public.task_instances to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.task_instances;
  end if;
end;
$$;

-- Membuat tugas untuk satu tanggal dari semua template aktif yang jadwalnya cocok.
-- Mingguan: hari ISO (1 = Senin ... 7 = Minggu). Bulanan: tanggal yang dipilih, atau
-- hari terakhir bulan itu kalau bulannya lebih pendek (misal tanggal 31 di Februari).
-- Mengembalikan jumlah tugas baru.
create function private.generate_task_instances(
  for_date date default (now() at time zone 'Asia/Jakarta')::date
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with created as (
    insert into public.task_instances (family_id, template_id, assignee_id, due_date)
    select t.family_id, t.id, t.default_assignee_id, for_date
    from public.task_templates t
    join public.families f on f.id = t.family_id and f.deleted_at is null
    where t.deleted_at is null
      and (
        t.recurrence = 'daily'
        or (t.recurrence = 'weekly' and extract(isodow from for_date)::smallint = any (t.weekdays))
        or (t.recurrence = 'monthly' and extract(day from for_date) = least(
          t.month_day,
          extract(day from (date_trunc('month', for_date) + interval '1 month - 1 day'))
        ))
      )
    on conflict (template_id, due_date) do nothing
    returning 1
  )
  select count(*)::integer from created;
$$;

revoke all on function private.generate_task_instances(date) from public, anon, authenticated;

-- Jadwal 17:05 UTC = 00:05 WIB. pg_cron hanya ada di Supabase (bukan Postgres biasa untuk test).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'kita-generate-task-instances',
      '5 17 * * *',
      'select private.generate_task_instances()'
    );
  end if;
end;
$$;
