-- T-07: centang tugas selesai. Setiap centang menambah satu baris task_completions
-- (append-only), jadi dua orang yang mencentang saat offline tidak saling menimpa.
-- id dibuat di perangkat, jadi kiriman ulang dari antrean sync diabaikan.

alter table public.task_instances add constraint task_instances_family_id_id_key unique (family_id, id);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  instance_id uuid not null,
  member_id uuid not null,
  done_at timestamptz not null default now(),
  note text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (family_id, instance_id) references public.task_instances (family_id, id),
  foreign key (family_id, member_id) references public.members (family_id, id)
);

create index on public.task_completions (family_id, instance_id);

create trigger set_updated_at before insert or update on public.task_completions
  for each row execute function public.set_updated_at();

alter table public.task_completions enable row level security;

create policy "task_completions: anggota keluarga bisa lihat" on public.task_completions
  for select to authenticated
  using (family_id = (private.my_member()).family_id);

-- Orang tua boleh mencentang tugas siapa saja; anggota lain hanya tugasnya sendiri.
create policy "task_completions: centang tugas sendiri" on public.task_completions
  for insert to authenticated
  with check (
    family_id = (private.my_member()).family_id
    and (
      private.is_parent()
      or (
        member_id = (private.my_member()).id
        and exists (
          select 1 from public.task_instances i
          where i.id = instance_id and i.assignee_id = (private.my_member()).id
        )
      )
    )
  );

revoke all on public.task_completions from anon, authenticated;
grant select, insert on public.task_completions to authenticated;

-- Status tugas ikut menjadi "done". Hanya server yang mengubah status (lihat rencana).
create function private.mark_instance_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_instances
  set status = 'done'
  where id = new.instance_id and status in ('open', 'rejected');
  return new;
end;
$$;

create trigger mark_instance_done after insert on public.task_completions
  for each row execute function private.mark_instance_done();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.task_completions;
  end if;

  -- Foto bukti: bucket privat, folder per keluarga <family_id>/<instance_id>/<file>.
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('task-photos', 'task-photos', false)
    on conflict (id) do nothing;

    execute $p$
      create policy "task-photos: anggota keluarga bisa lihat" on storage.objects
      for select to authenticated
      using (bucket_id = 'task-photos'
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
    execute $p$
      create policy "task-photos: anggota keluarga bisa unggah" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'task-photos'
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
  end if;
end;
$$;
