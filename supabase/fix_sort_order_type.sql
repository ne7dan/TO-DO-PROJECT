-- sort_order: Date.now() не влезает в integer (max ~2.1e9).
-- SQL Editor → Run

alter table public.todos
  alter column sort_order type double precision
  using sort_order::double precision;
