-- =============================================================================
-- Блокировка входа: 5 неверных паролей подряд → 3 минуты
-- Выполните в Supabase SQL Editor.
--
-- Серверный счётчик + auth.users.banned_until:
-- не обходится localStorage / инкогнито / прямым signInWithPassword.
-- =============================================================================

create table if not exists public.login_lockouts (
  login_key text primary key,
  failed_count integer not null default 0
    check (failed_count >= 0 and failed_count <= 20),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.login_lockouts is
  'Счётчик неудачных входов (login_key = lower(trim(email))).';

alter table public.login_lockouts enable row level security;

revoke all on table public.login_lockouts from anon, authenticated, public;

create or replace function public.get_login_lock_status(p_login_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(p_login_key, '')));
  v_failed integer := 0;
  v_locked timestamptz;
  v_banned timestamptz;
  v_until timestamptz;
  v_secs integer;
begin
  if v_key = '' then
    return json_build_object(
      'locked', false,
      'failed_count', 0,
      'retry_after_seconds', 0,
      'locked_until', null
    );
  end if;

  select failed_count, locked_until
    into v_failed, v_locked
  from public.login_lockouts
  where login_key = v_key;

  select u.banned_until
    into v_banned
  from auth.users u
  where lower(u.email) = v_key
  limit 1;

  v_until := null;
  if v_locked is not null and v_locked > now() then
    v_until := v_locked;
  end if;
  if v_banned is not null and v_banned > now() then
    if v_until is null or v_banned > v_until then
      v_until := v_banned;
    end if;
  end if;

  if v_until is not null then
    v_secs := greatest(1, ceil(extract(epoch from (v_until - now())))::integer);
    return json_build_object(
      'locked', true,
      'failed_count', coalesce(v_failed, 0),
      'retry_after_seconds', v_secs,
      'locked_until', v_until
    );
  end if;

  -- Просроченный лок: сброс
  if v_locked is not null and v_locked <= now() then
    update public.login_lockouts
    set failed_count = 0,
        locked_until = null,
        updated_at = now()
    where login_key = v_key;
    v_failed := 0;
  end if;

  if v_banned is not null and v_banned <= now() then
    update auth.users
    set banned_until = null
    where lower(email) = v_key
      and banned_until is not null
      and banned_until <= now();
  end if;

  return json_build_object(
    'locked', false,
    'failed_count', coalesce(v_failed, 0),
    'retry_after_seconds', 0,
    'locked_until', null
  );
end;
$$;

create or replace function public.record_login_failure(p_login_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(p_login_key, '')));
  v_count integer;
  v_until timestamptz;
  v_secs integer;
  v_status json;
begin
  if v_key = '' then
    return json_build_object(
      'locked', false,
      'failed_count', 0,
      'retry_after_seconds', 0,
      'locked_until', null
    );
  end if;

  v_status := public.get_login_lock_status(v_key);
  if (v_status->>'locked')::boolean then
    return v_status;
  end if;

  -- Считаем только существующие аккаунты (нет смысла банить «пустой» email).
  if not exists (
    select 1 from auth.users u where lower(u.email) = v_key
  ) then
    return json_build_object(
      'locked', false,
      'failed_count', 0,
      'retry_after_seconds', 0,
      'locked_until', null
    );
  end if;

  insert into public.login_lockouts (login_key, failed_count, locked_until, updated_at)
  values (v_key, 1, null, now())
  on conflict (login_key) do update
  set failed_count = case
        when public.login_lockouts.locked_until is not null
             and public.login_lockouts.locked_until <= now()
          then 1
        else public.login_lockouts.failed_count + 1
      end,
      locked_until = null,
      updated_at = now()
  returning failed_count into v_count;

  if v_count >= 5 then
    v_until := now() + interval '3 minutes';

    update public.login_lockouts
    set failed_count = 0,
        locked_until = v_until,
        updated_at = now()
    where login_key = v_key;

    update auth.users
    set banned_until = v_until
    where lower(email) = v_key;

    v_secs := greatest(1, ceil(extract(epoch from (v_until - now())))::integer);

    return json_build_object(
      'locked', true,
      'failed_count', 0,
      'retry_after_seconds', v_secs,
      'locked_until', v_until
    );
  end if;

  return json_build_object(
    'locked', false,
    'failed_count', v_count,
    'retry_after_seconds', 0,
    'locked_until', null
  );
end;
$$;

create or replace function public.clear_login_failures(p_login_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(p_login_key, '')));
  v_status json;
begin
  if v_key = '' then
    return json_build_object('ok', true);
  end if;

  -- Нельзя снять активную блокировку через RPC (иначе anon обойдёт бан).
  v_status := public.get_login_lock_status(v_key);
  if (v_status->>'locked')::boolean then
    return json_build_object(
      'ok', false,
      'locked', true,
      'retry_after_seconds', (v_status->>'retry_after_seconds')::integer,
      'locked_until', v_status->>'locked_until'
    );
  end if;

  -- Только сброс счётчика после успешного входа (бан уже не активен).
  update public.login_lockouts
  set failed_count = 0,
      locked_until = null,
      updated_at = now()
  where login_key = v_key
    and (locked_until is null or locked_until <= now());

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.get_login_lock_status(text) from public;
revoke all on function public.record_login_failure(text) from public;
revoke all on function public.clear_login_failures(text) from public;

grant execute on function public.get_login_lock_status(text) to anon, authenticated;
grant execute on function public.record_login_failure(text) to anon, authenticated;
grant execute on function public.clear_login_failures(text) to anon, authenticated;
