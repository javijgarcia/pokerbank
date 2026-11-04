-- PokerBank v0.5 — torneos con bounty (KO). Idempotente.
-- EJECÚTALA ANTES de desplegar la v0.5. Si instalas desde cero con schema.sql, ya viene incluida.
-- Requiere haber ejecutado antes 002 y 003 si vienes de una versión anterior.

alter table public.sessions add column if not exists has_bounty   boolean not null default false;
alter table public.sessions add column if not exists bounty_total numeric(12,2) not null default 0;
alter table public.sessions add column if not exists bounty_count int not null default 0;

alter table public.presets  add column if not exists has_bounty   boolean not null default false;
