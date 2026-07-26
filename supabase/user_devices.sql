-- Устройства / сессии входа пользователя.
-- Supabase → SQL Editor → Run

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_key text not null,
  label text not null default 'Device',
  user_agent text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_key)
);

create index if not exists user_devices_user_id_idx on public.user_devices (user_id);

alter table public.user_devices enable row level security;

drop policy if exists "devices_select_own" on public.user_devices;
create policy "devices_select_own"
  on public.user_devices for select
  using (auth.uid() = user_id);

drop policy if exists "devices_upsert_own" on public.user_devices;
create policy "devices_upsert_own"
  on public.user_devices for insert
  with check (auth.uid() = user_id);

drop policy if exists "devices_update_own" on public.user_devices;
create policy "devices_update_own"
  on public.user_devices for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "devices_delete_own" on public.user_devices;
create policy "devices_delete_own"
  on public.user_devices for delete
  using (auth.uid() = user_id);
