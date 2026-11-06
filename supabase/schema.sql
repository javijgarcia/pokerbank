-- PokerBank v0.1 — esquema multiusuario con Row Level Security
-- Ejecutar completo en Supabase > SQL Editor.

create extension if not exists "pgcrypto";

-- ───────────────────────── Bolsas (bankrolls) ─────────────────────────
create table if not exists public.banks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null,
  initial_amount numeric(12,2) not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ───────────────── Ingresos y retiradas de cada bolsa ─────────────────
-- amount > 0 = ingreso, amount < 0 = retirada
create table if not exists public.bank_movements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_id     uuid not null references public.banks(id) on delete cascade,
  amount      numeric(12,2) not null,
  note        text,
  occurred_at timestamptz not null default now()
);

-- ───────────────────────────── Sesiones ─────────────────────────────
-- El id lo genera el cliente (permite guardar offline y sincronizar después sin duplicar).
create table if not exists public.sessions (
  id               uuid primary key,
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_id          uuid not null references public.banks(id) on delete cascade,
  game_type        text not null check (game_type in ('cash', 'tournament')),
  venue            text not null check (venue in ('live', 'online')),
  place            text,
  tournament_name  text,                     -- solo torneos
  has_bounty       boolean not null default false,       -- torneo KO / con bounty
  bounty_total     numeric(12,2) not null default 0,     -- bounties ganados (incluidos en cash_out)
  bounty_count     int not null default 0,               -- eliminaciones con bounty
  stake            numeric(12,2),            -- cash: nivel (NL5 = 5); torneo: buy-in inicial (= ABI)
  buy_in           numeric(12,2) not null,   -- total invertido (incluye recompras / re-entries)
  cash_out         numeric(12,2) not null default 0,
  entries          int not null default 1,   -- nº de buy-ins / re-entries
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  duration_seconds int not null default 0,   -- tiempo jugado, sin pausas
  mood             smallint check (mood between 1 and 5),
  play_quality     smallint check (play_quality between 1 and 5),
  notes            text,
  tags             text[] not null default '{}',
  players          int,                      -- solo torneos
  position         int,                      -- solo torneos
  created_at       timestamptz not null default now()
);

create index if not exists sessions_user_ended_idx on public.sessions (user_id, ended_at desc);
create index if not exists sessions_bank_idx on public.sessions (bank_id);
create index if not exists movements_bank_idx on public.bank_movements (bank_id, occurred_at);

-- ─────────────────── Reglas de nivel por bolsa y tipo ───────────────────
-- buyins:      nº de buy-ins necesarios por nivel (torneos: 100 buy-ins = 1% del bank)
-- down_buyins: por debajo de este nº de buy-ins se recomienda bajar de nivel
-- ladder:      escalera de niveles (NL en cash, ABI en torneos)
create table if not exists public.level_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_id     uuid not null references public.banks(id) on delete cascade,
  game_type   text not null check (game_type in ('cash', 'tournament')),
  buyins      numeric(8,2) not null default 100 check (buyins > 0),
  down_buyins numeric(8,2) not null default 70 check (down_buyins > 0),
  ladder      numeric(12,2)[] not null,
  unique (bank_id, game_type)
);

-- ───────────────────────────── Objetivos ─────────────────────────────
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_id    uuid references public.banks(id) on delete cascade, -- null = todas las bolsas
  kind       text not null check (kind in ('monthly_profit', 'monthly_hours', 'bank_target')),
  target     numeric(12,2) not null check (target > 0),
  created_at timestamptz not null default now()
);

-- ───────────────────── Presets de sesión (inicio con un toque) ─────────────────────
create table if not exists public.presets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_id    uuid not null references public.banks(id) on delete cascade,
  name       text not null,
  game_type  text not null check (game_type in ('cash', 'tournament')),
  venue      text not null check (venue in ('live', 'online')),
  place      text,
  tournament_name text,
  has_bounty boolean not null default false,
  stake      numeric(12,2),
  buy_in     numeric(12,2),
  created_at timestamptz not null default now()
);

-- ───────────────────── Row Level Security (aislamiento) ─────────────────────
alter table public.banks          enable row level security;
alter table public.bank_movements enable row level security;
alter table public.sessions       enable row level security;
alter table public.level_rules    enable row level security;
alter table public.goals          enable row level security;
alter table public.presets        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['banks', 'bank_movements', 'sessions', 'level_rules', 'goals', 'presets']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Un usuario solo puede referenciar bolsas suyas (evita insertar filas en la bolsa de otro).
create or replace function public.enforce_own_bank() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.banks b where b.id = new.bank_id and b.user_id = new.user_id) then
    raise exception 'bank_id does not belong to user';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['bank_movements', 'sessions', 'level_rules', 'presets']
  loop
    execute format('drop trigger if exists enforce_own_bank on public.%I', t);
    execute format(
      'create trigger enforce_own_bank before insert or update on public.%I
         for each row execute function public.enforce_own_bank()', t);
  end loop;
end $$;

-- ───────────── v0.6: calendario de torneos y recibos ─────────────
create table if not exists public.scheduled_tournaments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_id    uuid not null references public.banks(id) on delete cascade,
  name       text not null,
  venue      text not null check (venue in ('live', 'online')),
  place      text,
  buy_in     numeric(12,2) not null check (buy_in > 0),
  has_bounty boolean not null default false,
  starts_at  timestamptz not null,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_user_start_idx on public.scheduled_tournaments (user_id, starts_at);
alter table public.scheduled_tournaments enable row level security;
drop policy if exists "own rows" on public.scheduled_tournaments;
create policy "own rows" on public.scheduled_tournaments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists enforce_own_bank on public.scheduled_tournaments;
create trigger enforce_own_bank before insert or update on public.scheduled_tournaments
  for each row execute function public.enforce_own_bank();

alter table public.sessions add column if not exists receipt_path text;

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
drop policy if exists "own receipts" on storage.objects;
create policy "own receipts" on storage.objects for all to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ───────────── v0.7: social (perfiles, amigos y feed) ─────────────
-- ───────────────────────────── Perfiles ─────────────────────────────
create table if not exists public.profiles (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username     text not null,
  display_name text not null,
  show_stats   boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint display_name_len check (char_length(display_name) between 1 and 40)
);
create unique index if not exists profiles_username_key on public.profiles (username);

-- ───────────────────────────── Amistades ─────────────────────────────
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  constraint not_self check (requester_id <> addressee_id)
);
-- Una sola amistad por pareja, sin importar quién la pidió.
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- ─────────────── Sesiones publicadas en el feed (instantánea sin euros) ───────────────
create table if not exists public.shared_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id       uuid not null,               -- sesión de origen (solo para no publicarla dos veces)
  game_type        text not null check (game_type in ('cash', 'tournament')),
  venue            text not null check (venue in ('live', 'online')),
  tournament_name  text,
  duration_seconds int not null default 0,
  roi_pct          numeric(9,2),                -- (cash_out - buy_in) / buy_in * 100
  itm              boolean,                     -- solo torneos: premio sin bounties > 0
  position         int,
  players          int,
  mood             smallint check (mood between 1 and 5),
  caption          text check (char_length(caption) <= 280),
  ended_at         timestamptz not null,
  created_at       timestamptz not null default now(),
  unique (user_id, session_id)
);
create index if not exists shared_user_ended_idx on public.shared_sessions (user_id, ended_at desc);

-- ───────────────────────── Funciones auxiliares ─────────────────────────
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- Búsqueda exacta por nombre de usuario (no se puede listar a todos los usuarios).
create or replace function public.lookup_profile(p_username text)
returns table (user_id uuid, username text, display_name text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.display_name
  from public.profiles p
  where p.username = lower(trim(p_username)) and p.user_id <> auth.uid();
$$;

-- Estadísticas agregadas de un amigo (solo %, horas y recuentos), si él las ha activado.
create or replace function public.friend_stats(p_user uuid)
returns table (sessions bigint, hours numeric, roi_pct numeric, itm_pct numeric)
language sql stable security definer set search_path = public as $$
  select
    count(*)::bigint,
    round(coalesce(sum(s.duration_seconds), 0) / 3600.0, 1),
    case when coalesce(sum(s.buy_in), 0) > 0
         then round((sum(s.cash_out) - sum(s.buy_in)) / sum(s.buy_in) * 100, 1) end,
    case when count(*) filter (where s.game_type = 'tournament') > 0
         then round(
           count(*) filter (where s.game_type = 'tournament' and s.cash_out - coalesce(s.bounty_total, 0) > 0.004)::numeric
           / count(*) filter (where s.game_type = 'tournament') * 100, 1) end
  from public.sessions s
  where s.user_id = p_user
    and public.are_friends(auth.uid(), p_user)
    and exists (select 1 from public.profiles p where p.user_id = p_user and p.show_stats);
$$;

revoke all on function public.are_friends(uuid, uuid) from public, anon;
revoke all on function public.lookup_profile(text) from public, anon;
revoke all on function public.friend_stats(uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.lookup_profile(text) to authenticated;
grant execute on function public.friend_stats(uuid) to authenticated;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles        enable row level security;
alter table public.friendships     enable row level security;
alter table public.shared_sessions enable row level security;

-- Perfiles: el tuyo, y el de quien tenga contigo una amistad (pendiente o aceptada).
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.friendships f
             where (f.requester_id = auth.uid() and f.addressee_id = profiles.user_id)
                or (f.addressee_id = auth.uid() and f.requester_id = profiles.user_id))
);
drop policy if exists "profiles insert" on public.profiles;
create policy "profiles insert" on public.profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "profiles delete" on public.profiles;
create policy "profiles delete" on public.profiles for delete to authenticated using (user_id = auth.uid());

-- Amistades: solo las tuyas. Pides tú (pending); solo quien recibe la petición puede aceptarla.
drop policy if exists "friendships read" on public.friendships;
create policy "friendships read" on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "friendships request" on public.friendships;
create policy "friendships request" on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
drop policy if exists "friendships accept" on public.friendships;
create policy "friendships accept" on public.friendships for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending') with check (addressee_id = auth.uid() and status = 'accepted');
drop policy if exists "friendships delete" on public.friendships;
create policy "friendships delete" on public.friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Feed: lo ves tú y tus amigos aceptados; solo tú publicas y borras lo tuyo.
drop policy if exists "shared read" on public.shared_sessions;
create policy "shared read" on public.shared_sessions for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
drop policy if exists "shared insert" on public.shared_sessions;
create policy "shared insert" on public.shared_sessions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "shared delete" on public.shared_sessions;
create policy "shared delete" on public.shared_sessions for delete to authenticated using (user_id = auth.uid());
