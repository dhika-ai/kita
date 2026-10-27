-- R-03: isi pesan pengingat Telegram, dalam bahasa anggota (id/en).
-- Pagi (07:00): hasil kemarin, top 3 keluarga kemarin, dan tugas hari ini.
-- Sore (17:00): tugas hari ini yang belum selesai dan jumlah yang menunggu persetujuan.
-- Angka hasil dan top 3 diambil dari view dashboard_daily (T-11), jadi sama dengan dasbor.
-- Quote di pesan pagi ditambahkan nanti oleh M-04 (Rilis 3).

-- Judul tugas seorang anggota pada satu tanggal, satu per baris ("- judul").
create function private.task_lines(member_id uuid, for_date date, statuses public.task_status[], language text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select string_agg(
    '- ' || case when language = 'en' then t.title_en else t.title_id end,
    E'\n' order by t.due_time nulls last, t.title_id
  )
  from public.task_instances i
  join public.task_templates t on t.id = i.template_id
  where i.assignee_id = task_lines.member_id
    and i.due_date = for_date
    and i.status = any (statuses)
    and i.deleted_at is null;
$$;

create function private.reminder_text(member_id uuid, slot text, for_date date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m public.members;
  en boolean;
  yesterday public.dashboard_daily;
  top text;
  tasks text;
  waiting integer;
begin
  select * into m from public.members where id = reminder_text.member_id;
  en := m.language = 'en';

  if slot = 'morning' then
    select * into yesterday from public.dashboard_daily d
    where d.member_id = m.id and d.due_date = for_date - 1;

    select string_agg(
      format('%s. %s %s %s', rn, display_name, points, case when en then 'pts' else 'poin' end),
      E'\n' order by rn
    ) into top
    from (
      select row_number() over (order by d.points desc, d.completion_pct desc, x.display_name) as rn,
        x.display_name, d.points
      from public.dashboard_daily d
      join public.members x on x.id = d.member_id
      where d.family_id = m.family_id and d.due_date = for_date - 1
    ) ranked
    where rn <= 3;

    tasks := private.task_lines(m.id, for_date, array['open', 'rejected']::public.task_status[], m.language);

    return concat_ws(E'\n\n',
      format(case when en then 'Good morning, %s!' else 'Selamat pagi, %s!' end, m.display_name),
      case
        when yesterday.member_id is null then
          case when en then 'Yesterday: no tasks.' else 'Kemarin: tidak ada tugas.' end
        else format(
          case when en then 'Yesterday: %s/%s tasks approved (%s%%), %s pts.'
            else 'Kemarin: %s/%s tugas disetujui (%s%%), %s poin.' end,
          yesterday.approved, yesterday.total, yesterday.completion_pct, yesterday.points)
      end,
      case when top is not null then
        (case when en then 'Top 3 yesterday:' else 'Top 3 kemarin:' end) || E'\n' || top
      end,
      case when en then 'Today''s tasks:' else 'Tugas hari ini:' end || E'\n' ||
        coalesce(tasks, case when en then 'None.' else 'Tidak ada.' end)
    );
  end if;

  -- Sore. Ayah/ibu melihat semua yang menunggu persetujuan di keluarga, lainnya miliknya sendiri.
  tasks := private.task_lines(m.id, for_date, array['open', 'rejected']::public.task_status[], m.language);
  select count(*) into waiting from public.task_instances i
  where i.family_id = m.family_id
    and i.status = 'done'
    and i.deleted_at is null
    and (m.role in ('father', 'mother') or i.assignee_id = m.id);

  return concat_ws(E'\n\n',
    case
      when tasks is null then
        format(case when en then 'Good afternoon, %s! All of today''s tasks are done.'
          else 'Sore, %s! Semua tugas hari ini sudah selesai.' end, m.display_name)
      else
        format(case when en then 'Good afternoon, %s! Today''s unfinished tasks:'
          else 'Sore, %s! Tugas hari ini yang belum selesai:' end, m.display_name) || E'\n' || tasks
    end,
    format(case when en then 'Waiting for approval: %s' else 'Menunggu persetujuan: %s' end, waiting)
  );
end;
$$;

-- Pesan untuk semua anggota yang terhubung ke Telegram. Dipanggil Edge Function (service_role).
create function public.reminder_messages(
  slot text,
  for_date date default (now() at time zone 'Asia/Jakarta')::date
)
returns table (member_id uuid, chat_id bigint, text text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.telegram_chat_id, private.reminder_text(m.id, slot, for_date)
  from public.members m
  where slot in ('morning', 'evening')
    and m.telegram_chat_id is not null
    and m.is_active
    and m.deleted_at is null;
$$;

revoke all on function private.task_lines(uuid, date, public.task_status[], text) from public, anon, authenticated;
revoke all on function private.reminder_text(uuid, text, date) from public, anon, authenticated;
revoke all on function public.reminder_messages(text, date) from public, anon, authenticated;
grant execute on function public.reminder_messages(text, date) to service_role;
