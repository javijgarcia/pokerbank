'use client';

import { useState } from 'react';
import { useData } from '@/lib/data';
import { APP_VERSION, FEEDBACK_EMAIL } from '@/lib/version';
import { Card } from './ui';

/** Versión, feedback, privacidad, exportar datos y borrar cuenta. */
export default function AccountCards() {
  const d = useData();
  const [confirm, setConfirm] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mailto = FEEDBACK_EMAIL
    ? `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`PokerBank v${APP_VERSION} · feedback`)}&body=${encodeURIComponent(
        `\n\n—\nVersión: ${APP_VERSION}\nDispositivo: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`
      )}`
    : null;

  function exportJson() {
    const data = {
      exportado: new Date().toISOString(),
      version: APP_VERSION,
      bolsas: d.banks,
      movimientos: d.movements,
      sesiones: d.sessions,
      reglas_de_nivel: d.rules,
      objetivos: d.goals,
      presets: d.presets,
      torneos_programados: d.scheduled,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pokerbank-mis-datos.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function remove() {
    setBusy(true);
    setErr(await d.deleteAccount());
    setBusy(false);
  }

  return (
    <>
      <Card title="Ayuda y feedback">
        <p className="small muted">PokerBank v{APP_VERSION}</p>
        {mailto ? (
          <a className="btn" href={mailto}>
            Enviar feedback
          </a>
        ) : (
          <p className="tiny muted">Para activar el botón de feedback, define NEXT_PUBLIC_FEEDBACK_EMAIL en las variables de entorno (ver README).</p>
        )}
        <button className="btn btn-ghost" onClick={() => window.dispatchEvent(new Event('pb:welcome'))}>
          Ver el recorrido de bienvenida
        </button>
      </Card>

      <Card title="Privacidad y datos">
        <p className="small muted">
          Guardamos tu correo, tus bolsas, sesiones, objetivos y, si las subes, las fotos de recibos. Cada usuario solo puede ver sus propios datos. Quien administra la base de datos tiene acceso técnico a ella. No compartimos nada con terceros ni hay publicidad.
        </p>
        <button className="btn" onClick={exportJson}>
          Exportar mis datos (JSON)
        </button>
        {!open ? (
          <button className="btn btn-danger" onClick={() => setOpen(true)}>
            Borrar mi cuenta y mis datos
          </button>
        ) : (
          <div className="stack">
            <p className="small">
              Se borrarán tu cuenta, todas tus sesiones, bolsas y fotos. No se puede deshacer. Escribe <strong>BORRAR</strong> para confirmar.
            </p>
            <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Escribe BORRAR" />
            {err && <p className="error">{err}</p>}
            <div className="row">
              <button className="btn grow" onClick={() => { setOpen(false); setConfirm(''); setErr(null); }}>
                Cancelar
              </button>
              <button className="btn btn-danger grow" disabled={confirm !== 'BORRAR' || busy} onClick={remove}>
                {busy ? 'Borrando…' : 'Borrar todo'}
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
