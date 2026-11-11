import type { Session } from './types';

/** Resultado de un día natural (por la hora local de fin de la sesión). */
export interface DayCell {
  day: number;
  profit: number | null; // null = no se jugó
  count: number;
  seconds: number;
}

export interface MonthSummary {
  playedDays: number;
  winDays: number;
  lossDays: number;
  evenDays: number;
  /** Días del mes ya transcurridos (hasta hoy, o todo el mes si es pasado) sin jugar. */
  restDays: number;
  profit: number;
  sessions: number;
  seconds: number;
  avgPerPlayedDay: number | null;
  winDayRate: number | null; // % de días jugados que fueron ganadores
  bestDay: { day: number; profit: number } | null;
  worstDay: { day: number; profit: number } | null;
  bestWinDayStreak: number;
}

export interface MonthGrid {
  /** Huecos antes del día 1 (la semana empieza en lunes). */
  lead: number;
  cells: DayCell[];
  summary: MonthSummary;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** `month` es 0-11. `now` solo sirve para saber cuántos días del mes ya han pasado. */
export function monthGrid(list: Session[], year: number, month: number, now = new Date()): MonthGrid {
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: DayCell[] = Array.from({ length: dim }, (_, i) => ({ day: i + 1, profit: null, count: 0, seconds: 0 }));
  for (const s of list) {
    const e = new Date(s.ended_at);
    if (e.getFullYear() !== year || e.getMonth() !== month) continue;
    const c = cells[e.getDate() - 1];
    c.profit = r2((c.profit ?? 0) + (s.cash_out - s.buy_in));
    c.count++;
    c.seconds += s.duration_seconds ?? 0;
  }

  const played = cells.filter((c) => c.profit !== null);
  const wins = played.filter((c) => (c.profit as number) > 0);
  const losses = played.filter((c) => (c.profit as number) < 0);
  const profit = r2(played.reduce((a, c) => a + (c.profit as number), 0));
  let best: DayCell | null = null;
  let worst: DayCell | null = null;
  for (const c of played) {
    if (!best || (c.profit as number) > (best.profit as number)) best = c;
    if (!worst || (c.profit as number) < (worst.profit as number)) worst = c;
  }
  let streak = 0;
  let cur = 0;
  for (const c of cells) {
    if (c.profit !== null && c.profit > 0) streak = Math.max(streak, ++cur);
    else cur = 0;
  }

  const monthStart = new Date(year, month, 1).getTime();
  const passed =
    now.getTime() < monthStart ? 0 : now.getFullYear() === year && now.getMonth() === month ? now.getDate() : dim;
  const playedPassed = played.filter((c) => c.day <= passed).length;

  return {
    lead: (new Date(year, month, 1).getDay() + 6) % 7,
    cells,
    summary: {
      playedDays: played.length,
      winDays: wins.length,
      lossDays: losses.length,
      evenDays: played.length - wins.length - losses.length,
      restDays: Math.max(0, passed - playedPassed),
      profit,
      sessions: played.reduce((a, c) => a + c.count, 0),
      seconds: played.reduce((a, c) => a + c.seconds, 0),
      avgPerPlayedDay: played.length ? r2(profit / played.length) : null,
      winDayRate: played.length ? (wins.length / played.length) * 100 : null,
      bestDay: best && (best.profit as number) > 0 ? { day: best.day, profit: best.profit as number } : null,
      worstDay: worst && (worst.profit as number) < 0 ? { day: worst.day, profit: worst.profit as number } : null,
      bestWinDayStreak: streak,
    },
  };
}
