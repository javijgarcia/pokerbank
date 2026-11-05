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
