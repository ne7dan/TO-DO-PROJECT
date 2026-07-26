-- Выполни ОДИН раз: Supabase → SQL Editor → Run
-- Идемпотентно: можно запускать повторно.

-- Базовые колонки
alter table public.todos add column if not exists text text;
alter table public.todos add column if not exists title text;
alter table public.todos add column if not exists completed boolean not null default false;
alter table public.todos add column if not exists period text not null default 'day';
alter table public.todos add column if not exists date date;
alter table public.todos add column if not exists subtasks jsonb not null default '[]'::jsonb;
alter table public.todos add column if not exists priority text not null default 'none';
alter table public.todos add column if not exists estimated_minutes integer not null default 0;
alter table public.todos add column if not exists spent_seconds integer not null default 0;
alter table public.todos add column if not exists habit_id text;
alter table public.todos add column if not exists sort_order double precision not null default 0;
alter table public.todos add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.todos add column if not exists created_at timestamptz not null default now();

-- title → text, если text пустой
update public.todos
set text = title
where (text is null or text = '') and title is not null and title <> '';

-- sort_order: integer → double (Date.now не влезал в integer)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'todos'
      and column_name = 'sort_order' and data_type = 'integer'
  ) then
    alter table public.todos
      alter column sort_order type double precision
      using coalesce(sort_order, 0)::double precision;
  end if;
end $$;

-- habit_id: uuid → text (id привычек вроде 1784...-abc)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'todos'
      and column_name = 'habit_id' and udt_name = 'uuid'
  ) then
    alter table public.todos
      alter column habit_id type text
      using habit_id::text;
  end if;
end $$;
