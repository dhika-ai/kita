-- M-04: Pesan Harian dari Ayah/Ibu masuk ke pengingat Telegram pukul 07:00, tepat setelah
-- sapaan. Sama seperti di Beranda (M-03): pesan hari ini, kalau kosong pesan dari tanggal
-- terakhir yang punya pesan. Foto tidak dikirim, hanya teksnya.

create function private.daily_message_text(family_id uuid, for_date date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select string_agg(format('"%s" — %s', d.body, a.display_name), E'\n' order by d.created_at)
  from public.daily_messages d
  join public.members a on a.id = d.author_id
  where d.family_id = daily_message_text.family_id
    and d.deleted_at is null
    and d.message_date = (
      select max(x.message_date) from public.daily_messages x
      where x.family_id = daily_message_text.family_id
        and x.deleted_at is null
        and x.message_date <= daily_message_text.for_date
    );
$$;

revoke all on function private.daily_message_text(uuid, date) from public, anon, authenticated;

create or replace function private.reminder_text(member_id uuid, slot text, for_date date)
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
  message text;
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
    message := private.daily_message_text(m.family_id, for_date);

    return concat_ws(E'\n\n',
      format(case when en then 'Good morning, %s!' else 'Selamat pagi, %s!' end, m.display_name),
      case when message is not null then
        (case when en then 'Message from Dad/Mum:' else 'Pesan dari Ayah/Ibu:' end) || E'\n' || message
      end,
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
