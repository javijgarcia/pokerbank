import { monthLabel, monthKey } from './format';

export type PeriodKind = 'week' | 'month' | 'year' | 'all';

export interface Range {
  from: number; // inclusivo
  to: number; // exclusivo
}

/** Rango de un periodo. offset 0 = el actual, -1 = el anterior… La semana empieza en lunes. */
export function periodRange(kind: PeriodKind, offset: number, now = new Date()): Range | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (kind === 'all') return null;
  if (kind === 'month') {
    return { from: new Date(y, m + offset, 1).getTime(), to: new Date(y, m + offset + 1, 1).getTime() };
  }
  if (kind === 'year') {
    return { from: new Date(y + offset, 0, 1).getTime(), to: new Date(y + offset + 1, 0, 1).getTime() };
  }
  const start = new Date(y, m, now.getDate());
  const sinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - sinceMonday + offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { from: start.getTime(), to: end.getTime() };
}

export function periodLabel(kind: PeriodKind, range: Range | null): string {
  if (!range) return 'Todo el histórico';
  if (kind === 'month') return monthLabel(monthKey(range.from));
  if (kind === 'year') return String(new Date(range.from).getFullYear());
  const f = new Date(range.from);
  const t = new Date(range.to - 1);
  const day = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `${day(f)} – ${day(t)} ${t.getFullYear()}`;
}

export const inRange = (t: number, r: Range | null): boolean => !r || (t >= r.from && t < r.to);
