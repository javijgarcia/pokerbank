'use client';

import { useEffect, useState } from 'react';
import { useData } from '@/lib/data';
import { loadPref, savePref } from '@/lib/local';

const SLIDES = [
  { t: 'Bienvenido a PokerBank', p: 'Registra tus sesiones de cash y torneos, online o live, y mira cómo evoluciona tu bankroll. Es gratis y tus datos solo los ves tú.' },
  { t: 'Bolsas y niveles', p: 'Crea una bolsa por cada bankroll (total, cash, torneos, live…). La app te dice a qué nivel puedes jugar según tu saldo; las reglas se ajustan en Ajustes.' },
  { t: 'Jugando ahora', p: 'Abre una sesión desde Inicio y el temporizador cuenta solo. Puedes tener varias a la vez, añadir recompras y, en torneos con bounty, apuntar cada KO desde las notas rápidas.' },
  { t: 'Al terminar', p: 'Cierra la sesión con el resultado, el estado mental y cómo has jugado. Si quieres, adjunta la foto del recibo. Todo se refleja en Estadísticas e Historial.' },
  { t: 'Calendario y feedback', p: 'Programa tus próximos torneos y expórtalos a tu agenda. Y si algo no te convence o te falta algo, dímelo desde Ajustes: esta versión se está construyendo con vuestro feedback.' },
];

/** Recorrido de bienvenida: sale una vez por usuario y se puede volver a ver desde Ajustes. */
export default function WelcomeTour() {
  const d = useData();
  const uid = d.user?.id;
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (uid && !loadPref<boolean>(`welcomed.${uid}`, false)) setOpen(true);
    const show = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener('pb:welcome', show);
    return () => window.removeEventListener('pb:welcome', show);
  }, [uid]);

  function close() {
    if (uid) savePref(`welcomed.${uid}`, true);
    setOpen(false);
  }

  if (!open) return null;
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }}
    >
      <div className="card stack" style={{ maxWidth: 420, width: '100%' }}>
        <div className="tiny muted">
          {i + 1} / {SLIDES.length}
        </div>
        <h2 style={{ margin: 0 }}>{s.t}</h2>
        <p>{s.p}</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" onClick={close}>
            Saltar
          </button>
          {i > 0 && (
            <button className="btn grow" onClick={() => setI(i - 1)}>
              Atrás
            </button>
          )}
          <button className="btn btn-primary grow" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
