-- G-02: Progress Pribadi (pengganti leaderboard). Ayah/Ibu memasang target poin harian,
-- mingguan, dan bulanan per anggota; setiap anggota melihat kemajuannya sendiri terhadap
-- target, bukan peringkat dibanding saudaranya. Target kosong berarti belum dipasang.

create table public.point_targets (
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null,
  daily integer check (daily > 0),
  weekly integer check (weekly > 0),
  monthly integer check (monthly > 0),
  updated_at timestamptz not null default now(),
  primary key (family_id, member_id),
  foreign key (family_id, member_id) references public.members (family_id, id)
);

create trigger set_updated_at before insert or update on public.point_targets
  for each row execute function public.set_updated_at();

alter table public.point_targets enable row level security;

create policy "point_targets: keluarga bisa lihat" on public.point_targets
  for select to authenticated
  using (family_id = (private.my_member()).family_id);

create policy "point_targets: orang tua memasang" on public.point_targets
  for insert to authenticated
  with check (private.is_parent() and family_id = (private.my_member()).family_id);

create policy "point_targets: orang tua mengubah" on public.point_targets
  for update to authenticated
  using (private.is_parent() and family_id = (private.my_member()).family_id)
  with check (private.is_parent() and family_id = (private.my_member()).family_id);

revoke all on public.point_targets from anon, authenticated;
grant select, insert, update on public.point_targets to authenticated;
