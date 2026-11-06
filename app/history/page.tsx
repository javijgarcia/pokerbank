'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/lib/data';
import { computeStats, groupBy } from '@/lib/calc';
import { eur, hoursLabel, monthKey, monthLabel, pct, signedEur } from '@/lib/format';
import BankFilter from '@/components/BankFilter';
import SessionRow from '@/components/SessionRow';
import ShareSheet from '@/components/ShareSheet';
import TournamentStats from '@/components/TournamentStats';
import { Card, Segmented, Stat, tone } from '@/components/ui';
import { receiptUrl } from '@/lib/receipts';
import type { GameType, Session, Venue } from '@/lib/types';

export default function HistoryPage() {
  const d = useData();
  const [type, setType] = useState<'all' | GameType>('all');
  const [venue, setVenue] = useState<'all' | Venue>('all');
  const [month, setMonth] = useState('all');

  const base = useMemo(() => {
    const ids = new Set(d.scopeBanks.map((b) => b.id));
    return d.sessions.filter((s) => ids.has(s.bank_id));
  }, [d.scopeBanks, d.sessions]);

  const months = useMemo(() => [...new Set(base.map((s) => monthKey(s.ended_at)))].sort().reverse(), [base]);

  const list = useMemo(
    () =>
      base
        .filter((s) => (type === 'all' ? true : s.game_type === type))
        .filter((s) => (venue === 'all' ? true : s.venue === venue))
        .filter((s) => (month === 'all' ? true : monthKey(s.ended_at) === month))
        .sort((a, b) => new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime()),
    [base, type, venue, month]
  );

  const stats = useMemo(() => computeStats(list), [list]);
  const places = useMemo(() => groupBy(list, (s) => s.place || 'Sin lugar').slice(0, 6), [list]);
  const bankName = (id: string) => d.banks.find((b) => b.id === id)?.name;

  async function remove(s: Session) {
    if (!window.confirm('¿Borrar esta sesión? Se recalculará tu bankroll.')) return;
    await d.deleteSession(s.id);
  }

  const [sharing, setSharing] = useState<Session | null>(null);
  const [receipt, setReceipt] = useState<{ url: string | null; loading: boolean } | null>(null);

  async function showReceipt(s: Session) {
    if (!s.receipt_path) return;
    setReceipt({ url: null, loading: true });
    setReceipt({ url: await receiptUrl(s.receipt_path), loading: false });
  }

  async function pdf(s: Session) {
    const { downloadSessionPdf } = await import('@/lib/pdf');
    await downloadSessionPdf(s, bankName(s.bank_id) ?? '');
  }

  function exportCsv() {
    const head = ['fecha_inicio', 'fecha_fin', 'bolsa', 'tipo', 'modalidad', 'lugar', 'nombre_torneo', 'nivel', 'buy_in', 'cash_out', 'bounties', 'eliminaciones', 'resultado', 'minutos', 'animo', 'juego', 'notas', 'etiquetas'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = list.map((s) =>
      [s.started_at, s.ended_at, bankName(s.bank_id), s.game_type, s.venue, s.place, s.tournament_name, s.stake, s.buy_in, s.cash_out, s.bounty_total ?? 0, s.bounty_count ?? 0, s.cash_out - s.buy_in, Math.round(s.duration_seconds / 60), s.mood, s.play_quality, s.notes, s.tags.join('|')]
        .map(esc)
        .join(',')
    );
    const blob = new Blob(['﻿' + [head.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pokerbank-sesiones.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <h1>Historial</h1>
      <BankFilter />

      <Card>
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'Todo' },
            { value: 'cash', label: 'Cash' },
            { value: 'tournament', label: 'Torneos' },
          ]}
        />
        <Segmented
          value={venue}
          onChange={setVenue}
          options={[
            { value: 'all', label: 'Todo' },
            { value: 'online', label: 'Online' },
            { value: 'live', label: 'Live' },
          ]}
        />
        <select className="input" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes">
          <option value="all">Todos los meses</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </Card>

      <Card title="Resumen">
        <div className="stats">
          <Stat label="Sesiones" value={String(stats.count)} />
          <Stat label="Tiempo" value={hoursLabel(stats.seconds)} />
          <Stat label="€/hora" value={signedEur(stats.perHour)} className={tone(stats.perHour)} />
          <Stat label="Resultado" value={signedEur(stats.profit)} className={tone(stats.profit)} />
          <Stat label="ROI" value={pct(stats.roi, 1)} className={tone(stats.roi)} />
          <Stat label="Ganadas" value={pct(stats.winRate)} />
        </div>
      </Card>

      <TournamentStats sessions={list} title="Torneos (con estos filtros)" />

      {places.length > 1 && (
        <Card title="Por lugar">
          <div className="list">
            {places.map((p) => (
              <div className="item" key={p.key}>
                <div>
                  <div>{p.key}</div>
                  <div className="tiny muted">
                    {p.count} sesión(es) · {signedEur(p.perHour)}/h
                  </div>
                </div>
                <div className={`amt num ${tone(p.profit)}`}>{signedEur(p.profit)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card
        title={`Sesiones (${list.length})`}
        action={
          list.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={exportCsv}>
              Exportar CSV
            </button>
          )
        }
      >
        {list.length === 0 ? (
          <p className="muted small">No hay sesiones con estos filtros.</p>
        ) : (
          <div className="list">
            {list.map((s) => (
              <SessionRow key={s.id} s={s} bankName={d.banks.length > 1 ? bankName(s.bank_id) : undefined} pending={d.pendingIds.has(s.id)} onDelete={remove} onPdf={pdf} onReceipt={showReceipt} onShare={setSharing} />
            ))}
          </div>
        )}
        {list.length > 0 && (
          <p className="tiny muted">
            Invertido {eur(stats.invested)} · {list.length} sesiones
          </p>
        )}
      </Card>
      {sharing && <ShareSheet s={sharing} onClose={() => setSharing(null)} />}
      {receipt && (
        <div
          role="dialog"
          aria-label="Recibo"
          onClick={() => setReceipt(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}
        >
          {receipt.loading ? (
            <p className="muted">Cargando…</p>
          ) : receipt.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receipt.url} alt="Recibo de la sesión" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
          ) : (
            <p className="error">No se pudo cargar el recibo (¿sin conexión?).</p>
          )}
        </div>
      )}
    </>
  );
}
