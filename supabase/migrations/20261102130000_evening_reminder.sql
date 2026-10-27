-- R-06: pesan sore tanpa "Menunggu persetujuan". Approval akhir hari sudah diganti cek
-- acak, jadi tugas yang dicentang langsung dihitung selesai (keputusan Dhika 27 Okt).

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
  tasks text;
  message text;
begin
  select * into m from public.members where id = reminder_text.member_id;
  en := m.language = 'en';

  if slot = 'morning' then
    select * into yesterday from public.dashboard_daily d
    where d.member_id = m.id and d.due_date = for_date - 1;

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
      case when en then 'Today''s tasks:' else 'Tugas hari ini:' end || E'\n' ||
        coalesce(tasks, case when en then 'None.' else 'Tidak ada.' end)
    );
  end if;

  -- Sore: tugas hari ini yang belum selesai.
  tasks := private.task_lines(m.id, for_date, array['open', 'rejected']::public.task_status[], m.language);

  return
    case
      when tasks is null then
        format(case when en then 'Good afternoon, %s! All of today''s tasks are done.'
          else 'Sore, %s! Semua tugas hari ini sudah selesai.' end, m.display_name)
      else
        format(case when en then 'Good afternoon, %s! Today''s unfinished tasks:'
          else 'Sore, %s! Tugas hari ini yang belum selesai:' end, m.display_name) || E'\n' || tasks
    end;
end;
$$;
