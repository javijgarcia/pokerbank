import { uuid } from './format';
import type { ActiveSession, Preset } from './types';

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
    stake: p.stake,
    buy_in: buyIn,
    entries: 1,
    started_at: now,
    paused_total_ms: 0,
    paused_at: null,
  };
}
