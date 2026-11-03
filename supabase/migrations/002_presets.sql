-- PokerBank v0.2 — presets de sesión (idempotente: se puede ejecutar más de una vez).
-- Si instalas desde cero con schema.sql, esto ya viene incluido.

create table if not exists public.presets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_id    uuid not null references public.banks(id) on delete cascade,
  name       text not null,
  game_type  text not null check (game_type in ('cash', 'tournament')),
  venue      text not null check (venue in ('live', 'online')),
  place      text,
  stake      numeric(12,2),
  buy_in     numeric(12,2),
  created_at timestamptz not null default now()
);

alter table public.presets enable row level security;

drop policy if exists "own rows" on public.presets;
create policy "own rows" on public.presets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists enforce_own_bank on public.presets;
create trigger enforce_own_bank before insert or update on public.presets
  for each row execute function public.enforce_own_bank();
