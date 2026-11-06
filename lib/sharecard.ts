import { roiLabel, postTitle } from '@/components/PostCard';
import { hoursLabel } from './format';
import type { SharedDraft } from './social';

export const APP_NAME = 'PokerBank';

/** Dibuja la tarjeta de resultado (1080×1080). Solo lleva % y tiempo, nunca euros. */
export async function drawShareCard(p: SharedDraft, playerName: string): Promise<Blob> {
  const W = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = W;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Sin canvas');

  const grad = c.createLinearGradient(0, 0, W, W);
  grad.addColorStop(0, '#0b1018');
  grad.addColorStop(1, '#14202e');
  c.fillStyle = grad;
  c.fillRect(0, 0, W, W);

  const font = (px: number, weight = 600) => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const positive = (p.roi_pct ?? 0) >= 0;
  const accent = positive ? '#34d399' : '#f87171';

  c.fillStyle = accent;
  c.fillRect(0, 0, W, 14);

  c.fillStyle = '#9aa7b8';
  c.font = font(40);
  c.fillText(APP_NAME.toUpperCase(), 80, 120);

  c.fillStyle = '#e8eef6';
  c.font = font(64, 700);
  const title = postTitle(p);
  c.fillText(title.length > 24 ? title.slice(0, 23) + '…' : title, 80, 330);

  c.fillStyle = '#9aa7b8';
  c.font = font(40);
  c.fillText(`${p.game_type === 'cash' ? 'Cash' : 'Torneo'} · ${p.venue === 'live' ? 'Live' : 'Online'}`, 80, 395);

  if (p.roi_pct != null) {
    c.fillStyle = accent;
    c.font = font(220, 800);
    c.fillText(roiLabel(p.roi_pct), 80, 660);
    c.fillStyle = '#9aa7b8';
    c.font = font(38);
    c.fillText('ROI de la sesión', 84, 720);
  }

  const bits = [
    p.game_type === 'tournament' && p.position ? `Puesto ${p.position}${p.players ? ` de ${p.players}` : ''}` : null,
    p.game_type === 'tournament' && p.itm != null ? (p.itm ? 'ITM' : 'Sin premio') : null,
    hoursLabel(p.duration_seconds),
  ].filter(Boolean) as string[];
  c.fillStyle = '#e8eef6';
  c.font = font(52, 600);
  c.fillText(bits.join('  ·  '), 80, 850);

  c.fillStyle = '#9aa7b8';
  c.font = font(38);
  c.fillText(playerName, 80, 980);
  const date = new Date(p.ended_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const w = c.measureText(date).width;
  c.fillText(date, W - 80 - w, 980);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}

/** Comparte la imagen con el menú del móvil; si no hay, la descarga. Devuelve true si se descargó. */
export async function shareImage(blob: Blob, filename = 'resultado-pokerbank.png'): Promise<boolean> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: APP_NAME });
      return false;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
