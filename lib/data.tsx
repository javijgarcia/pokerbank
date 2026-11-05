'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import {
  loadCache,
  loadPref,
  loadQueue,
  saveCache,
  savePref,
  saveQueue,
  type QueuedSession,
} from './local';
import {
  DEFAULT_BUYINS,
  DEFAULT_LADDER,
  type Bank,
  type Goal,
  type GoalKind,
  type LevelRule,
  type Movement,
  type Preset,
  type ScheduledTournament,
  type Session,
} from './types';
import { uuid } from './format';
import { removeReceipt } from './receipts';
import { clearLocalData } from './local';

interface Snapshot {
  banks: Bank[];
  movements: Movement[];
  sessions: Session[];
  rules: LevelRule[];
  goals: Goal[];
  presets: Preset[];
  scheduled: ScheduledTournament[];
}

const EMPTY: Snapshot = { banks: [], movements: [], sessions: [], rules: [], goals: [], presets: [], scheduled: [] };

/** 'all' = todas las bolsas (Total). Si no, id de una bolsa. */
export type BankFilter = 'all' | string;

interface DataCtx extends Snapshot {
  configured: boolean;
  authReady: boolean;
  user: User | null;
  loading: boolean;
  offline: boolean;
  pendingIds: Set<string>;
  filter: BankFilter;
  setFilter: (f: BankFilter) => void;
  /** Bolsas visibles según el filtro (excluye archivadas salvo que se filtren explícitamente). */
  scopeBanks: Bank[];
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** true cuando se llega desde el enlace del correo de recuperación: hay que elegir contraseña nueva. */
  recovery: boolean;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
  refresh: () => Promise<void>;
  addBank: (name: string, initial: number) => Promise<string | null>;
  archiveBank: (id: string, archived: boolean) => Promise<string | null>;
  addMovement: (bankId: string, amount: number, note: string) => Promise<string | null>;
  deleteMovement: (id: string) => Promise<string | null>;
  saveSession: (s: Session) => Promise<void>;
  deleteSession: (id: string) => Promise<string | null>;
  saveRule: (r: Omit<LevelRule, 'id'> & { id?: string }) => Promise<string | null>;
  saveGoal: (kind: GoalKind, target: number, bankId: string | null) => Promise<string | null>;
  deleteGoal: (id: string) => Promise<string | null>;
  savePreset: (p: Omit<Preset, 'id'>) => Promise<string | null>;
  deletePreset: (id: string) => Promise<string | null>;
  addScheduled: (t: Omit<ScheduledTournament, 'id'>) => Promise<string | null>;
  deleteScheduled: (id: string) => Promise<string | null>;
}

const Ctx = createContext<DataCtx | null>(null);

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData fuera de DataProvider');
  return c;
}

const errMsg = (e: { message: string } | null | undefined): string | null => (e ? e.message : null);

const BOUNTY_KEYS = ['has_bounty', 'bounty_total', 'bounty_count'];

// Columnas añadidas por migraciones, de la más reciente a la más antigua: si falta alguna migración
// en la base de datos, se reintenta sin esas columnas para no perder la sesión.
const SESSION_FALLBACKS: string[][] = [
  ['receipt_path'],
  ['receipt_path', ...BOUNTY_KEYS],
  ['receipt_path', ...BOUNTY_KEYS, 'tournament_name'],
];

function stripKeys(row: object, keys: string[]): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row };
  for (const k of keys) delete copy[k];
  return copy;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [queue, setQueue] = useState<QueuedSession[]>([]);
  const [filter, setFilterState] = useState<BankFilter>('all');
  const flushing = useRef(false);

  // ── Auth ──
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setFilterState(loadPref<BankFilter>('filter', 'all'));
    setQueue(loadQueue());
  }, []);

  const setFilter = useCallback((f: BankFilter) => {
    setFilterState(f);
    savePref('filter', f);
  }, []);

  // ── Carga ──
  const refresh = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const [b, m, s, r, g, p, sc] = await Promise.all([
        supabase.from('banks').select('*').order('created_at'),
        supabase.from('bank_movements').select('*').order('occurred_at'),
        supabase.from('sessions').select('*').order('ended_at'),
        supabase.from('level_rules').select('*'),
        supabase.from('goals').select('*').order('created_at'),
        supabase.from('presets').select('*').order('created_at'),
        supabase.from('scheduled_tournaments').select('*').order('starts_at'),
      ]);
      const failed = [b, m, s, r, g].find((x) => x.error);
      if (failed?.error) throw new Error(failed.error.message);
      const next: Snapshot = {
        banks: (b.data ?? []) as Bank[],
        movements: (m.data ?? []) as Movement[],
        sessions: (s.data ?? []) as Session[],
        rules: (r.data ?? []) as LevelRule[],
        goals: (g.data ?? []) as Goal[],
        // Si la migración 002 aún no se ha ejecutado, la app sigue funcionando sin presets.
        presets: p.error ? [] : ((p.data ?? []) as Preset[]),
        // Si la migración 005 aún no se ha ejecutado, el calendario aparece vacío.
        scheduled: sc.error ? [] : ((sc.data ?? []) as ScheduledTournament[]),
      };
      setSnap(next);
      saveCache(user.id, next);
      setOffline(false);
    } catch {
      const cached = loadCache<Snapshot>(user.id);
      if (cached) setSnap({ ...EMPTY, ...cached });
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const cached = loadCache<Snapshot>(user.id);
      if (cached) setSnap({ ...EMPTY, ...cached });
      void refresh();
    } else {
      setSnap(EMPTY);
    }
  }, [user, refresh]);

  // ── Cola offline ──
  const flush = useCallback(async () => {
    if (!supabase || !user || flushing.current) return;
    const q = loadQueue().filter((x) => x._uid === user.id);
    if (!q.length) return;
    flushing.current = true;
    try {
      const rows = q.map(({ _uid, ...row }) => ({ ...row, user_id: _uid }));
      let { error } = await supabase.from('sessions').upsert(rows, { onConflict: 'id' });
      for (const keys of SESSION_FALLBACKS) {
        if (!error || !/column|schema cache/i.test(error.message)) break;
        ({ error } = await supabase.from('sessions').upsert(rows.map((r) => stripKeys(r, keys)), { onConflict: 'id' }));
      }
      if (error) throw new Error(error.message);
      const synced = new Set(q.map((x) => x.id));
      const rest = loadQueue().filter((x) => !synced.has(x.id));
      saveQueue(rest);
      setQueue(rest);
      await refresh();
    } catch {
      setOffline(true);
    } finally {
      flushing.current = false;
    }
  }, [user, refresh]);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      void flush();
      void refresh();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flush, refresh]);

  useEffect(() => {
    if (user) void flush();
  }, [user, flush]);

  // Sesiones visibles = servidor + pendientes locales (sin duplicar)
  const sessions = useMemo(() => {
    if (!user) return snap.sessions;
    const mine = queue.filter((q) => q._uid === user.id);
    const ids = new Set(snap.sessions.map((s) => s.id));
    const extra = mine.filter((q) => !ids.has(q.id)).map(({ _uid, ...row }) => row as Session);
    return [...snap.sessions, ...extra].sort(
      (a, b) => new Date(a.ended_at).getTime() - new Date(b.ended_at).getTime()
    );
  }, [snap.sessions, queue, user]);

  const pendingIds = useMemo(() => new Set(queue.map((q) => q.id)), [queue]);

  const scopeBanks = useMemo(() => {
    if (filter === 'all') return snap.banks.filter((b) => !b.archived);
    return snap.banks.filter((b) => b.id === filter);
  }, [snap.banks, filter]);

  // ── Acciones ──
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase no está configurado';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return errMsg(error);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase no está configurado';
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.session) return 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.';
    return null;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSnap(EMPTY);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return 'Supabase no está configurado';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return errMsg(error);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return 'Supabase no está configurado';
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovery(false);
    return errMsg(error);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!supabase || !user) return 'Sin sesión';
    // 1) Fotos de recibos (el borrado de la cuenta no toca Storage).
    try {
      const { data: files } = await supabase.storage.from('receipts').list(user.id, { limit: 1000 });
      if (files?.length) await supabase.storage.from('receipts').remove(files.map((f) => `${user.id}/${f.name}`));
    } catch {
      /* si falla, se borra igual la cuenta */
    }
    // 2) Cuenta y datos (migración 006).
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return /delete_my_account/.test(error.message) ? 'Falta ejecutar la migración 006_delete_account.sql en Supabase.' : error.message;
    clearLocalData();
    await supabase.auth.signOut();
    setSnap(EMPTY);
    return null;
  }, [user]);

  const addBank = useCallback(
    async (name: string, initial: number) => {
      if (!supabase || !user) return 'Sin sesión';
      const { data, error } = await supabase
        .from('banks')
        .insert({ name, initial_amount: initial })
        .select()
        .single();
      if (error) return error.message;
      const rules = (['cash', 'tournament'] as const).map((game_type) => ({
        bank_id: (data as Bank).id,
        game_type,
        buyins: DEFAULT_BUYINS[game_type].buyins,
        down_buyins: DEFAULT_BUYINS[game_type].down_buyins,
        ladder: DEFAULT_LADDER[game_type],
      }));
      const { error: e2 } = await supabase.from('level_rules').insert(rules);
      await refresh();
      return errMsg(e2);
    },
    [user, refresh]
  );

  const archiveBank = useCallback(
    async (id: string, archived: boolean) => {
      if (!supabase) return 'Sin conexión';
      const { error } = await supabase.from('banks').update({ archived }).eq('id', id);
      await refresh();
      return errMsg(error);
    },
    [refresh]
  );

  const addMovement = useCallback(
    async (bankId: string, amount: number, note: string) => {
      if (!supabase) return 'Sin conexión';
      const { error } = await supabase
        .from('bank_movements')
        .insert({ bank_id: bankId, amount, note: note || null });
      await refresh();
      return errMsg(error);
    },
    [refresh]
  );

  const deleteMovement = useCallback(
    async (id: string) => {
      if (!supabase) return 'Sin conexión';
      const { error } = await supabase.from('bank_movements').delete().eq('id', id);
      await refresh();
      return errMsg(error);
    },
    [refresh]
  );

  const saveSession = useCallback(
    async (s: Session) => {
      if (!user) return;
      const q = [...loadQueue().filter((x) => x.id !== s.id), { ...s, _uid: user.id }];
      saveQueue(q);
      setQueue(q);
      await flush();
    },
    [user, flush]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      const q = loadQueue().filter((x) => x.id !== id);
      saveQueue(q);
      setQueue(q);
      if (!supabase) return 'Sin conexión';
      const receipt = snap.sessions.find((s) => s.id === id)?.receipt_path;
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (!error && receipt) void removeReceipt(receipt).catch(() => {});
      await refresh();
      return errMsg(error);
    },
    [refresh, snap.sessions]
  );

  const saveRule = useCallback(
    async (r: Omit<LevelRule, 'id'> & { id?: string }) => {
      if (!supabase) return 'Sin conexión';
      const { error } = await supabase
        .from('level_rules')
        .upsert(
          {
            ...(r.id ? { id: r.id } : {}),
            bank_id: r.bank_id,
            game_type: r.game_type,
            buyins: r.buyins,
            down_buyins: r.down_buyins,
            ladder: r.ladder,
          },
          { onConflict: 'bank_id,game_type' }
        );
      await refresh();
      return errMsg(error);
    },
    [refresh]
  );

  const saveGoal = useCallback(
    async (kind: GoalKind, target: number, bankId: string | null) => {
      if (!supabase) return 'Sin conexión';
      const { error } = await supabase.from('goals').insert({ kind, target, bank_id: bankId });
      await refresh();
      return errMsg(error);
    },
    [refresh]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      if (!supabase) return 'Sin conexión';
      const { error } = await supabase.from('goals').delete().eq('id', id);
      await refresh();
      return errMsg(error);
    },
    [refresh]
  );

  const savePreset = useCallback(
    async (p: Omit<Preset, 'id'>) => {
      if (!supabase) return 'Sin conexión';
      let { error } = await supabase.from('presets').insert(p);
      if (error && /has_bounty/.test(error.message)) {
        ({ error } = await supabase.from('presets').insert(stripKeys(p, ['has_bounty'])));
      }
      if (error && /tournament_name/.test(error.message)) {
        ({ error } = await supabase.from('presets').insert(stripKeys(p, ['has_bounty', 'tournament_name'])));
      }
      await refresh();
      return errMsg(error);
    },
    [refresh]
  );

  const deletePreset = useCallback(
    async (id: string) => {
      if (!supabase) return 'Sin conexión';
      const { error } = await supabase.from('presets').delete().eq('id', id);
      await refresh();
      return errMsg(error);
    },
    [refresh]
  );

  const addScheduled = useCallback(
    async (t: Omit<ScheduledTournament, 'id'>) => {
      if (!supabase) return 'Sin conexión';
      const { error } = await supabase.from('scheduled_tournaments').insert(t);
      await refresh();
      return error ? (/scheduled_tournaments/.test(error.message) ? 'Falta ejecutar la migración 005_calendar_receipts.sql en Supabase.' : error.message) : null;
    },
    [refresh]
  );

  const deleteScheduled = useCallback(
    async (id: string) => {
      if (!supabase) return 'Sin conexión';
      const { error } = await supabase.from('scheduled_tournaments').delete().eq('id', id);
      await refresh();
      return errMsg(error);
    },
    [refresh]
  );

  const value: DataCtx = {
    ...snap,
    sessions,
    configured: supabaseConfigured,
    authReady,
    user,
    loading,
    offline,
    pendingIds,
    filter,
    setFilter,
    scopeBanks,
    signIn,
    signUp,
    signOut,
    recovery,
    resetPassword,
    updatePassword,
    deleteAccount,
    refresh,
    addBank,
    archiveBank,
    addMovement,
    deleteMovement,
    saveSession,
    deleteSession,
    saveRule,
    saveGoal,
    deleteGoal,
    savePreset,
    deletePreset,
    addScheduled,
    deleteScheduled,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { uuid };
