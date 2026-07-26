-- Создаёт public.profiles + триггер.
-- Supabase → SQL Editor → вставь всё → Run query (подтверди предупреждение).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint profiles_nickname_len check (
    char_length(nickname) >= 3 and char_length(nickname) <= 24
  )
);

create unique index if not exists profiles_nickname_lower_idx
  on public.profiles (lower(nickname));

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_for_login" on public.profiles;
create policy "profiles_select_for_login"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  nick text;
  suffix int := 0;
begin
  base := nullif(trim(coalesce(new.raw_user_meta_data->>'nickname', '')), '');
  if base is null then
    base := split_part(new.email, '@', 1);
  end if;
  -- только допустимые символы для ника
  base := regexp_replace(base, '[^[:alnum:]_-]', '', 'g');
  base := left(base, 24);
  if char_length(base) < 3 then
    base := left(replace(new.id::text, '-', ''), 24);
  end if;

  loop
    if suffix = 0 then
      nick := base;
    else
      nick := left(base, greatest(3, 24 - char_length(suffix::text))) || suffix::text;
    end if;

    exit when not exists (
      select 1 from public.profiles p
      where lower(p.nickname) = lower(nick)
        and p.id <> new.id
    );

    suffix := suffix + 1;
    exit when suffix > 9999;
  end loop;

  insert into public.profiles (id, nickname, email)
  values (new.id, nick, lower(new.email))
  on conflict (id) do update
    set nickname = excluded.nickname,
        email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Заполнить профили для уже существующих пользователей
insert into public.profiles (id, nickname, email)
select
  u.id,
  left(
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'nickname'), ''),
      split_part(u.email, '@', 1),
      replace(u.id::text, '-', '')
    ),
    24
  ),
  lower(u.email)
from auth.users u
on conflict (id) do nothing;
