-- PokerBank v0.7 — social: perfiles, amigos y feed de sesiones. Idempotente.
-- EJECÚTALA ANTES de desplegar la v0.7. Requiere el esquema base y la migración 004 (usa bounty_total).
--
-- Privacidad por diseño:
--  · Tus sesiones, bolsas y movimientos siguen siendo solo tuyos (no se toca su RLS).
--  · Lo que ven los amigos es una "instantánea" que tú publicas a mano (shared_sessions): tipo de juego,
--    duración, ROI en %, ITM, puesto y una nota. NUNCA importes en euros.
--  · Las estadísticas del perfil (sesiones, horas, ROI %, ITM %) solo las ve un amigo aceptado y solo si
--    activas "mostrar estadísticas" en tu perfil.

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
