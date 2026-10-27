-- T-02: keluarga baru langsung punya master data standar dalam bahasa Inggris dan Indonesia.
-- Orang tua bisa mengubah atau menghapusnya nanti di layar master data.
create function private.seed_family(target_family_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.areas (family_id, name_en, name_id, icon)
  select target_family_id, a.name_en, a.name_id, a.icon
  from (values
    ('Kitchen', 'Dapur', 'kitchen'),
    ('Living room', 'Ruang tamu', 'sofa'),
    ('Dining room', 'Ruang makan', 'dining'),
    ('Bedroom', 'Kamar tidur', 'bed'),
    ('Bathroom', 'Kamar mandi', 'bath'),
    ('Laundry room', 'Ruang cuci', 'laundry'),
    ('Yard', 'Halaman', 'yard'),
    ('Garage', 'Garasi', 'garage')
  ) as a (name_en, name_id, icon);

  insert into public.categories (family_id, name_en, name_id, kind)
  select target_family_id, c.name_en, c.name_id, c.kind::public.category_kind
  from (values
    ('Cleaning', 'Bersih-bersih', 'cleaning'),
    ('Laundry', 'Cucian', 'laundry'),
    ('Maintenance', 'Perawatan', 'maintenance'),
    ('Groceries and supplies', 'Belanja dan stok', 'inventory'),
    ('Cooking', 'Memasak', 'cooking'),
    ('Personal habit', 'Kebiasaan pribadi', 'personal_habit')
  ) as c (name_en, name_id, kind);

  -- Contoh tugas rutin, periodik, dan ad-hoc. Hari: 1 = Senin ... 7 = Minggu.
  insert into public.task_templates (
    family_id, title_en, title_id, category_id, area_id, chore_type,
    recurrence, weekdays, month_day, points
  )
  select target_family_id, t.title_en, t.title_id, c.id, a.id,
    t.chore_type::public.chore_type, t.recurrence::public.recurrence,
    t.weekdays::smallint[], t.month_day, t.points
  from (values
    ('Wash the dishes', 'Cuci piring', 'Cleaning', 'Kitchen', 'routine', 'daily', null, null, 5),
    ('Take out the trash', 'Buang sampah', 'Cleaning', 'Kitchen', 'routine', 'daily', null, null, 3),
    ('Sweep the floor', 'Sapu lantai', 'Cleaning', 'Living room', 'routine', 'daily', null, null, 5),
    ('Make the bed', 'Rapikan tempat tidur', 'Personal habit', 'Bedroom', 'routine', 'daily', null, null, 2),
    ('Cook dinner', 'Masak makan malam', 'Cooking', 'Kitchen', 'routine', 'daily', null, null, 10),
    ('Mop the floor', 'Pel lantai', 'Cleaning', 'Living room', 'routine', 'weekly', '{1,4}', null, 5),
    ('Do the laundry', 'Cuci baju', 'Laundry', 'Laundry room', 'routine', 'weekly', '{1,3,5}', null, 10),
    ('Iron the clothes', 'Setrika baju', 'Laundry', 'Laundry room', 'routine', 'weekly', '{6}', null, 10),
    ('Clean the bathroom', 'Bersihkan kamar mandi', 'Cleaning', 'Bathroom', 'routine', 'weekly', '{6}', null, 10),
    ('Change the bed sheets', 'Ganti sprei', 'Laundry', 'Bedroom', 'periodic', 'weekly', '{7}', null, 5),
    ('Water the plants', 'Siram tanaman', 'Maintenance', 'Yard', 'periodic', 'weekly', '{2,5}', null, 3),
    ('Clean the AC filter', 'Bersihkan filter AC', 'Maintenance', 'Bedroom', 'periodic', 'monthly', null, 1, 15),
    ('Wash the car', 'Cuci mobil', 'Maintenance', 'Garage', 'periodic', 'monthly', null, 15, 15),
    ('Buy groceries', 'Belanja kebutuhan', 'Groceries and supplies', 'Kitchen', 'adhoc', null, null, null, 5),
    ('Fix something broken', 'Perbaiki barang rusak', 'Maintenance', 'Garage', 'adhoc', null, null, null, 10)
  ) as t (title_en, title_id, category, area, chore_type, recurrence, weekdays, month_day, points)
  join public.categories c on c.family_id = target_family_id and c.name_en = t.category
  join public.areas a on a.family_id = target_family_id and a.name_en = t.area;
$$;

revoke all on function private.seed_family(uuid) from public, anon, authenticated;

create or replace function public.create_family(family_name text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Harus login dulu' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.members where auth_user_id = auth.uid()) then
    raise exception 'Akun ini sudah terdaftar di sebuah keluarga' using errcode = 'unique_violation';
  end if;

  if coalesce(trim(family_name), '') = '' or coalesce(trim(display_name), '') = '' then
    raise exception 'Nama keluarga dan nama ayah wajib diisi' using errcode = 'check_violation';
  end if;

  insert into public.families (name) values (trim(family_name))
  returning id into new_family_id;

  insert into public.members (family_id, auth_user_id, display_name, role)
  values (new_family_id, auth.uid(), trim(display_name), 'father');

  perform private.seed_family(new_family_id);

  return new_family_id;
end;
$$;
