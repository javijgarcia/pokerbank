const eurFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const eurFmt0 = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function eur(n: number, opts?: { round?: boolean }): string {
  return (opts?.round ? eurFmt0 : eurFmt).format(n);
}

export function signedEur(n: number): string {
  const s = eur(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `−${s}`;
  return s;
}

export function pct(n: number, digits = 0): string {
  return `${n.toLocaleString('es-ES', { maximumFractionDigits: digits })} %`;
}

export function hms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

export function hoursLabel(totalSeconds: number): string {
  const h = totalSeconds / 3600;
  if (h < 1) return `${Math.round(totalSeconds / 60)} min`;
  return `${h.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`;
}

export function dateLabel(iso: string | number): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTimeLabel(iso: string | number): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function monthKey(d: Date | string | number): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthRange(key: string): { from: number; to: number } {
  const [y, m] = key.split('-').map(Number);
  return { from: new Date(y, m - 1, 1).getTime(), to: new Date(y, m, 1).getTime() };
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
