-- =====================================================================
--  Revela · esquema para Supabase
--  Pega todo este archivo en Supabase → SQL Editor → Run.
--  Es idempotente para la primera instalación (crea tablas y funciones).
--
--  Modelo de seguridad (privacy-first):
--  · El navegador SOLO puede LEER datos públicos (eventos, predicciones
--    visibles y noticias). No hay políticas de INSERT/UPDATE/DELETE.
--  · Toda escritura pasa por funciones RPC que validan los datos.
--  · La llave del anfitrión y el identificador de cada dispositivo se
--    guardan como hash SHA-256 en tablas sin acceso público.
--  · El correo del anfitrión nunca es legible desde el navegador.
--  · El resultado de la revelación NO existe en la base hasta que el
--    anfitrión pulsa "Revelar" — no hay forma de espiarlo antes.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
--  Tablas
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{4,60}$'),
  baby_name     text not null check (char_length(baby_name) between 1 and 100),
  parents       text not null check (char_length(parents) between 1 and 100),
  due_date      date not null,
  message       text check (char_length(message) <= 400),
  photo_data    text check (char_length(photo_data) <= 450000),   -- imagen reducida (data URL)
  theme         text not null default 'clasico' check (theme in ('clasico','noche','pastel')),
  voting_open   boolean not null default true,
  revealed_team text check (revealed_team in ('nina','nino','gemelos')),
  revealed_at   timestamptz,
  birth_date    date,
  created_at    timestamptz not null default now()
);

create table if not exists public.event_secrets (
  event_id      uuid primary key references public.events(id) on delete cascade,
  admin_hash    text not null,
  contact_email text check (char_length(contact_email) <= 200)
);

create table if not exists public.predictions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  team        text not null check (team in ('nina','nino','gemelos')),
  birth_guess date,
  message     text check (char_length(message) <= 500),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists predictions_event_idx on public.predictions(event_id, created_at desc);

create table if not exists public.prediction_secrets (
  prediction_id uuid primary key references public.predictions(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  device_hash   text not null,
  unique (event_id, device_hash)
);

create table if not exists public.news (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  emoji      text check (char_length(emoji) <= 16),
  title      text not null check (char_length(title) between 1 and 120),
  body       text check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists news_event_idx on public.news(event_id, created_at desc);

-- ---------------------------------------------------------------------
--  Row Level Security: lectura pública, cero escritura directa
-- ---------------------------------------------------------------------
alter table public.events             enable row level security;
alter table public.event_secrets      enable row level security;
alter table public.predictions        enable row level security;
alter table public.prediction_secrets enable row level security;
alter table public.news               enable row level security;

drop policy if exists "leer eventos" on public.events;
create policy "leer eventos" on public.events for select using (true);

drop policy if exists "leer predicciones visibles" on public.predictions;
create policy "leer predicciones visibles" on public.predictions for select using (hidden = false);

drop policy if exists "leer noticias" on public.news;
create policy "leer noticias" on public.news for select using (true);
-- event_secrets y prediction_secrets: sin políticas = inaccesibles.

revoke all on public.event_secrets, public.prediction_secrets from anon, authenticated;
revoke insert, update, delete on public.events, public.predictions, public.news from anon, authenticated;
grant select on public.events, public.predictions, public.news to anon, authenticated;

-- ---------------------------------------------------------------------
--  Utilidades internas
-- ---------------------------------------------------------------------
create or replace function public._sha(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(p, 'sha256'), 'hex')
$$;

create or replace function public._admin_event(p_slug text, p_key text)
returns public.events
language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  select ev.* into e
    from public.events ev join public.event_secrets s on s.event_id = ev.id
   where ev.slug = p_slug and s.admin_hash = public._sha(coalesce(p_key,''));
  if e.id is null then
    raise exception 'Llave de anfitrión inválida' using errcode = '28000';
  end if;
  return e;
end $$;

revoke execute on function public._sha(text) from public, anon, authenticated;
revoke execute on function public._admin_event(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
--  RPC: crear evento  → devuelve slug y llave del anfitrión (una sola vez)
-- ---------------------------------------------------------------------
create or replace function public.create_event(
  p_baby_name text, p_parents text, p_due_date date,
  p_message text default null, p_photo_data text default null,
  p_email text default null, p_theme text default 'clasico'
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_base text; v_slug text; v_key text; v_id uuid;
begin
  if p_due_date < current_date - 60 or p_due_date > current_date + 400 then
    raise exception 'Fecha de parto fuera de rango';
  end if;
  v_base := lower(regexp_replace(
              translate(trim(p_baby_name), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
              '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from left(v_base, 40));
  if v_base = '' then v_base := 'bebe'; end if;
  v_slug := v_base || '-' || encode(extensions.gen_random_bytes(3), 'hex');
  v_key  := encode(extensions.gen_random_bytes(18), 'hex');

  insert into public.events (slug, baby_name, parents, due_date, message, photo_data, theme)
  values (v_slug, trim(p_baby_name), trim(p_parents), p_due_date,
          nullif(trim(p_message), ''), p_photo_data, coalesce(p_theme, 'clasico'))
  returning id into v_id;

  insert into public.event_secrets (event_id, admin_hash, contact_email)
  values (v_id, public._sha(v_key), nullif(trim(p_email), ''));

  return json_build_object('slug', v_slug, 'admin_key', v_key);
end $$;

-- ---------------------------------------------------------------------
--  RPC: invitados
-- ---------------------------------------------------------------------
-- Crea o actualiza la predicción de este dispositivo (una por dispositivo).
create or replace function public.submit_prediction(
  p_slug text, p_device text, p_name text, p_team text,
  p_birth_guess date default null, p_message text default null
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  e public.events; v_hash text; v_pid uuid;
begin
  if p_device is null or char_length(p_device) < 20 or char_length(p_device) > 100 then
    raise exception 'Dispositivo inválido';
  end if;
  select * into e from public.events where slug = p_slug;
  if e.id is null then raise exception 'Evento no encontrado'; end if;
  if e.revealed_team is not null or not e.voting_open then
    raise exception 'Las predicciones ya están cerradas';
  end if;
  if p_birth_guess is not null and
     (p_birth_guess < e.due_date - 120 or p_birth_guess > e.due_date + 60) then
    raise exception 'La fecha debe estar cerca de la fecha de parto';
  end if;

  v_hash := public._sha(p_device);
  select prediction_id into v_pid from public.prediction_secrets
   where event_id = e.id and device_hash = v_hash;

  if v_pid is null then
    insert into public.predictions (event_id, name, team, birth_guess, message)
    values (e.id, trim(p_name), p_team, p_birth_guess, nullif(trim(p_message), ''))
    returning id into v_pid;
    insert into public.prediction_secrets (prediction_id, event_id, device_hash)
    values (v_pid, e.id, v_hash);
  else
    update public.predictions
       set name = trim(p_name), team = p_team, birth_guess = p_birth_guess,
           message = nullif(trim(p_message), ''), updated_at = now()
     where id = v_pid;
  end if;
  return json_build_object('id', v_pid);
end $$;

-- Devuelve la predicción de este dispositivo (aunque esté oculta).
create or replace function public.get_my_prediction(p_slug text, p_device text)
returns json
language sql stable security definer set search_path = public, extensions as $$
  select row_to_json(p) from public.predictions p
    join public.prediction_secrets s on s.prediction_id = p.id
    join public.events e on e.id = p.event_id
   where e.slug = p_slug and s.device_hash = public._sha(coalesce(p_device,''))
$$;

-- ---------------------------------------------------------------------
--  RPC: anfitrión (todas exigen slug + llave)
-- ---------------------------------------------------------------------
create or replace function public.admin_check(p_slug text, p_key text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  e := public._admin_event(p_slug, p_key);
  return json_build_object('ok', true, 'event_id', e.id,
    'email', (select contact_email from public.event_secrets where event_id = e.id));
end $$;

create or replace function public.admin_update_event(p_slug text, p_key text, p jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  e := public._admin_event(p_slug, p_key);
  update public.events set
    baby_name  = coalesce(nullif(trim(p->>'baby_name'), ''), baby_name),
    parents    = coalesce(nullif(trim(p->>'parents'), ''), parents),
    due_date   = coalesce((p->>'due_date')::date, due_date),
    message    = case when p ? 'message' then nullif(trim(p->>'message'), '') else message end,
    photo_data = case when p ? 'photo_data' then nullif(p->>'photo_data', '') else photo_data end,
    theme      = coalesce(p->>'theme', theme),
    voting_open= coalesce((p->>'voting_open')::boolean, voting_open)
  where id = e.id;
end $$;

create or replace function public.admin_reveal(p_slug text, p_key text, p_team text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  e := public._admin_event(p_slug, p_key);
  if p_team is not null and p_team not in ('nina','nino','gemelos') then
    raise exception 'Equipo inválido';
  end if;
  update public.events
     set revealed_team = p_team,
         revealed_at   = case when p_team is null then null else now() end
   where id = e.id;
end $$;

create or replace function public.admin_set_birth(p_slug text, p_key text, p_date date)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  e := public._admin_event(p_slug, p_key);
  update public.events set birth_date = p_date where id = e.id;
end $$;

create or replace function public.admin_list_predictions(p_slug text, p_key text)
returns setof public.predictions
language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  e := public._admin_event(p_slug, p_key);
  return query select * from public.predictions where event_id = e.id order by created_at desc;
end $$;

create or replace function public.admin_set_hidden(p_slug text, p_key text, p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  e := public._admin_event(p_slug, p_key);
  update public.predictions set hidden = p_hidden where id = p_id and event_id = e.id;
end $$;

create or replace function public.admin_delete_prediction(p_slug text, p_key text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  e := public._admin_event(p_slug, p_key);
  delete from public.predictions where id = p_id and event_id = e.id;
end $$;

create or replace function public.admin_post_news(p_slug text, p_key text, p_emoji text, p_title text, p_body text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare e public.events; v_id uuid;
begin
  e := public._admin_event(p_slug, p_key);
  insert into public.news (event_id, emoji, title, body)
  values (e.id, nullif(trim(p_emoji), ''), trim(p_title), nullif(trim(p_body), ''))
  returning id into v_id;
  return json_build_object('id', v_id);
end $$;

create or replace function public.admin_delete_news(p_slug text, p_key text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  e := public._admin_event(p_slug, p_key);
  delete from public.news where id = p_id and event_id = e.id;
end $$;

create or replace function public.admin_delete_event(p_slug text, p_key text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare e public.events;
begin
  e := public._admin_event(p_slug, p_key);
  delete from public.events where id = e.id;   -- borra en cascada todo lo demás
end $$;

-- Permisos de ejecución: solo las RPC públicas
grant execute on function
  public.create_event(text, text, date, text, text, text, text),
  public.submit_prediction(text, text, text, text, date, text),
  public.get_my_prediction(text, text),
  public.admin_check(text, text),
  public.admin_update_event(text, text, jsonb),
  public.admin_reveal(text, text, text),
  public.admin_set_birth(text, text, date),
  public.admin_list_predictions(text, text),
  public.admin_set_hidden(text, text, uuid, boolean),
  public.admin_delete_prediction(text, text, uuid),
  public.admin_post_news(text, text, text, text, text),
  public.admin_delete_news(text, text, uuid),
  public.admin_delete_event(text, text)
to anon, authenticated;

-- ---------------------------------------------------------------------
--  Tiempo real (los invitados ven votos, noticias y la revelación al
--  instante). Si la publicación no existe, se ignora sin error.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.events;      exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.predictions; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.news;        exception when duplicate_object then null; end;
  end if;
end $$;
