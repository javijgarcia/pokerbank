import { uuid } from './format';
import type { ActiveSession, Preset, ScheduledTournament } from './types';

/** Suma de los bounties apuntados en una sesión abierta. */
export function bountySum(a: ActiveSession): number {
  return Math.round((a.bounties ?? []).reduce((acc, n) => acc + n, 0) * 100) / 100;
}

export function activeTitle(a: ActiveSession): string {
  if (a.game_type === 'tournament' && a.tournament_name) return a.tournament_name;
  return `${a.game_type === 'cash' ? 'Cash' : 'Torneo'} ${a.venue === 'live' ? 'live' : 'online'}`;
}

/** Sesión en curso lista para arrancar a partir de un preset. null si el preset no tiene buy-in. */
export function activeFromPreset(p: Preset, now = Date.now()): ActiveSession | null {
  const buyIn = p.buy_in ?? p.stake;
  if (buyIn == null || buyIn <= 0) return null;
  return {
    id: uuid(),
    bank_id: p.bank_id,
    game_type: p.game_type,
    venue: p.venue,
    place: p.place ?? '',
    tournament_name: p.tournament_name ?? '',
    has_bounty: p.game_type === 'tournament' && !!p.has_bounty,
    bounties: [],
    stake: p.stake,
    buy_in: buyIn,
    entries: 1,
    started_at: now,
    paused_total_ms: 0,
    paused_at: null,
  };
}

/** Sesión en curso a partir de un torneo del calendario. */
export function activeFromScheduled(t: ScheduledTournament, now = Date.now()): ActiveSession {
  return {
    id: uuid(),
    bank_id: t.bank_id,
    game_type: 'tournament',
    venue: t.venue,
    place: t.place ?? '',
    tournament_name: t.name,
    has_bounty: t.has_bounty,
    bounties: [],
    stake: t.buy_in,
    buy_in: t.buy_in,
    entries: 1,
    started_at: now,
    paused_total_ms: 0,
    paused_at: null,
  };
}
