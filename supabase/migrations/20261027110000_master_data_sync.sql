-- T-03: master data diubah dari layar orang tua lewat sync (F-10).

-- updated_at selalu diisi server, juga saat baris baru masuk lewat upsert, supaya
-- tarikan perangkat lain (berdasarkan updated_at) tidak melewatkannya.
do $$
declare
  t text;
begin
  foreach t in array array['areas', 'categories', 'sops', 'task_templates', 'inventory_items'] loop
    execute format(
      'create trigger set_updated_at_on_insert before insert on public.%I
       for each row execute function public.set_updated_at()', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Foto langkah SOP disimpan di Supabase Storage, bucket privat, folder per keluarga:
-- <family_id>/<sop_id>/<nama file>. Hanya ada di Supabase (bukan Postgres biasa untuk test).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('sop-photos', 'sop-photos', false)
    on conflict (id) do nothing;

    execute $p$
      create policy "sop-photos: anggota keluarga bisa lihat" on storage.objects
      for select to authenticated
      using (bucket_id = 'sop-photos'
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
    execute $p$
      create policy "sop-photos: orang tua bisa unggah" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'sop-photos' and private.is_parent()
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
  end if;
end;
$$;
