-- P-02: pengingat 07:00 dan 17:00 dikirim sebagai push notification (pengganti Telegram).
-- Isi pesan, catatan kiriman, coba ulang, dan mute tetap sama (R-03 s/d R-05, M-04),
-- kecuali "Top 3 kemarin" yang dibuang karena leaderboard di-Kill pada triage 27 Okt.

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
  waiting integer;
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

-- Pesan untuk anggota yang punya langganan push, beserta semua HP penerimanya.
-- Aturan coba ulang dan mute sama dengan reminder_messages (R-05).
create function public.push_reminders(
  slot text,
  for_date date default (now() at time zone 'Asia/Jakarta')::date
)
returns table (member_id uuid, text text, subscriptions jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,
    private.reminder_text(m.id, push_reminders.slot, push_reminders.for_date),
    (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
       order by s.endpoint)
     from public.push_subscriptions s where s.member_id = m.id)
  from public.members m
  left join public.reminder_log l
    on l.member_id = m.id and l.slot = push_reminders.slot and l.for_date = push_reminders.for_date
  where push_reminders.slot in ('morning', 'evening')
    and exists (select 1 from public.push_subscriptions s where s.member_id = m.id)
    and m.is_active
    and m.deleted_at is null
    and not (case when push_reminders.slot = 'morning' then m.telegram_mute_morning
      else m.telegram_mute_evening end)
    and (l.member_id is null or (l.status = 'failed' and l.attempts < 2));
$$;

-- Langganan yang sudah tidak berlaku (layanan push menjawab 404/410) dihapus.
create function public.forget_push_subscription(endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions s where s.endpoint = forget_push_subscription.endpoint;
$$;

revoke all on function public.push_reminders(text, date) from public, anon, authenticated;
grant execute on function public.push_reminders(text, date) to service_role;
revoke all on function public.forget_push_subscription(text) from public, anon, authenticated;
grant execute on function public.forget_push_subscription(text) to service_role;
