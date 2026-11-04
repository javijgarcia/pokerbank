-- PokerBank v0.2.1 — nombre del torneo (idempotente).
-- EJECÚTALA ANTES de desplegar la v0.2.1. Si instalas desde cero con schema.sql, ya viene incluida.

alter table public.sessions add column if not exists tournament_name text;
alter table public.presets  add column if not exists tournament_name text;
