import type { Session } from './types';

// jsPDF usa Helvetica (WinAnsi): admite acentos y €, pero no el signo menos "−". Usamos "-".
const eurPdf = (n: number) =>
  `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const signedPdf = (n: number) => (n > 0 ? '+' : '') + eurPdf(n);

const dt = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Genera y descarga un PDF con el resumen de una sesión. El módulo se carga solo al usarlo. */
export async function downloadSessionPdf(s: Session, bankName: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 18;
  const right = 192;
  let y = 24;

  const result = s.cash_out - s.buy_in;
  const hours = s.duration_seconds / 3600;
  const minutes = Math.round(s.duration_seconds / 60);
  const kind = `${s.game_type === 'cash' ? 'Cash' : 'Torneo'} ${s.venue === 'live' ? 'live' : 'online'}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('PokerBank · Informe de sesión', left, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, left, y);
  doc.setTextColor(0);
  y += 6;
  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 10;

  const rows: [string, string][] = [
    ['Tipo', kind],
    ['Bolsa', bankName || '—'],
    ['Lugar', s.place || '—'],
    ...(s.game_type === 'tournament' ? ([['Torneo', s.tournament_name || '—']] as [string, string][]) : []),
    ['Nivel', s.stake != null ? (s.game_type === 'cash' ? `NL${s.stake}` : `ABI ${eurPdf(s.stake)}`) : '—'],
    ['Inicio', dt(s.started_at)],
    ['Fin', dt(s.ended_at)],
    ['Duración', `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`],
    ['Buy-in total', eurPdf(s.buy_in)],
    ['Entradas / recompras', String(s.entries)],
    ['Cash-out / premio', eurPdf(s.cash_out)],
  ];
  if (s.game_type === 'tournament' && (s.bounty_total ?? 0) > 0) {
    rows.push(['Premio sin bounties', eurPdf(s.cash_out - (s.bounty_total ?? 0))]);
    rows.push(['Bounties', `${eurPdf(s.bounty_total ?? 0)} (${s.bounty_count ?? 0} eliminaciones)`]);
  }
  if (s.game_type === 'tournament' && s.position != null) {
    rows.push(['Puesto', s.players ? `${s.position} de ${s.players}` : String(s.position)]);
  }

  doc.setFontSize(11);
  for (const [k, v] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    doc.text(k, left, y);
    doc.setTextColor(0);
    doc.text(v, right, y, { align: 'right' });
    y += 7;
  }

  y += 3;
  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Resultado', left, y);
  if (result > 0) doc.setTextColor(16, 150, 100);
  else if (result < 0) doc.setTextColor(200, 50, 50);
  doc.text(signedPdf(result), right, y, { align: 'right' });
  doc.setTextColor(0);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  if (hours > 0) {
    doc.setTextColor(110);
    doc.text('Resultado por hora', left, y);
    doc.setTextColor(0);
    doc.text(signedPdf(Math.round((result / hours) * 100) / 100) + ' / h', right, y, { align: 'right' });
    y += 7;
  }
  if (s.mood != null) {
    doc.setTextColor(110);
    doc.text('Estado mental', left, y);
    doc.setTextColor(0);
    doc.text(`${s.mood} / 5`, right, y, { align: 'right' });
    y += 7;
  }
  if (s.play_quality != null) {
    doc.setTextColor(110);
    doc.text('Calidad de juego', left, y);
    doc.setTextColor(0);
    doc.text(`${s.play_quality} / 5`, right, y, { align: 'right' });
    y += 7;
  }
  if (s.tags.length) {
    doc.setTextColor(110);
    doc.text('Etiquetas', left, y);
    doc.setTextColor(0);
    doc.text(s.tags.join(', '), right, y, { align: 'right' });
    y += 7;
  }
  if (s.notes) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Notas', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(s.notes, right - left) as string[];
    doc.text(lines, left, y);
  }

  const day = s.ended_at.slice(0, 10);
  doc.save(`sesion-${day}-${s.id.slice(0, 6)}.pdf`);
}
