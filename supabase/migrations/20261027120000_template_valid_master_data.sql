-- T-04 (DoD 1): template task hanya boleh memakai kategori, area, dan SOP yang masih
-- aktif. Foreign key dari T-01 sudah memastikan datanya milik keluarga yang sama;
-- trigger ini menolak data yang sudah dihapus (deleted_at terisi).
create function public.check_template_master_data()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if not exists (select 1 from public.categories where id = new.category_id and deleted_at is null) then
    raise exception 'Kategori tidak ada di master data' using errcode = 'foreign_key_violation';
  end if;

  if not exists (select 1 from public.areas where id = new.area_id and deleted_at is null) then
    raise exception 'Area tidak ada di master data' using errcode = 'foreign_key_violation';
  end if;

  if new.sop_id is not null
    and not exists (select 1 from public.sops where id = new.sop_id and deleted_at is null) then
    raise exception 'SOP tidak ada di master data' using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create trigger check_master_data before insert or update on public.task_templates
  for each row execute function public.check_template_master_data();
