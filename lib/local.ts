import type { ActiveSession, Session } from './types';

// Todo acceso a localStorage va protegido: puede fallar (modo privado, datos bloqueados).

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: la app sigue funcionando sin persistencia local */
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

// ───────────── Sesión activa (temporizador) ─────────────
// No se cuenta con setInterval persistente: se guarda la hora de inicio y se calcula al leer.

// Puede haber varias sesiones abiertas a la vez (p. ej. dos torneos online). Se guardan como lista.
const ACTIVES_KEY = 'pb.actives';
const LEGACY_ACTIVE_KEY = 'pb.active'; // versiones anteriores: una sola sesión

export function loadActives(): ActiveSession[] {
  const list = read<ActiveSession[] | null>(ACTIVES_KEY, null);
  if (Array.isArray(list)) return list;
  // Migración: si había una sesión abierta con la versión anterior, la conservamos.
  const legacy = read<ActiveSession | null>(LEGACY_ACTIVE_KEY, null);
  if (legacy) {
    write(ACTIVES_KEY, [legacy]);
    remove(LEGACY_ACTIVE_KEY);
    return [legacy];
  }
  return [];
}

export const saveActives = (list: ActiveSession[]): void => write(ACTIVES_KEY, list);

/** Crea o actualiza una sesión abierta y devuelve la lista resultante. */
export function upsertActive(a: ActiveSession): ActiveSession[] {
  const list = loadActives();
  const next = list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a];
  saveActives(next);
  return next;
}

/** Quita una sesión abierta (al cerrarla o descartarla) y devuelve la lista resultante. */
export function removeActive(id: string): ActiveSession[] {
  const next = loadActives().filter((x) => x.id !== id);
  saveActives(next);
  return next;
}

/** Segundos jugados (sin pausas) en este instante. */
export function elapsedSeconds(a: ActiveSession, now = Date.now()): number {
  const end = a.paused_at ?? now;
  return Math.max(0, Math.floor((end - a.started_at - a.paused_total_ms) / 1000));
}

export function pauseActive(a: ActiveSession, now = Date.now()): ActiveSession {
  return a.paused_at ? a : { ...a, paused_at: now };
}

export function resumeActive(a: ActiveSession, now = Date.now()): ActiveSession {
  if (!a.paused_at) return a;
  return { ...a, paused_at: null, paused_total_ms: a.paused_total_ms + (now - a.paused_at) };
}

// ───────────── Cola de sesiones pendientes de sincronizar ─────────────

export interface QueuedSession extends Session {
  _uid: string; // usuario al que pertenece
}

const QUEUE_KEY = 'pb.queue';

export const loadQueue = (): QueuedSession[] => read<QueuedSession[]>(QUEUE_KEY, []);
export const saveQueue = (q: QueuedSession[]): void => write(QUEUE_KEY, q);

// ───────────── Caché de la última carga (arrancar sin conexión) ─────────────

export function loadCache<T>(uid: string): T | null {
  return read<T | null>(`pb.cache.${uid}`, null);
}
export function saveCache(uid: string, data: unknown): void {
  write(`pb.cache.${uid}`, data);
}

// ───────────── Preferencias por dispositivo ─────────────

export const loadPref = <T,>(key: string, fallback: T): T => read<T>(`pb.pref.${key}`, fallback);
export const savePref = (key: string, value: unknown): void => write(`pb.pref.${key}`, value);

/** Borra todo lo que PokerBank guarda en este dispositivo (sesiones abiertas, cola, caché y preferencias). */
export function clearLocalData(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('pb.'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* almacenamiento no disponible */
  }
}
