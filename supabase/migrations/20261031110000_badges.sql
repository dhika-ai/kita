-- G-03: lencana. Diperiksa tiap malam setelah hari ditutup. Setiap lencana hanya
-- didapat sekali per anggota (lencana spesialis sekali per area), jadi tidak ada duplikat.
-- - streak_7: 7 hari berturut-turut semua tugas hari itu selesai (minimal 1 tugas per hari).
-- - area_specialist: 20 tugas selesai di satu area.

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null,
  kind text not null check (kind in ('streak_7', 'area_specialist')),
  area_id uuid,
  earned_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (family_id, member_id) references public.members (family_id, id),
  foreign key (family_id, area_id) references public.areas (family_id, id),
  check ((kind = 'area_specialist') = (area_id is not null)),
  unique nulls not distinct (member_id, kind, area_id)
);

create index on public.badges (family_id, earned_on);

alter table public.badges enable row level security;

create policy "badges: keluarga bisa lihat" on public.badges
  for select to authenticated
  using (family_id = (private.my_member()).family_id);

-- Hanya diisi oleh pemeriksaan malam.
revoke all on public.badges from anon, authenticated;
grant select on public.badges to authenticated;

create function private.award_badges(
  for_date date default (now() at time zone 'Asia/Jakarta')::date
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with days as (
    select i.family_id, i.assignee_id as member_id, i.due_date
    from public.task_instances i
    where i.deleted_at is null and i.assignee_id is not null
      and i.due_date between for_date - 6 and for_date
    group by i.family_id, i.assignee_id, i.due_date
    having bool_and(i.status in ('done', 'approved'))
  ),
  streaks as (
    select family_id, member_id, 'streak_7' as kind, null::uuid as area_id
    from days
    group by family_id, member_id
    having count(*) = 7
  ),
  specialists as (
    select i.family_id, i.assignee_id as member_id, 'area_specialist' as kind, t.area_id
    from public.task_instances i
    join public.task_templates t on t.id = i.template_id
    where i.deleted_at is null and i.assignee_id is not null
      and i.status in ('done', 'approved') and i.due_date <= for_date
    group by i.family_id, i.assignee_id, t.area_id
    having count(*) >= 20
  ),
  awarded as (
    insert into public.badges (family_id, member_id, kind, area_id, earned_on)
    select family_id, member_id, kind, area_id, for_date
    from (select * from streaks union all select * from specialists) b
    on conflict (member_id, kind, area_id) do nothing
    returning 1
  )
  select count(*)::integer from awarded;
$$;

revoke all on function private.award_badges(date) from public, anon, authenticated;

-- 14:30 UTC = 21:30 WIB, setengah jam setelah tutup hari (kita-close-day).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('kita-award-badges', '30 14 * * *', 'select private.award_badges()');
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.badges;
  end if;
end;
$$;
