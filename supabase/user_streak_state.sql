-- =============================================================================
-- Стрик и авто-заморозки (синхронизация между устройствами)
-- Supabase → SQL Editor → Run
-- =============================================================================

create table if not exists public.user_streak_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  completed_days jsonb not null default '[]'::jsonb,
  freeze_dates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_streak_state enable row level security;

drop policy if exists "streak_select_own" on public.user_streak_state;
create policy "streak_select_own"
  on public.user_streak_state for select
  using (auth.uid() = user_id);

drop policy if exists "streak_insert_own" on public.user_streak_state;
create policy "streak_insert_own"
  on public.user_streak_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "streak_update_own" on public.user_streak_state;
create policy "streak_update_own"
  on public.user_streak_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "streak_delete_own" on public.user_streak_state;
create policy "streak_delete_own"
  on public.user_streak_state for delete
  using (auth.uid() = user_id);
