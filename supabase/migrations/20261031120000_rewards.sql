-- G-04: katalog hadiah dan penukaran poin. Ayah/Ibu mengelola katalog; anak dan ART
-- mengajukan penukaran, lalu Ayah/Ibu menyetujui atau menolak. Saat disetujui, poin
-- dikurangi lewat point_ledger (kind = 'redeem'). Saldo tidak pernah menjadi negatif.

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (trim(name) <> ''),
  cost integer not null check (cost > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, id)
);

create trigger set_updated_at before insert or update on public.rewards
  for each row execute function public.set_updated_at();

alter table public.rewards enable row level security;

create policy "rewards: keluarga bisa lihat" on public.rewards
  for select to authenticated
  using (family_id = (private.my_member()).family_id);

create policy "rewards: orang tua menambah" on public.rewards
  for insert to authenticated
  with check (private.is_parent() and family_id = (private.my_member()).family_id);

create policy "rewards: orang tua mengubah" on public.rewards
  for update to authenticated
  using (private.is_parent() and family_id = (private.my_member()).family_id)
  with check (private.is_parent() and family_id = (private.my_member()).family_id);

revoke all on public.rewards from anon, authenticated;
grant select, insert, update on public.rewards to authenticated;

create table public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  reward_id uuid not null,
  member_id uuid not null,
  -- Harga saat diajukan, supaya perubahan katalog tidak mengubah permintaan lama.
  cost integer not null check (cost > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (family_id, reward_id) references public.rewards (family_id, id),
  foreign key (family_id, member_id) references public.members (family_id, id),
  foreign key (family_id, decided_by) references public.members (family_id, id)
);

create index on public.reward_requests (family_id, status);

create trigger set_updated_at before insert or update on public.reward_requests
  for each row execute function public.set_updated_at();

alter table public.reward_requests enable row level security;

create policy "reward_requests: keluarga bisa lihat" on public.reward_requests
  for select to authenticated
  using (family_id = (private.my_member()).family_id);

-- Tulis hanya lewat fungsi di bawah.
revoke all on public.reward_requests from anon, authenticated;
grant select on public.reward_requests to authenticated;

create function private.point_balance(member uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(points), 0)::integer from public.point_ledger where member_id = member;
$$;

revoke all on function private.point_balance(uuid) from public, anon, authenticated;

-- Anak atau ART mengajukan penukaran. Saldo harus cukup untuk hadiah ini ditambah
-- permintaan lain yang masih menunggu.
create function public.request_reward(reward_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
  reward public.rewards;
  held integer;
  id uuid;
begin
  if me.role is null or me.role not in ('child', 'art') then
    raise exception 'Hanya anak atau ART yang bisa menukar hadiah' using errcode = 'insufficient_privilege';
  end if;
  select * into reward from public.rewards r
  where r.id = request_reward.reward_id and r.family_id = me.family_id and r.is_active;
  if reward.id is null then
    raise exception 'Hadiah tidak ditemukan' using errcode = 'no_data_found';
  end if;

  perform pg_advisory_xact_lock(hashtext(me.id::text));
  select coalesce(sum(q.cost), 0) into held from public.reward_requests q
  where q.member_id = me.id and q.status = 'pending';
  if private.point_balance(me.id) - held < reward.cost then
    raise exception 'Poin belum cukup' using errcode = 'check_violation';
  end if;

  insert into public.reward_requests (family_id, reward_id, member_id, cost)
  values (me.family_id, reward.id, me.id, reward.cost)
  returning reward_requests.id into id;
  return id;
end;
$$;

revoke all on function public.request_reward(uuid) from public, anon;
grant execute on function public.request_reward(uuid) to authenticated;

-- Ayah/Ibu menyetujui (poin dikurangi) atau menolak permintaan.
create function public.decide_reward(request_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.members := private.my_member();
  request public.reward_requests;
begin
  if me.role is null or me.role not in ('father', 'mother') then
    raise exception 'Hanya ayah atau ibu yang bisa memutuskan' using errcode = 'insufficient_privilege';
  end if;
  select * into request from public.reward_requests q
  where q.id = request_id and q.family_id = me.family_id and q.status = 'pending'
  for update;
  if request.id is null then
    raise exception 'Permintaan tidak ditemukan' using errcode = 'no_data_found';
  end if;

  if approve then
    perform pg_advisory_xact_lock(hashtext(request.member_id::text));
    if private.point_balance(request.member_id) < request.cost then
      raise exception 'Poin belum cukup' using errcode = 'check_violation';
    end if;
    insert into public.point_ledger (family_id, member_id, points, kind, note, created_by)
    values (request.family_id, request.member_id, -request.cost, 'redeem',
      (select r.name from public.rewards r where r.id = request.reward_id), me.id);
  end if;

  update public.reward_requests
  set status = case when approve then 'approved' else 'rejected' end,
    decided_by = me.id, decided_at = now()
  where id = request.id;
end;
$$;

revoke all on function public.decide_reward(uuid, boolean) from public, anon;
grant execute on function public.decide_reward(uuid, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rewards, public.reward_requests;
  end if;
end;
$$;
