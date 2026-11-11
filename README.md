# PokerBank v0.9.1

PWA de registro de sesiones y bankroll de póker. Next.js 15 + Supabase + Vercel. Multiusuario (RLS).

## Puesta en marcha
1. Crea un proyecto en Supabase y ejecuta `supabase/schema.sql` en el SQL Editor.
   Si ya tenías una versión anterior instalada, ejecuta en este orden SOLO las migraciones que te falten:
   `002_presets.sql` (presets), `003_tournament_name.sql` (nombre del torneo), `004_bounties.sql` (bounty/KO),
   `005_calendar_receipts.sql` (calendario y recibos) y `006_delete_account.sql` (borrar cuenta) y `007_social.sql` (perfiles, amigos y feed), todas en `supabase/migrations/`.
   Ejecútalas ANTES de desplegar la nueva versión.
2. `cp .env.local.example .env.local` y rellena URL y anon key. Añade también `NEXT_PUBLIC_FEEDBACK_EMAIL` (el correo que recibirá el feedback); en Vercel, defínela igual en las variables de entorno y vuelve a desplegar.
3. `npm install && npm run dev`
4. En Supabase > Authentication > URL Configuration añade la URL de tu app (local y Vercel).
5. Despliegue: importa el repo en Vercel y define las dos variables de entorno.

## Actualizar desde una versión anterior
Descomprime el zip encima de tu carpeta y **sobrescribe** los archivos existentes. Tu `.env.local` y `node_modules` no vienen en el zip, así que no se tocan. Después ejecuta `npm install` (por si hay dependencias nuevas) y mira `CHANGELOG.md` por si hay que ejecutar alguna migración SQL.

## Checklist antes de dar acceso a probadores
1. Ejecuta las migraciones 004, 005, 006 y 007 (y las anteriores que falten).
2. **Prueba con dos cuentas reales** (con la parte social, comprueba además que un usuario sin amistad con el otro no ve su perfil, su feed ni sus estadísticas, y que dos amigos solo ven lo publicado, sin euros) (dos correos distintos): crea datos en una y comprueba que la otra no ve nada, ni sesiones ni fotos de recibos.
3. **Correos de registro:** el servidor de correo por defecto de Supabase envía muy pocos correos por hora. Configura tu propio SMTP en Supabase > Authentication > SMTP Settings (Resend, Brevo…), o desactiva «Confirm email» durante la beta. Esto afecta también al correo de recuperar contraseña.
4. En Supabase > Authentication > URL Configuration, la URL de Vercel debe estar en «Site URL» y «Redirect URLs»; si no, el enlace de recuperar contraseña no vuelve a la app.
5. Define `NEXT_PUBLIC_FEEDBACK_EMAIL` para que aparezca el botón «Enviar feedback» en Ajustes.
6. Vigila el almacenamiento del plan gratuito de Supabase: las fotos de recibos son lo que más ocupa.

## Qué incluye
- Social: perfil, amigos, feed de sesiones y tarjeta de resultado para compartir; solo ROI %, tiempo y resultado, nunca euros.
- Recuperar contraseña, recorrido de bienvenida, feedback con versión, exportar tus datos (JSON) y borrar tu cuenta (Ajustes).
- Torneos con bounty (KO), calendario de torneos con exportación .ics y recibos con foto.
- Varias sesiones abiertas a la vez en «Jugando ahora» (botón +) y racha de días jugando (llama).
- Inicio: tarjetas de saldo por bolsa (con botón para ocultar el saldo), «Jugando ahora» con pausa, entradas/recompras y cierre rápidos, presets de un toque e historial reciente.
- Estadísticas: pestañas Todo / Cash / Torneos, gráfico de beneficio o de bankroll y filtro Semana / Mes / Año / General con navegación al periodo anterior.
- Sesiones cash/torneo, live/online (en torneos: nombre del torneo y buy-in inicial; el ABI se calcula en las estadísticas), con temporizador (hora de inicio + pausas, sobrevive a bloquear el móvil).
- Recompras / re-entries durante la sesión; cierre con cash-out, estado mental 1-5, calidad de juego 1-5, notas y etiquetas.
- Registro manual de sesiones ya jugadas.
- Varias bolsas + Total; ingresos y retiradas; gráfico filtrable por bolsa y por mes.
- Niveles: cash 100 buy-ins por nivel, torneos ABI = 1 % del bank, con umbral de bajada (70) para evitar oscilar. Todo editable por bolsa.
- Objetivos (beneficio mensual, horas, bank objetivo).
- Offline: las sesiones se guardan en el dispositivo y se sincronizan al volver la red. Crear bolsas, movimientos y reglas requiere conexión.
- Exportar historial a CSV y PDF por sesión.
- Presets: guarda una configuración (p. ej. «NL5 online») y empieza la sesión con un toque.
- Rachas de sesiones ganadoras/perdedoras en Inicio.
- Tema oscuro, claro o automático (Ajustes).

## Pendiente / limitaciones conocidas
- Una sola divisa (€).
- El service worker solo se registra en producción (`next build && next start` o Vercel).
- Para el icono/instalación en iOS: Compartir > Añadir a pantalla de inicio.
