-- PokerBank v0.6.1 — borrar la propia cuenta y todos sus datos. Idempotente.
-- EJECÚTALA ANTES de desplegar la v0.6.1 (sin ella, el botón «Borrar mi cuenta» avisa de que falta).
-- Al borrar el usuario de auth.users, las tablas de la app se vacían solas (on delete cascade).
-- Las fotos de recibos las borra la propia app antes de llamar a esta función.

create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
