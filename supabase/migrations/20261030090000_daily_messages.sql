-- M-01: Pesan Harian dari Ayah/Ibu (pengganti Quote of the day). Orang tua menulis
-- nilai atau fokus hari ini, boleh dengan foto. Seluruh keluarga bisa membaca.
-- id dibuat di perangkat (F-10), jadi kiriman ulang dari antrean sync tidak membuat data ganda.

create table public.daily_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  author_id uuid not null,
  message_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  body text not null check (trim(body) <> ''),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (family_id, author_id) references public.members (family_id, id)
);

create index on public.daily_messages (family_id, message_date);

create trigger set_updated_at before insert or update on public.daily_messages
  for each row execute function public.set_updated_at();

alter table public.daily_messages enable row level security;

create policy "daily_messages: keluarga bisa lihat" on public.daily_messages
  for select to authenticated
  using (family_id = (private.my_member()).family_id);

create policy "daily_messages: orang tua menulis" on public.daily_messages
  for insert to authenticated
  with check (
    private.is_parent()
    and family_id = (private.my_member()).family_id
    and author_id = (private.my_member()).id
  );

create policy "daily_messages: orang tua mengubah pesannya" on public.daily_messages
  for update to authenticated
  using (private.is_parent() and author_id = (private.my_member()).id)
  with check (private.is_parent() and author_id = (private.my_member()).id);

revoke all on public.daily_messages from anon, authenticated;
grant select, insert, update on public.daily_messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.daily_messages;
  end if;

  -- Foto pesan: bucket privat, folder per keluarga <family_id>/<message_id>/<file>.
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('message-photos', 'message-photos', false)
    on conflict (id) do nothing;

    execute $p$
      create policy "message-photos: keluarga bisa lihat" on storage.objects
      for select to authenticated
      using (bucket_id = 'message-photos'
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
    execute $p$
      create policy "message-photos: orang tua unggah" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'message-photos' and private.is_parent()
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
  end if;
end;
$$;
