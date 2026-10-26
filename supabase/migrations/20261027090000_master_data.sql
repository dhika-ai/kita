-- T-01: tabel master data. Semua anggota keluarga bisa membaca; hanya ayah dan ibu yang
-- bisa menambah dan mengubah. Tidak ada hapus permanen: hapus = isi deleted_at (untuk sync).

create type public.category_kind as enum (
  'cleaning', 'laundry', 'maintenance', 'inventory', 'cooking', 'personal_habit'
);
create type public.chore_type as enum ('routine', 'periodic', 'adhoc');
create type public.recurrence as enum ('daily', 'weekly', 'monthly');

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name_en text not null check (trim(name_en) <> ''),
  name_id text not null check (trim(name_id) <> ''),
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name_en text not null check (trim(name_en) <> ''),
  name_id text not null check (trim(name_id) <> ''),
  kind public.category_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, id)
);

-- steps: daftar langkah berurutan, tiap langkah {"en": "...", "id": "...", "photo_path": null}.
create table public.sops (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title_en text not null check (trim(title_en) <> ''),
  title_id text not null check (trim(title_id) <> ''),
  steps jsonb not null default '[]' check (jsonb_typeof(steps) = 'array'),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, id)
);

-- members belum punya unique (family_id, id); dibutuhkan foreign key penanggung jawab.
alter table public.members add constraint members_family_id_id_key unique (family_id, id);

-- Kategori, area, SOP, dan penanggung jawab harus milik keluarga yang sama
-- (foreign key gabungan family_id + id), jadi task tidak bisa memakai data di luar
-- master data keluarganya (DoD 1).
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title_en text not null check (trim(title_en) <> ''),
  title_id text not null check (trim(title_id) <> ''),
  category_id uuid not null,
  area_id uuid not null,
  sop_id uuid,
  chore_type public.chore_type not null,
  recurrence public.recurrence,
  weekdays smallint[] check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  month_day smallint check (month_day between 1 and 31),
  due_time time,
  default_assignee_id uuid,
  points integer not null default 0 check (points >= 0),
  requires_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, id),
  foreign key (family_id, category_id) references public.categories (family_id, id),
  foreign key (family_id, area_id) references public.areas (family_id, id),
  foreign key (family_id, sop_id) references public.sops (family_id, id),
  foreign key (family_id, default_assignee_id) references public.members (family_id, id),
  -- Mingguan butuh hari (1 = Senin ... 7 = Minggu), bulanan butuh tanggal.
  check (recurrence is distinct from 'weekly' or coalesce(cardinality(weekdays), 0) > 0),
  check (recurrence is distinct from 'monthly' or month_day is not null)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (trim(name) <> ''),
  area_id uuid,
  unit text not null default '',
  qty_on_hand numeric not null default 0 check (qty_on_hand >= 0),
  min_qty numeric not null default 0 check (min_qty >= 0),
  restock_task_template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (family_id, area_id) references public.areas (family_id, id),
  foreign key (family_id, restock_task_template_id) references public.task_templates (family_id, id)
);

-- Trigger, RLS, dan izin yang sama untuk kelima tabel.
do $$
declare
  t text;
begin
  foreach t in array array['areas', 'categories', 'sops', 'task_templates', 'inventory_items'] loop
    execute format('create index on public.%I (family_id)', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%s: anggota keluarga bisa lihat" on public.%I
       for select to authenticated
       using (family_id = (private.my_member()).family_id)', t, t);
    execute format(
      'create policy "%s: orang tua bisa tambah" on public.%I
       for insert to authenticated
       with check (private.is_parent() and family_id = (private.my_member()).family_id)', t, t);
    execute format(
      'create policy "%s: orang tua bisa ubah" on public.%I
       for update to authenticated
       using (private.is_parent() and family_id = (private.my_member()).family_id)
       with check (private.is_parent() and family_id = (private.my_member()).family_id)', t, t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end;
$$;
