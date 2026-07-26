-- ВНИМАНИЕ: удаляет таблицу todos и создаёт заново под приложение.
-- Делай только если задач в таблице ещё нет (или их можно стереть).
-- SQL Editor → вставь → Run.

drop table if exists public.todos cascade;

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  completed boolean not null default false,
  period text not null default 'day'
    check (period in ('day', 'week', 'month', 'year')),
  date date,
  subtasks jsonb not null default '[]'::jsonb,
  priority text not null default 'none'
    check (priority in ('none', 'low', 'medium', 'high')),
  estimated_minutes integer not null default 0,
  spent_seconds integer not null default 0,
  habit_id text,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now()
);

create index todos_user_id_idx on public.todos (user_id);
create index todos_user_period_date_idx on public.todos (user_id, period, date);

alter table public.todos enable row level security;

create policy "todos_select_own"
  on public.todos for select
  using (auth.uid() = user_id);

create policy "todos_insert_own"
  on public.todos for insert
  with check (auth.uid() = user_id);

create policy "todos_update_own"
  on public.todos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "todos_delete_own"
  on public.todos for delete
  using (auth.uid() = user_id);
