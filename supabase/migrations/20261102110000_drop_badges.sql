-- L-02: badge (G-03) berstatus Review pada triage 27 Okt dan Dhika memilih menghapus
-- kodenya. Lencana dihitung ulang dari tugas, jadi tidak ada data asli yang hilang.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'kita-award-badges') then
      perform cron.unschedule('kita-award-badges');
    end if;
  end if;
end;
$$;

drop function private.award_badges(date);
drop table public.badges;
