'use client';

import { useCallback, useEffect, useState } from 'react';
import { round2 } from './calc';
import { supabase } from './supabase';
import type { Session } from './types';

export interface Profile {
  user_id: string;
  username: string;
  display_name: string;
  show_stats: boolean;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
}

/** Instantánea publicada en el feed. A propósito NO lleva importes en euros. */
export interface SharedSession {
  id: string;
  user_id: string;
  session_id: string;
  game_type: 'cash' | 'tournament';
  venue: 'live' | 'online';
  tournament_name: string | null;
  duration_seconds: number;
  roi_pct: number | null;
  itm: boolean | null;
  position: number | null;
  players: number | null;
  mood: number | null;
  caption: string | null;
  ended_at: string;
  created_at: string;
}

export interface FriendStats {
  sessions: number;
  hours: number;
  roi_pct: number | null;
  itm_pct: number | null;
}

export type SharedDraft = Omit<SharedSession, 'id' | 'user_id' | 'created_at'>;

export const MIGRATION_MSG = 'Falta ejecutar la migración 007_social.sql en Supabase.';

const missing = (m: string) => /relation|does not exist|schema cache|function .* not found|Could not find/i.test(m);
const friendly = (m: string) => (missing(m) ? MIGRATION_MSG : /duplicate key|23505/.test(m) ? 'Ya existe.' : m);

/** ROI de una sesión en %, o null si no hay buy-in. */
export function sessionRoiPct(s: Pick<Session, 'buy_in' | 'cash_out'>): number | null {
  return s.buy_in > 0 ? round2(((s.cash_out - s.buy_in) / s.buy_in) * 100) : null;
}

/** Construye lo que se publica de una sesión: solo %, tiempo y resultado deportivo, nunca euros. */
export function toShared(s: Session, caption: string): SharedDraft {
  const isT = s.game_type === 'tournament';
  return {
    session_id: s.id,
    game_type: s.game_type,
    venue: s.venue,
    tournament_name: isT ? s.tournament_name?.trim() || null : null,
    duration_seconds: s.duration_seconds,
    roi_pct: sessionRoiPct(s),
    itm: isT ? s.cash_out - (s.bounty_total ?? 0) > 0.004 : null,
    position: isT ? s.position ?? null : null,
    players: isT ? s.players ?? null : null,
    mood: s.mood ?? null,
    caption: caption.trim() ? caption.trim().slice(0, 280) : null,
    ended_at: s.ended_at,
  };
}

export async function publishSession(s: Session, caption = ''): Promise<string | null> {
  if (!supabase) return 'Sin conexión';
  const { error } = await supabase.from('shared_sessions').upsert(toShared(s, caption), { onConflict: 'user_id,session_id' });
  return error ? friendly(error.message) : null;
}

export async function unpublishPost(id: string): Promise<string | null> {
  if (!supabase) return 'Sin conexión';
  const { error } = await supabase.from('shared_sessions').delete().eq('id', id);
  return error ? friendly(error.message) : null;
}

export async function createProfile(p: Omit<Profile, 'user_id'>): Promise<string | null> {
  if (!supabase) return 'Sin conexión';
  const { error } = await supabase.from('profiles').insert(p);
  if (!error) return null;
  if (/duplicate key|23505|profiles_username_key/.test(error.message)) return 'Ese nombre de usuario ya está cogido.';
  if (/username_format/.test(error.message)) return 'El usuario debe tener 3-20 caracteres: letras minúsculas, números o _.';
  return friendly(error.message);
}

export async function updateProfile(userId: string, patch: Partial<Pick<Profile, 'display_name' | 'show_stats'>>): Promise<string | null> {
  if (!supabase) return 'Sin conexión';
  const { error } = await supabase.from('profiles').update(patch).eq('user_id', userId);
  return error ? friendly(error.message) : null;
}

export async function lookupProfile(username: string): Promise<{ profile: Pick<Profile, 'user_id' | 'username' | 'display_name'> | null; error: string | null }> {
  if (!supabase) return { profile: null, error: 'Sin conexión' };
  const { data, error } = await supabase.rpc('lookup_profile', { p_username: username });
  if (error) return { profile: null, error: friendly(error.message) };
  const row = (data as Pick<Profile, 'user_id' | 'username' | 'display_name'>[] | null)?.[0] ?? null;
  return { profile: row, error: null };
}

export async function requestFriend(addresseeId: string): Promise<string | null> {
  if (!supabase) return 'Sin conexión';
  const { error } = await supabase.from('friendships').insert({ addressee_id: addresseeId });
  if (!error) return null;
  return /duplicate key|23505|friendships_pair_key/.test(error.message) ? 'Ya hay una solicitud o amistad con esta persona.' : friendly(error.message);
}

export async function acceptFriend(id: string): Promise<string | null> {
  if (!supabase) return 'Sin conexión';
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
  return error ? friendly(error.message) : null;
}

export async function removeFriendship(id: string): Promise<string | null> {
  if (!supabase) return 'Sin conexión';
  const { error } = await supabase.from('friendships').delete().eq('id', id);
  return error ? friendly(error.message) : null;
}

export async function friendStats(userId: string): Promise<FriendStats | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('friend_stats', { p_user: userId });
  const r = (data as { sessions: number; hours: number | string; roi_pct: number | string | null; itm_pct: number | string | null }[] | null)?.[0];
  if (error || !r || Number(r.sessions) === 0) return null;
  return { sessions: Number(r.sessions), hours: Number(r.hours), roi_pct: r.roi_pct == null ? null : Number(r.roi_pct), itm_pct: r.itm_pct == null ? null : Number(r.itm_pct) };
}

export interface SocialState {
  loading: boolean;
  error: string | null;
  unavailable: boolean;
  me: Profile | null;
  profiles: Record<string, Profile>;
  friendships: Friendship[];
  feed: SharedSession[];
}

const INITIAL: SocialState = { loading: true, error: null, unavailable: false, me: null, profiles: {}, friendships: [], feed: [] };

/** Carga perfil, amistades y feed del usuario. `refresh` vuelve a pedirlo todo. */
export function useSocial(userId: string | undefined): SocialState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<SocialState>(INITIAL);

  const refresh = useCallback(async () => {
    if (!supabase || !userId) return;
    const [p, f, s] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('friendships').select('*'),
      supabase.from('shared_sessions').select('*').order('ended_at', { ascending: false }).limit(60),
    ]);
    const err = p.error ?? f.error ?? s.error;
    if (err) {
      setState((st) => ({ ...st, loading: false, unavailable: missing(err.message), error: missing(err.message) ? MIGRATION_MSG : err.message }));
      return;
    }
    const profiles: Record<string, Profile> = {};
    for (const row of (p.data ?? []) as Profile[]) profiles[row.user_id] = row;
    setState({
      loading: false,
      error: null,
      unavailable: false,
      me: profiles[userId] ?? null,
      profiles,
      friendships: (f.data ?? []) as Friendship[],
      feed: (s.data ?? []) as SharedSession[],
    });
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}

/** Perfil propio (null si aún no lo has creado; undefined mientras carga o si social no está disponible). */
export function useMyProfile(userId: string | undefined): Profile | null | undefined {
  const [me, setMe] = useState<Profile | null | undefined>(undefined);
  useEffect(() => {
    if (!supabase || !userId) return;
    let alive = true;
    void supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (alive) setMe(error ? undefined : ((data as Profile | null) ?? null));
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  return me;
}
