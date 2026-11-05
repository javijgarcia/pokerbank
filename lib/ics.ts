import type { ScheduledTournament } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

function utc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Texto .ics (iCalendar) con los torneos dados: lo abren Google Calendar, Apple Calendar y Outlook. */
export function buildIcs(list: ScheduledTournament[], hours = 3): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PokerBank//ES', 'CALSCALE:GREGORIAN'];
  for (const t of list) {
    const start = new Date(t.starts_at);
    const end = new Date(start.getTime() + hours * 3_600_000);
    const where = t.place || (t.venue === 'live' ? 'Live' : 'Online');
    const desc = [`Buy-in ${t.buy_in} €`, t.has_bounty ? 'Torneo con bounty (KO)' : '', t.notes ?? ''].filter(Boolean).join(' · ');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@pokerbank`,
      `DTSTAMP:${utc(new Date())}`,
      `DTSTART:${utc(start)}`,
      `DTEND:${utc(end)}`,
      `SUMMARY:${esc(`♠ ${t.name}`)}`,
      `LOCATION:${esc(where)}`,
      `DESCRIPTION:${esc(desc)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Torneo en 30 minutos',
      'TRIGGER:-PT30M',
      'END:VALARM',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(list: ScheduledTournament[], filename = 'torneos-pokerbank.ics'): void {
  const blob = new Blob([buildIcs(list)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
