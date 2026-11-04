# Historial de versiones de PokerBank

## Hechas
- **v0.1**: sesiones cash/torneo (live/online) con temporizador, varias bolsas + Total, gráfico de bankroll por mes, niveles según bankroll (cash 100 buy-ins, torneos ABI = 1 %), objetivos, estado mental y calidad de juego 1-5, registro offline, PWA, multiusuario con RLS.
- **v0.2**: presets de sesión, rachas de sesiones ganadas/perdidas, PDF por sesión, tema oscuro/claro/auto. (Migración `002_presets.sql`)
- **v0.2.1**: torneos sin campo ABI (el buy-in inicial es el ABI), nombre del torneo, estadísticas de torneos con ABI medio. (Migración `003_tournament_name.sql`)
- **v0.3**: Inicio con tarjetas de saldo y «Jugando ahora»; pestaña Estadísticas con Todo/Cash/Torneos y filtro Semana/Mes/Año/General.
- **v0.4**: varias sesiones abiertas a la vez, y racha de días jugando (llama). Sin migración de base de datos.

## Propuesta (el orden lo decides tú)
- **v0.5**: recibos (foto adjunta a la sesión) y calendario de torneos (alta manual + exportar a tu calendario).
- **v0.6**: varias divisas con conversión.
- **v0.7**: historial de manos (nivel de detalle por decidir).

## Aparcado
- Social y staking (no aportan con un solo usuario).
- Funciones del plan Elite de la app de referencia.
