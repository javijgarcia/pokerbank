'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Series } from '@/lib/calc';
import { dateTimeLabel, eur, signedEur } from '@/lib/format';

const H = 220;
const PAD = { top: 14, right: 12, bottom: 22, left: 46 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export default function BankChart({ series }: { series: Series }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const pts = series.points;
    if (pts.length === 0) return null;
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t;
    const vals = pts.map((p) => p.v);
    let vMin = Math.min(...vals);
    let vMax = Math.max(...vals);
    if (vMin === vMax) {
      vMin -= 1;
      vMax += 1;
    }
    const padV = (vMax - vMin) * 0.12;
    vMin -= padV;
    vMax += padV;
    const iw = w - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
    const y = (v: number) => PAD.top + ih - ((v - vMin) / (vMax - vMin)) * ih;
    const xy = pts.map((p) => ({ x: x(p.t), y: y(p.v) }));
    const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${xy[xy.length - 1].x.toFixed(1)},${H - PAD.bottom} L${xy[0].x.toFixed(1)},${H - PAD.bottom} Z`;
    return { xy, line, area, ticks: niceTicks(vMin, vMax), y, t0, t1 };
  }, [series, w]);

  if (!geo) {
    return (
      <div className="muted small" style={{ padding: '40px 0', textAlign: 'center' }}>
        Aún no hay datos en este periodo.
      </div>
    );
  }

  const up = series.end >= series.start;
  const color = up ? 'var(--pos)' : 'var(--neg)';

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    geo.xy.forEach((p, i) => {
      const dd = Math.abs(p.x - px);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    setHover(best);
  }

  const hp = hover != null ? series.points[hover] : null;
  const hxy = hover != null ? geo.xy[hover] : null;
  const tipLeft = hxy ? Math.min(Math.max(hxy.x, 70), w - 70) : 0;

  const fmtAxis = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace('.0', '')}k` : String(Math.round(v)));

  return (
    <div className="chart" ref={wrapRef}>
      {hp && hxy && (
        <div className="tip" style={{ left: tipLeft }}>
          <b className="num">{eur(hp.v)}</b>
          <span className="muted">
            {dateTimeLabel(hp.t)}
            {hp.delta !== 0 && ` · ${signedEur(hp.delta)}`}
          </span>
          <br />
          <span className="muted">{hp.label}</span>
        </div>
      )}
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Evolución del bankroll"
      >
        <defs>
          <linearGradient id="bk-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={w - PAD.right} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={geo.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {fmtAxis(v)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 5} fontSize="11" fill="var(--muted)">
          {new Date(geo.t0).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
        </text>
        <text x={w - PAD.right} y={H - 5} fontSize="11" fill="var(--muted)" textAnchor="end">
          {new Date(geo.t1).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
        </text>
        <path d={geo.area} fill="url(#bk-fill)" />
        <path d={geo.line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {geo.xy.length <= 40 &&
          geo.xy.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />)}
        {hxy && (
          <>
            <line x1={hxy.x} x2={hxy.x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeDasharray="2 3" />
            <circle cx={hxy.x} cy={hxy.y} r="5" fill={color} stroke="var(--bg)" strokeWidth="2" />
          </>
        )}
      </svg>
    </div>
  );
}
