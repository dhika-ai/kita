-- K-01: tabel keuangan. Nominal dalam Rupiah, bilangan bulat (bigint, tanpa desimal).
-- Hanya ayah dan ibu yang bisa membaca dan menulis (DoD 4). Aturan ini dijaga RLS, jadi
-- akun anak dan ART mendapat 0 baris dan ditolak saat menulis, walau memanggil API langsung.
-- id dibuat di perangkat (F-10), jadi transaksi yang dicatat offline aman dikirim ulang.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (trim(name) <> ''),
  -- cash = tunai, bank = rekening bank, ewallet = dompet digital
  kind text not null check (kind in ('cash', 'bank', 'ewallet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, id)
);

create table public.budget_posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (trim(name) <> ''),
  kind text not null check (kind in ('income', 'expense')),
  -- Anggaran per bulan (Rupiah). Kosong berarti pos tanpa batas anggaran.
  monthly_budget bigint check (monthly_budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  post_id uuid not null,
  account_id uuid not null,
  tx_date date not null,
  note text,
  receipt_path text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (family_id, post_id) references public.budget_posts (family_id, id),
  foreign key (family_id, account_id) references public.accounts (family_id, id),
  foreign key (family_id, created_by) references public.members (family_id, id)
);

create index on public.transactions (family_id, tx_date);

do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'budget_posts', 'transactions'] loop
    execute format(
      'create trigger set_updated_at before insert or update on public.%I
       for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%s: hanya orang tua bisa lihat" on public.%I
       for select to authenticated
       using (private.is_parent() and family_id = (private.my_member()).family_id)', t, t);
    execute format(
      'create policy "%s: hanya orang tua bisa tambah" on public.%I
       for insert to authenticated
       with check (private.is_parent() and family_id = (private.my_member()).family_id)', t, t);
    execute format(
      'create policy "%s: hanya orang tua bisa ubah" on public.%I
       for update to authenticated
       using (private.is_parent() and family_id = (private.my_member()).family_id)
       with check (private.is_parent() and family_id = (private.my_member()).family_id)', t, t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;

  -- Foto struk: bucket privat, folder per keluarga <family_id>/<transaction_id>/<file>.
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
    on conflict (id) do nothing;

    execute $p$
      create policy "receipts: hanya orang tua bisa lihat" on storage.objects
      for select to authenticated
      using (bucket_id = 'receipts' and private.is_parent()
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
    execute $p$
      create policy "receipts: hanya orang tua bisa unggah" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'receipts' and private.is_parent()
        and (storage.foldername(name))[1] = (private.my_member()).family_id::text)
    $p$;
  end if;
end;
$$;
