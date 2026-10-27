-- T-10: stok di bawah batas minimum otomatis membuat satu tugas belanja (restock).
-- Tiap barang punya satu template belanja (dibuat otomatis saat pertama kali dibutuhkan,
-- bisa diubah orang tua di master data, misalnya penanggung jawab dan poin).
-- Tugas baru hanya dibuat kalau belum ada tugas belanja yang masih berjalan
-- (Belum atau Selesai menunggu persetujuan) untuk barang itu.
create function private.restock_when_low()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  template public.task_templates;
  category_id uuid;
  area_id uuid;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  -- Upsert dari perangkat menjalankan trigger INSERT dulu walaupun barisnya sudah ada;
  -- biarkan trigger UPDATE yang menangani supaya tidak membuat template dobel.
  if tg_op = 'INSERT' and exists (select 1 from public.inventory_items where id = new.id) then
    return new;
  end if;

  -- Perangkat mengirim baris lengkap dari salinannya; jangan hapus template yang
  -- sudah dibuat server.
  if tg_op = 'UPDATE' then
    new.restock_task_template_id := coalesce(new.restock_task_template_id, old.restock_task_template_id);
  end if;

  if new.deleted_at is not null or new.qty_on_hand >= new.min_qty then
    return new;
  end if;

  select * into template from public.task_templates
  where id = new.restock_task_template_id and deleted_at is null;

  if template.id is null then
    select c.id into category_id from public.categories c
    where c.family_id = new.family_id and c.deleted_at is null
    order by c.kind <> 'inventory', c.created_at
    limit 1;
    select a.id into area_id from public.areas a
    where a.family_id = new.family_id and a.deleted_at is null
    order by a.id <> new.area_id, a.created_at
    limit 1;
    if category_id is null or area_id is null then
      return new;
    end if;

    insert into public.task_templates (family_id, title_en, title_id, category_id, area_id, chore_type)
    values (new.family_id, 'Buy ' || new.name, 'Beli ' || new.name, category_id, area_id, 'adhoc')
    returning * into template;
    new.restock_task_template_id := template.id;
  end if;

  if not exists (
    select 1 from public.task_instances
    where template_id = template.id and status in ('open', 'done') and deleted_at is null
  ) then
    insert into public.task_instances (family_id, template_id, assignee_id, due_date)
    values (new.family_id, template.id, template.default_assignee_id, today)
    on conflict (template_id, due_date) do update
      set status = 'open', rejection_reason = null, approved_by_id = null,
          approved_at = null, counts_on = null;
  end if;

  return new;
end;
$$;

create trigger restock_when_low before insert or update on public.inventory_items
  for each row execute function private.restock_when_low();
