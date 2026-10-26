-- F-10: kirim perubahan keluarga dan anggota lewat Supabase Realtime, supaya perangkat
-- anggota lain langsung menarik data terbaru. Realtime tetap mengikuti RLS.
-- Publikasi ini hanya ada di Supabase (bukan di Postgres biasa untuk test).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.families, public.members;
  end if;
end;
$$;
