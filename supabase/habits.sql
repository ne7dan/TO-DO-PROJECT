-- =============================================================================
-- Привычки пользователя (синхронизация между устройствами)
-- Supabase → SQL Editor → Run
-- =============================================================================

create table if not exists public.habits (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null
    check (char_length(text) > 0 and char_length(text) <= 200),
  start_date date not null,
  completions jsonb not null default '{}'::jsonb,
  skipped_dates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists habits_user_id_idx on public.habits (user_id);
create index if not exists habits_user_start_idx on public.habits (user_id, start_date);

alter table public.habits enable row level security;

drop policy if exists "habits_select_own" on public.habits;
create policy "habits_select_own"
  on public.habits for select
  using (auth.uid() = user_id);

drop policy if exists "habits_insert_own" on public.habits;
create policy "habits_insert_own"
  on public.habits for insert
  with check (auth.uid() = user_id);

drop policy if exists "habits_update_own" on public.habits;
create policy "habits_update_own"
  on public.habits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "habits_delete_own" on public.habits;
create policy "habits_delete_own"
  on public.habits for delete
  using (auth.uid() = user_id);
