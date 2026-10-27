-- M-08: Moment of the Week & Month. Aplikasi menyarankan beberapa moment, orang tua
-- memilih satu per minggu dan per bulan. id = '<family_id>:<period>:<period_start>',
-- jadi pilihan ulang (juga dari perangkat lain atau antrean offline) mengganti pilihan lama.

alter table public.moments add unique (family_id, id);

create table public.moment_picks (
  id text primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  period text not null check (period in ('week', 'month')),
  period_start date not null,
  moment_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (family_id, moment_id) references public.moments (family_id, id),
  check (id = family_id::text || ':' || period || ':' || period_start::text)
);

create trigger set_updated_at before insert or update on public.moment_picks
  for each row execute function public.set_updated_at();

alter table public.moment_picks enable row level security;

create policy "moment_picks: keluarga tanpa ART bisa lihat" on public.moment_picks
  for select to authenticated
  using (private.can_use_moments() and family_id = (private.my_member()).family_id);

create policy "moment_picks: orang tua memilih" on public.moment_picks
  for insert to authenticated
  with check (private.is_parent() and family_id = (private.my_member()).family_id);

create policy "moment_picks: orang tua mengganti pilihan" on public.moment_picks
  for update to authenticated
  using (private.is_parent() and family_id = (private.my_member()).family_id)
  with check (private.is_parent() and family_id = (private.my_member()).family_id);

revoke all on public.moment_picks from anon, authenticated;
grant select, insert, update on public.moment_picks to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.moment_picks;
  end if;
end;
$$;
