'use client';

import type { ReactNode } from 'react';

/** Acepta coma o punto decimal. Devuelve null si está vacío o no es un número. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const tone = (n: number): string => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Rating({
  value,
  onChange,
  low,
  high,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  low: string;
  high: string;
}) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(value === n ? null : n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="row between tiny muted">
        <span>1 · {low}</span>
        <span>5 · {high}</span>
      </div>
    </div>
  );
}

export function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className={`v num ${className}`}>{value}</div>
    </div>
  );
}

export function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <div className="bar" aria-hidden>
      <i style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
    </div>
  );
}
