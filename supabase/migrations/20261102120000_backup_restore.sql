-- B-01: Backup & Restore (keputusan brainstorm 27 Okt). Ayah/ibu mengunduh semua data
-- keluarga (plus foto, dikemas jadi ZIP di aplikasi) dan bisa memulihkannya kembali.
-- Restore menggabungkan: baris dari backup ditulis ulang (yang sudah dihapus kembali),
-- baris yang dibuat setelah backup tidak dihapus.

-- Urutan tabel = urutan aman untuk restore (induk dulu). Catatan pengingat dan langganan
-- push tidak ikut karena khusus perangkat/server.
create function private.backup_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'families', 'members', 'areas', 'categories', 'sops', 'task_templates',
    'inventory_items', 'task_instances', 'task_completions', 'moments', 'moment_picks',
    'daily_messages', 'point_targets', 'point_ledger', 'rewards', 'reward_requests',
    'accounts', 'budget_posts', 'transactions'
  ];
$$;

-- Kolom rahasia yang tidak pernah ikut backup (dan karena itu tidak disentuh restore).
create function private.backup_hidden_columns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['pin_hash', 'telegram_chat_id'];
$$;

create function public.export_backup()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
  t text;
  rows jsonb;
  tables jsonb := '{}';
begin
  if not private.is_parent() then
    raise exception 'Hanya ayah dan ibu yang bisa membuat backup' using errcode = 'insufficient_privilege';
  end if;

  foreach t in array private.backup_tables() loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) - $2), ''[]'') from public.%I x where %s = $1',
      t, case when t = 'families' then 'id' else 'family_id' end)
    into rows
    using me.family_id, private.backup_hidden_columns();
    tables := tables || jsonb_build_object(t, rows);
  end loop;

  return jsonb_build_object(
    'app', 'kita',
    'version', 1,
    'family_id', me.family_id,
    'exported_at', now(),
    'tables', tables
  );
end;
$$;

-- Mengembalikan jumlah baris yang dipulihkan per tabel.
create function public.restore_backup(backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
  t text;
  rows jsonb;
  cols text[];
  keys text[];
  restored integer;
  result jsonb := '{}';
begin
  if not private.is_parent() then
    raise exception 'Hanya ayah dan ibu yang bisa memulihkan backup' using errcode = 'insufficient_privilege';
  end if;
  if backup ->> 'app' is distinct from 'kita' or (backup ->> 'version')::int is distinct from 1 then
    raise exception 'File ini bukan backup KITA' using errcode = 'invalid_parameter_value';
  end if;
  if (backup ->> 'family_id')::uuid is distinct from me.family_id then
    raise exception 'Backup ini milik keluarga lain' using errcode = 'insufficient_privilege';
  end if;

  foreach t in array private.backup_tables() loop
    rows := coalesce(backup -> 'tables' -> t, '[]');
    continue when jsonb_array_length(rows) = 0;

    -- Kolom yang ada di backup dan di tabel (kolom turunan dan rahasia dilewati).
    select array_agg(a.attname::text order by a.attnum) into cols
    from pg_attribute a
    where a.attrelid = format('public.%I', t)::regclass
      and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
      and a.attname::text <> all (private.backup_hidden_columns())
      and rows -> 0 ? a.attname::text;

    select array_agg(a.attname::text) into keys
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = format('public.%I', t)::regclass and i.indisprimary;

    -- updated_at diisi sekarang supaya perangkat lain menarik baris yang dipulihkan.
    execute format(
      'insert into public.%I as x (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) r
       where r.%I = $2
       on conflict (%s) do update set %s',
      t,
      (select string_agg(quote_ident(c), ', ') from unnest(cols) c),
      (select string_agg(case when c = 'updated_at' then 'now()' else 'r.' || quote_ident(c) end, ', ')
         from unnest(cols) c),
      t,
      case when t = 'families' then 'id' else 'family_id' end,
      (select string_agg(quote_ident(k), ', ') from unnest(keys) k),
      (select string_agg(format('%1$I = excluded.%1$I', c), ', ')
         from unnest(cols) c where c <> all (keys)))
    using rows, me.family_id;
    get diagnostics restored = row_count;
    result := result || jsonb_build_object(t, restored);
  end loop;

  -- Memulihkan tugas menjalankan trigger poin (G-01), padahal buku poin juga dipulihkan
  -- dari backup. Baris poin yang dibuat trigger dalam transaksi ini dibuang supaya
  -- saldo sama dengan saat backup.
  delete from public.point_ledger l
  where l.family_id = me.family_id
    and l.created_at = now()
    and not exists (
      select 1 from jsonb_array_elements(coalesce(backup -> 'tables' -> 'point_ledger', '[]')) b
      where (b ->> 'id')::uuid = l.id
    );

  return result;
end;
$$;

revoke all on function private.backup_tables() from public, anon, authenticated;
revoke all on function private.backup_hidden_columns() from public, anon, authenticated;
revoke all on function public.export_backup() from public, anon;
grant execute on function public.export_backup() to authenticated;
revoke all on function public.restore_backup(jsonb) from public, anon;
grant execute on function public.restore_backup(jsonb) to authenticated;
