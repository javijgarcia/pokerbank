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

const ACTIVE_KEY = 'pb.active';

export const loadActive = (): ActiveSession | null => read<ActiveSession | null>(ACTIVE_KEY, null);
export const saveActive = (a: ActiveSession): void => write(ACTIVE_KEY, a);
export const clearActive = (): void => remove(ACTIVE_KEY);

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
