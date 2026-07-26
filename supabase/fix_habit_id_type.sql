-- habit_id должен быть text: id привычек в приложении не uuid.
-- SQL Editor → Run

alter table public.todos
  alter column habit_id type text using habit_id::text;
