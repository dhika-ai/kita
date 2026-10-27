-- T-06: membuat tugas ad-hoc (sekali, pada tanggal tertentu) atau kebiasaan berulang.
-- Ayah dan ibu: untuk siapa saja di keluarga. Anak: hanya untuk dirinya sendiri dan hanya
-- kategori "kebiasaan pribadi", tanpa poin. ART: tidak bisa membuat tugas.
-- Tanpa jadwal (recurrence null) = tugas sekali: template ad-hoc + tugas pada due_date.
-- Dengan jadwal = template berulang; tugasnya dibuat job harian (T-05) mulai besok.
create function public.create_task(
  title_en text,
  title_id text,
  category_id uuid,
  area_id uuid,
  assignee_id uuid,
  points integer default 0,
  recurrence public.recurrence default null,
  weekdays smallint[] default null,
  month_day smallint default null,
  due_date date default (now() at time zone 'Asia/Jakarta')::date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
  template_id uuid;
begin
  if me.id is null or me.role = 'art' then
    raise exception 'Kamu tidak bisa membuat tugas' using errcode = 'insufficient_privilege';
  end if;

  if me.role = 'child' then
    if assignee_id is distinct from me.id then
      raise exception 'Anak hanya bisa membuat tugas untuk dirinya sendiri' using errcode = 'insufficient_privilege';
    end if;
    if not exists (
      select 1 from public.categories c
      where c.id = create_task.category_id and c.kind = 'personal_habit'
    ) then
      raise exception 'Anak hanya bisa membuat kebiasaan pribadi, bukan tugas rumah tangga' using errcode = 'insufficient_privilege';
    end if;
    points := 0;
  end if;

  -- Kategori, area, dan penanggung jawab diperiksa foreign key dan trigger master data (T-04).
  insert into public.task_templates (
    family_id, title_en, title_id, category_id, area_id, chore_type,
    recurrence, weekdays, month_day, default_assignee_id, points
  )
  values (
    me.family_id,
    coalesce(nullif(trim(title_en), ''), trim(title_id)),
    coalesce(nullif(trim(title_id), ''), trim(title_en)),
    category_id, area_id,
    case when recurrence is null then 'adhoc' else 'routine' end::public.chore_type,
    recurrence, weekdays, month_day, assignee_id, points
  )
  returning id into template_id;

  if recurrence is null then
    insert into public.task_instances (family_id, template_id, assignee_id, assigned_by_id, due_date)
    values (me.family_id, template_id, assignee_id, me.id, due_date);
  end if;

  return template_id;
end;
$$;

revoke all on function public.create_task(text, text, uuid, uuid, uuid, integer, public.recurrence, smallint[], smallint, date) from public, anon;
grant execute on function public.create_task(text, text, uuid, uuid, uuid, integer, public.recurrence, smallint[], smallint, date) to authenticated;

