-- R-04: pg_cron memanggil Edge Function `reminders` pukul 00:00 dan 10:00 UTC
-- (07:00 dan 17:00 WIB) lewat pg_net. Pemanggilan diamankan rahasia acak di Vault
-- (kita_cron_secret) yang dibuat di sini, jadi tidak ada secret yang perlu diisi manual.

-- Dipanggil Edge Function (service_role) untuk memeriksa header x-kita-cron.
-- plpgsql supaya tetap bisa dibuat di Postgres biasa (test) yang tidak punya Vault.
create function public.check_cron_secret(secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'kita_cron_secret' and s.decrypted_secret = check_cron_secret.secret
  );
end;
$$;

revoke all on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;

-- Hanya di Supabase (Postgres biasa untuk test tidak punya pg_cron, pg_net, dan Vault).
do $$
declare
  job text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
    or not exists (select 1 from pg_extension where extname = 'supabase_vault')
    or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    return;
  end if;

  create extension if not exists pg_net;

  if not exists (select 1 from vault.secrets where name = 'kita_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'kita_cron_secret');
  end if;

  job := $job$
    select net.http_post(
      url := 'https://axzonebitdvdvidasjir.supabase.co/functions/v1/reminders',
      body := jsonb_build_object('slot', '%s'),
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-kita-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'kita_cron_secret')
      )
    )
  $job$;
  perform cron.schedule('kita-reminder-morning', '0 0 * * *', format(job, 'morning'));
  perform cron.schedule('kita-reminder-evening', '0 10 * * *', format(job, 'evening'));
end;
$$;
