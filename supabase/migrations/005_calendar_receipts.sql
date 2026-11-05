-- PokerBank v0.6 — calendario de torneos y recibos. Idempotente.
-- EJECÚTALA ANTES de desplegar la v0.6. Requiere el esquema base y la función enforce_own_bank (schema.sql).

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
