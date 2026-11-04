import type { Bank, Goal, LevelRule, Movement, Session } from './types';

export const sessionResult = (s: Session): number => s.cash_out - s.buy_in;

// ───────────────────────────── Bankroll ─────────────────────────────

export function bankBalance(bank: Bank, movements: Movement[], sessions: Session[]): number {
  let v = Number(bank.initial_amount);
  for (const m of movements) if (m.bank_id === bank.id) v += Number(m.amount);
  for (const s of sessions) if (s.bank_id === bank.id) v += sessionResult(s);
  return round2(v);
}

export function totalBalance(banks: Bank[], movements: Movement[], sessions: Session[]): number {
  return round2(banks.reduce((acc, b) => acc + bankBalance(b, movements, sessions), 0));
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

// ───────────────────────────── Gráfico ─────────────────────────────

export interface Point {
  t: number;
  v: number;
  label: string;
  delta: number;
}

export interface Series {
  points: Point[];
  start: number;
  end: number;
}

/** Serie del bankroll de las bolsas indicadas. `range` recorta a un periodo (p. ej. un mes). */
export function balanceSeries(
  banks: Bank[],
  movements: Movement[],
  sessions: Session[],
  range?: { from: number; to: number } | null
): Series {
  const ids = new Set(banks.map((b) => b.id));
  const base = banks.reduce((a, b) => a + Number(b.initial_amount), 0);

  const events: { t: number; d: number; label: string }[] = [];
  for (const m of movements) {
    if (!ids.has(m.bank_id)) continue;
    events.push({
      t: new Date(m.occurred_at).getTime(),
      d: Number(m.amount),
      label: m.note || (m.amount >= 0 ? 'Ingreso' : 'Retirada'),
    });
  }
  for (const s of sessions) {
    if (!ids.has(s.bank_id)) continue;
    events.push({
      t: new Date(s.ended_at).getTime(),
      d: sessionResult(s),
      label: `${s.game_type === 'cash' ? 'Cash' : 'Torneo'} ${s.venue === 'live' ? 'live' : 'online'}${s.place ? ' · ' + s.place : ''}`,
    });
  }
  events.sort((a, b) => a.t - b.t);

  let running = base;
  const before: typeof events = [];
  const inside: typeof events = [];
  for (const e of events) {
    if (range && e.t < range.from) before.push(e);
    else if (range && e.t >= range.to) continue;
    else inside.push(e);
  }
  for (const e of before) running += e.d;
  const start = round2(running);

  const points: Point[] = [];
  if (range) {
    points.push({ t: range.from, v: start, label: 'Inicio del periodo', delta: 0 });
  } else if (inside.length) {
    points.push({ t: inside[0].t - 60_000, v: start, label: 'Inicio', delta: 0 });
  }
  for (const e of inside) {
    running += e.d;
    points.push({ t: e.t, v: round2(running), label: e.label, delta: round2(e.d) });
  }
  if (range && points.length) {
    const endT = Math.min(Date.now(), range.to - 1);
    const last = points[points.length - 1];
    if (endT > last.t) points.push({ t: endT, v: last.v, label: 'Ahora', delta: 0 });
  }
  return { points, start, end: points.length ? points[points.length - 1].v : start };
}

/** Beneficio acumulado de las sesiones (sin ingresos ni retiradas), empezando en 0 al inicio del periodo. */
export function profitSeries(list: Session[], range?: { from: number; to: number } | null): Series {
  const evs = list
    .map((s) => ({ t: new Date(s.ended_at).getTime(), s }))
    .filter((e) => !range || (e.t >= range.from && e.t < range.to))
    .sort((a, b) => a.t - b.t);
  if (evs.length === 0) return { points: [], start: 0, end: 0 };

  const points: Point[] = [];
  let run = 0;
  if (range) points.push({ t: range.from, v: 0, label: 'Inicio del periodo', delta: 0 });
  else points.push({ t: evs[0].t - 60_000, v: 0, label: 'Inicio', delta: 0 });
  for (const e of evs) {
    const r = sessionResult(e.s);
    run += r;
    const name = e.s.game_type === 'tournament' && e.s.tournament_name ? e.s.tournament_name : null;
    points.push({
      t: e.t,
      v: round2(run),
      label:
        name ?? `${e.s.game_type === 'cash' ? 'Cash' : 'Torneo'} ${e.s.venue === 'live' ? 'live' : 'online'}${e.s.place ? ' · ' + e.s.place : ''}`,
      delta: round2(r),
    });
  }
  if (range) {
    const endT = Math.min(Date.now(), range.to - 1);
    const last = points[points.length - 1];
    if (endT > last.t) points.push({ t: endT, v: last.v, label: 'Ahora', delta: 0 });
  }
  return { points, start: 0, end: points[points.length - 1].v };
}

// ───────────────────────────── Estadísticas ─────────────────────────────

export interface Stats {
  entries: number; // buy-ins totales (entradas, recompras y re-entries incluidos)
  avgProfit: number; // resultado medio por sesión
  avgProfitPerEntry: number;
  avgRoiTournament: number | null; // media del ROI de cada torneo, en %
  count: number;
  profit: number;
  seconds: number;
  perHour: number;
  invested: number;
  roi: number; // % sobre lo invertido
  winRate: number; // % de sesiones ganadoras
  itm: number | null; // % de torneos con premio
  abi: number | null; // buy-in medio por entrada en torneos (null si no hay torneos)
  bestCash: number; // mayor premio de torneo
  avgMood: number | null;
  avgPlay: number | null;
}

export function computeStats(list: Session[]): Stats {
  let profit = 0;
  let seconds = 0;
  let invested = 0;
  let wins = 0;
  let tCount = 0;
  let tItm = 0;
  let tInvested = 0;
  let tEntries = 0;
  let bestCash = 0;
  let entriesTotal = 0;
  let roiSum = 0;
  let roiN = 0;
  let moodSum = 0;
  let moodN = 0;
  let playSum = 0;
  let playN = 0;
  for (const s of list) {
    const r = sessionResult(s);
    profit += r;
    seconds += s.duration_seconds;
    invested += s.buy_in;
    if (r > 0) wins++;
    entriesTotal += Math.max(1, s.entries);
    if (s.game_type === 'tournament') {
      if (s.buy_in > 0) {
        roiSum += (r / s.buy_in) * 100;
        roiN++;
      }
      tCount++;
      if (s.cash_out > 0) tItm++;
      tInvested += s.buy_in;
      tEntries += Math.max(1, s.entries);
      bestCash = Math.max(bestCash, s.cash_out);
    }
    if (s.mood != null) {
      moodSum += s.mood;
      moodN++;
    }
    if (s.play_quality != null) {
      playSum += s.play_quality;
      playN++;
    }
  }
  const hours = seconds / 3600;
  return {
    entries: entriesTotal,
    avgProfit: list.length ? round2(profit / list.length) : 0,
    avgProfitPerEntry: entriesTotal ? round2(profit / entriesTotal) : 0,
    avgRoiTournament: roiN ? roiSum / roiN : null,
    count: list.length,
    profit: round2(profit),
    seconds,
    perHour: hours > 0 ? round2(profit / hours) : 0,
    invested: round2(invested),
    roi: invested > 0 ? (profit / invested) * 100 : 0,
    winRate: list.length ? (wins / list.length) * 100 : 0,
    itm: tCount ? (tItm / tCount) * 100 : null,
    abi: tCount ? round2(tInvested / tEntries) : null,
    bestCash: round2(bestCash),
    avgMood: moodN ? moodSum / moodN : null,
    avgPlay: playN ? playSum / playN : null,
  };
}

export interface Streaks {
  current: { type: 'win' | 'loss' | null; count: number };
  bestWin: number;
  worstLoss: number;
}

/** Rachas de sesiones ganadoras/perdedoras en orden cronológico. Una sesión a 0 € corta la racha. */
export function computeStreaks(list: Session[]): Streaks {
  const sorted = [...list].sort((a, b) => new Date(a.ended_at).getTime() - new Date(b.ended_at).getTime());
  let curType: 'win' | 'loss' | null = null;
  let curCount = 0;
  let bestWin = 0;
  let worstLoss = 0;
  for (const s of sorted) {
    const r = sessionResult(s);
    const t: 'win' | 'loss' | null = r > 0 ? 'win' : r < 0 ? 'loss' : null;
    if (t !== null && t === curType) curCount++;
    else {
      curType = t;
      curCount = t === null ? 0 : 1;
    }
    if (curType === 'win') bestWin = Math.max(bestWin, curCount);
    if (curType === 'loss') worstLoss = Math.max(worstLoss, curCount);
  }
  return { current: { type: curCount > 0 ? curType : null, count: curCount }, bestWin, worstLoss };
}

export interface MoodRow {
  mood: number;
  count: number;
  perHour: number;
  profit: number;
}

/** €/hora según estado mental (1-5). */
export function moodBreakdown(list: Session[]): MoodRow[] {
  const rows: MoodRow[] = [];
  for (let m = 1; m <= 5; m++) {
    const subset = list.filter((s) => s.mood === m);
    if (!subset.length) continue;
    const st = computeStats(subset);
    rows.push({ mood: m, count: subset.length, perHour: st.perHour, profit: st.profit });
  }
  return rows;
}

export interface GroupRow {
  key: string;
  count: number;
  profit: number;
  perHour: number;
}

export function groupBy(list: Session[], keyFn: (s: Session) => string): GroupRow[] {
  const map = new Map<string, Session[]>();
  for (const s of list) {
    const k = keyFn(s);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.entries()]
    .map(([key, ss]) => {
      const st = computeStats(ss);
      return { key, count: ss.length, profit: st.profit, perHour: st.perHour };
    })
    .sort((a, b) => b.profit - a.profit);
}

// ───────────────────────────── Niveles ─────────────────────────────

export type LevelAction = 'up' | 'down' | 'stay' | 'below';

export interface LevelAdvice {
  action: LevelAction;
  recommended: number | null; // mayor nivel permitido por el bank
  current: number | null; // nivel en el que juegas (último usado, o el recomendado)
  next: number | null;
  toNext: number; // € que faltan para el siguiente nivel
  buyinsAtCurrent: number | null;
  downBelow: number | null; // bank por debajo del cual conviene bajar
}

export function levelAdvice(balance: number, rule: LevelRule, lastStake: number | null): LevelAdvice {
  const ladder = [...rule.ladder].sort((a, b) => a - b);
  const allowed = ladder.filter((v) => v * rule.buyins <= balance + 1e-9);
  const recommended = allowed.length ? allowed[allowed.length - 1] : null;
  const current = lastStake ?? recommended;

  if (current == null) {
    const lowest = ladder[0] ?? null;
    return {
      action: 'below',
      recommended: null,
      current: null,
      next: lowest,
      toNext: lowest ? Math.max(0, round2(lowest * rule.buyins - balance)) : 0,
      buyinsAtCurrent: null,
      downBelow: null,
    };
  }

  const next = ladder.find((v) => v > current) ?? null;
  const downBelow = round2(current * rule.down_buyins);
  let action: LevelAction = 'stay';
  if (next != null && balance >= next * rule.buyins - 1e-9) action = 'up';
  else if (balance < downBelow) action = 'down';

  return {
    action,
    recommended,
    current,
    next,
    toNext: next != null ? Math.max(0, round2(next * rule.buyins - balance)) : 0,
    buyinsAtCurrent: round2(balance / current),
    downBelow,
  };
}

/** Último nivel jugado en una bolsa y tipo de juego (para la histéresis). */
export function lastStakeFor(sessions: Session[], bankId: string, gameType: Session['game_type']): number | null {
  let best: Session | null = null;
  for (const s of sessions) {
    if (s.bank_id !== bankId || s.game_type !== gameType || s.stake == null) continue;
    if (!best || new Date(s.ended_at) > new Date(best.ended_at)) best = s;
  }
  return best?.stake ?? null;
}

// ───────────────────────────── Objetivos ─────────────────────────────

export interface GoalProgress {
  goal: Goal;
  current: number;
  ratio: number; // 0..1 (puede pasar de 1)
}

export function goalProgress(
  goal: Goal,
  banks: Bank[],
  movements: Movement[],
  sessions: Session[],
  now = new Date()
): GoalProgress {
  const scopeBanks = goal.bank_id ? banks.filter((b) => b.id === goal.bank_id) : banks;
  const ids = new Set(scopeBanks.map((b) => b.id));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthSessions = sessions.filter(
    (s) => ids.has(s.bank_id) && new Date(s.ended_at).getTime() >= monthStart
  );
  let current = 0;
  if (goal.kind === 'monthly_profit') current = monthSessions.reduce((a, s) => a + sessionResult(s), 0);
  else if (goal.kind === 'monthly_hours') current = monthSessions.reduce((a, s) => a + s.duration_seconds, 0) / 3600;
  else current = scopeBanks.reduce((a, b) => a + bankBalance(b, movements, sessions), 0);
  current = round2(current);
  return { goal, current, ratio: goal.target > 0 ? Math.max(0, current / goal.target) : 0 };
}
