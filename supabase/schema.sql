-- Схема таблицы todos под текущее React-приложение.
-- Если таблица уже есть — сравните колонки и при необходимости выполните ALTER.
-- RLS: пользователь видит/меняет только свои строки (auth.uid() = user_id).

create extension if not exists "pgcrypto";

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) > 0 and char_length(text) <= 200),
  completed boolean not null default false,
  period text not null default 'day'
    check (period in ('day', 'week', 'month', 'year')),
  date date,
  subtasks jsonb not null default '[]'::jsonb,
  priority text not null default 'none'
    check (priority in ('none', 'low', 'medium', 'high')),
  estimated_minutes integer not null default 0
    check (estimated_minutes >= 0 and estimated_minutes < 1440),
  spent_seconds integer not null default 0 check (spent_seconds >= 0),
  habit_id text,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists todos_user_id_idx on public.todos (user_id);
create index if not exists todos_user_period_date_idx
  on public.todos (user_id, period, date);

alter table public.todos enable row level security;

drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own"
  on public.todos for select
  using (auth.uid() = user_id);

drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own"
  on public.todos for insert
  with check (auth.uid() = user_id);

drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own"
  on public.todos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own"
  on public.todos for delete
  using (auth.uid() = user_id);
