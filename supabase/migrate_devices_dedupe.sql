-- =============================================================================
-- Устройства: один ряд на пару (user_id, label) — без дублей Edge/Safari
-- Supabase → SQL Editor → Run
-- =============================================================================

-- Оставляем самую свежую запись на каждый label
delete from public.user_devices a
using public.user_devices b
where a.user_id = b.user_id
  and a.label = b.label
  and (
    a.last_seen < b.last_seen
    or (a.last_seen = b.last_seen and a.id::text < b.id::text)
  );

drop index if exists user_devices_user_id_device_key_key;
alter table public.user_devices
  drop constraint if exists user_devices_user_id_device_key_key;

create unique index if not exists user_devices_user_label_uidx
  on public.user_devices (user_id, label);

-- device_key по-прежнему нужен для «это устройство», но не обязан быть unique
create index if not exists user_devices_user_device_key_idx
  on public.user_devices (user_id, device_key);
