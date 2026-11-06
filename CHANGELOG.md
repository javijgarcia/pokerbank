# Historial de versiones de PokerBank

## Hechas
- **v0.1**: sesiones cash/torneo (live/online) con temporizador, varias bolsas + Total, gráfico de bankroll por mes, niveles según bankroll (cash 100 buy-ins, torneos ABI = 1 %), objetivos, estado mental y calidad de juego 1-5, registro offline, PWA, multiusuario con RLS.
- **v0.2**: presets de sesión, rachas de sesiones ganadas/perdidas, PDF por sesión, tema oscuro/claro/auto. (Migración `002_presets.sql`)
- **v0.2.1**: torneos sin campo ABI (el buy-in inicial es el ABI), nombre del torneo, estadísticas de torneos con ABI medio. (Migración `003_tournament_name.sql`)
- **v0.3**: Inicio con tarjetas de saldo y «Jugando ahora»; pestaña Estadísticas con Todo/Cash/Torneos y filtro Semana/Mes/Año/General.
- **v0.4**: varias sesiones abiertas a la vez, y racha de días jugando (llama). Sin migración de base de datos.
- **v0.5**: torneos con bounty (KO): interruptor al crear el torneo, «+ Bounty» y notas rápidas (Busteado / Ganado) en Inicio, premio sin bounties + bounties + eliminaciones al cerrar; ITM solo con el premio; estadísticas de bounties. **Requiere migración `supabase/migrations/004_bounties.sql`** (y la 003 si no la ejecutaste).
- **v0.6**: calendario de torneos (programar, «Empezar ahora», exportar a .ics con aviso 30 min antes, próximos torneos en Inicio) y recibos (foto adjunta al cerrar o registrar una sesión, visible desde el historial). **Requiere migración `supabase/migrations/005_calendar_receipts.sql`** (crea la tabla del calendario, el bucket privado `receipts` y sus políticas).
- **v0.6.1** (preparación de la beta): recuperar contraseña, recorrido de bienvenida, botón de feedback con versión, nota de privacidad, exportar datos (JSON) y borrar cuenta. **Requiere migración `supabase/migrations/006_delete_account.sql`** y la variable `NEXT_PUBLIC_FEEDBACK_EMAIL`.
- **v0.6.2**: hora de inicio elegible al abrir una sesión (Ahora, hace 30 min, 1 h, 2 h o una hora exacta; también con presets) y «Cambiar hora de inicio» en una sesión ya abierta. Sin migración.
- **v0.6.3**: en Estadísticas, el modo Bankroll muestra el bankroll total (saldo actual y evolución desde el principio, con ingresos y retiradas) en vez de repetir el beneficio del periodo. Sin migración.
- **v0.7**: social. Página Social con perfil (usuario único), amigos (buscar por usuario, solicitudes, aceptar/rechazar), feed de sesiones que cada uno publica a mano y estadísticas del perfil opcionales para amigos. Botón «Compartir» en el Historial (publicar en el feed y tarjeta de resultado en imagen para WhatsApp) y casilla al cerrar una sesión. Todo sin importes en euros: solo ROI %, tiempo, puesto e ITM. **Requiere migración `supabase/migrations/007_social.sql`** (y la 004).

## Propuesta (el orden lo decides tú)
- **Social, siguientes pasos** (si el feed funciona): reacciones y comentarios, grupos o clubes privados con ranking, avisos de actividad.
- **Acceso**: inicio de sesión con Google y captcha de Cloudflare Turnstile al registrarse.
- **Rebranding + landing pública** con preguntas frecuentes (se hacen juntos).
- **Historial de manos** (nivel de detalle por decidir).
- **Plan de pago** (más adelante).

## Para tener en cuenta (sin fecha)
- **Préstamos**: quién te debe y a quién debes, con fechas, interés y pagos parciales. De momento no se hace.

## Aparcado
- Staking.
- Funciones del plan Elite de la app de referencia.
