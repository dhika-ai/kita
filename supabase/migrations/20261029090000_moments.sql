-- M-05: Moments (foto dan jurnal harian keluarga). Hanya ayah, ibu, dan anak yang bisa
-- melihat dan menulis; ART ditolak di database, baik di tabel maupun di file foto.
-- id dibuat di perangkat (F-10), jadi kiriman ulang dari antrean sync tidak membuat data ganda.

create function private.can_use_moments()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.my_member()).role in ('father', 'mother', 'child'), false);
$$;

revoke all on function private.can_use_moments() from public, anon;
grant execute on function private.can_use_moments() to authenticated;

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null,
  moment_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  journal text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (family_id, member_id) references public.members (family_id, id),
  check (coalesce(trim(journal), '') <> '' or photo_path is not null)
);

create index on public.moments (family_id, moment_date);

create trigger set_updated_at before insert or update on public.moments
  for each row execute function public.set_updated_at();

alter table public.moments enable row level security;

create policy "moments: keluarga tanpa ART bisa lihat" on public.moments
  for select to authenticated
  using (private.can_use_moments() and family_id = (private.my_member()).family_id);

-- Menulis moment sendiri; orang tua juga untuk anak yang memakai perangkatnya (PIN).
create policy "moments: tulis moment sendiri" on public.moments
  for insert to authenticated
  with check (
    private.can_use_moments()
    and family_id = (private.my_member()).family_id
    and (member_id = (private.my_member()).id or private.is_parent())
  );

create policy "moments: ubah moment sendiri" on public.moments
  for update to authenticated
  using (
    private.can_use_moments()
    and family_id = (private.my_member()).family_id
    and (member_id = (private.my_member()).id or private.is_parent())
  )
  with check (
    family_id = (private.my_member()).family_id
    and (member_id = (private.my_member()).id or private.is_parent())
  );

revoke all on public.moments from anon, authenticated;
grant select, insert, update on public.moments to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.moments;
  end if;

  -- Foto moment: bucket privat, folder per keluarga <family_id>/<moment_id>/<file>.
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('moment-photos', 'moment-photos', false)
    on conflict (id) do nothing;

    execute $p$
      create policy "moment-photos: keluarga tanpa ART bisa lihat" on storage.objects
      for select to authenticated
      using (bucket_id = 'moment-photos' and private.can_use_moments()
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
    execute $p$
      create policy "moment-photos: keluarga tanpa ART bisa unggah" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'moment-photos' and private.can_use_moments()
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
  end if;
end;
$$;
