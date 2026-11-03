# PokerBank v0.2

PWA de registro de sesiones y bankroll de póker. Next.js 15 + Supabase + Vercel. Multiusuario (RLS).

## Puesta en marcha
1. Crea un proyecto en Supabase y ejecuta `supabase/schema.sql` en el SQL Editor.
   (Si ya tenías la v0.1 instalada, ejecuta solo `supabase/migrations/002_presets.sql`. Sin ella la app funciona, pero sin presets.)
2. `cp .env.local.example .env.local` y rellena URL y anon key.
3. `npm install && npm run dev`
4. En Supabase > Authentication > URL Configuration añade la URL de tu app (local y Vercel).
5. Despliegue: importa el repo en Vercel y define las dos variables de entorno.

## Qué incluye
- Sesiones cash/torneo, live/online, con temporizador (hora de inicio + pausas, sobrevive a bloquear el móvil).
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
