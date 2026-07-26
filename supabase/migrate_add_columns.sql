-- Выполни ЦЕЛИКОМ в SQL Editor и нажми зелёную кнопку Run.
-- Потом: Table Editor → todos — должна появиться колонка text.

alter table public.todos
  add column if not exists "text" text;

alter table public.todos
  add column if not exists completed boolean not null default false;

alter table public.todos
  add column if not exists period text not null default 'day';

alter table public.todos
  add column if not exists "date" date;

alter table public.todos
  add column if not exists subtasks jsonb not null default '[]'::jsonb;

alter table public.todos
  add column if not exists priority text not null default 'none';

alter table public.todos
  add column if not exists estimated_minutes integer not null default 0;

alter table public.todos
  add column if not exists spent_seconds integer not null default 0;

-- habit_id как text: в приложении id привычек — строки вида "1784...-abc", не uuid
alter table public.todos
  add column if not exists habit_id text;

alter table public.todos
  add column if not exists sort_order double precision not null default 0;

alter table public.todos
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.todos
  add column if not exists created_at timestamptz not null default now();

-- Если раньше создали title вместо text — скопируем данные
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'todos' and column_name = 'title'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'todos' and column_name = 'text'
  ) then
    update public.todos set "text" = coalesce("text", title) where "text" is null;
  end if;
end $$;
