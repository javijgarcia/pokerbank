'use client';

import { useEffect, useState } from 'react';
import { eur, hms } from '@/lib/format';
import { APP_NAME, APP_VERSION } from '@/lib/version';

const KO_AMOUNTS = [0.5, 1.25, 2, 0.75, 1.5, 3];
const BUY_IN = 5;

/** Sesión de ejemplo que cuenta tiempo de verdad: nada se guarda. */
function LiveDemo() {
  const [sec, setSec] = useState(5832);
  const [entries, setEntries] = useState(1);
  const [kos, setKos] = useState<number[]>([]);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (out) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [out]);

  const bounty = kos.reduce((a, n) => a + n, 0);
  const reset = () => {
    setSec(5832);
    setEntries(1);
    setKos([]);
    setOut(false);
  };

  return (
    <div className="lp-live" role="group" aria-label="Ejemplo interactivo de una sesión en curso">
      <div className="lp-live-head">
        <div>
          <div className="lp-live-title">Sunday Special</div>
          <div className="lp-live-sub">Torneo online con bounty</div>
        </div>
        <span className={`lp-live-state ${out ? 'is-out' : ''}`}>{out ? 'Eliminado' : 'Jugando'}</span>
      </div>
      <div className="lp-timer" aria-live="off">
        {hms(sec)}
      </div>
      <dl className="lp-live-grid">
        <div>
          <dt>Invertido</dt>
          <dd>{eur(BUY_IN * entries)}</dd>
        </div>
        <div>
          <dt>Entradas</dt>
          <dd>{entries}</dd>
        </div>
        <div>
          <dt>Bounties</dt>
          <dd>
            {eur(bounty)}
            <span className="lp-dim"> ({kos.length} KO)</span>
          </dd>
        </div>
      </dl>
      <div className="lp-live-actions">
        <button className="lp-btn lp-btn-primary" disabled={out} onClick={() => setKos((k) => [...k, KO_AMOUNTS[k.length % KO_AMOUNTS.length]])}>
          + Bounty
        </button>
        <button className="lp-btn lp-btn-line" disabled={out} onClick={() => setEntries((n) => n + 1)}>
          + Entrada
        </button>
        <button className="lp-btn lp-btn-line" onClick={() => (out ? reset() : setOut(true))}>
          {out ? 'Reiniciar' : 'Busteado'}
        </button>
      </div>
      <p className="lp-note">Es un ejemplo: pulsa los botones, nada se guarda.</p>
    </div>
  );
}

const FAQ: { q: string; a: string }[] = [
  { q: '¿Es gratis?', a: 'Sí, mientras dure la beta. Si en el futuro hay funciones de pago, se anunciarán antes de activarlas.' },
  { q: '¿Quién ve mis datos?', a: 'Solo tú. Tus sesiones, bolsas y movimientos están aislados por cuenta. Quien administra la base de datos tiene acceso técnico a ella, pero la app no comparte nada con terceros ni tiene publicidad.' },
  { q: '¿Qué ven mis amigos?', a: 'Solo lo que tú publiques en el feed: ROI en porcentaje, tiempo jugado, puesto e ITM. Nunca importes en euros. Si lo activas, también pueden ver tus estadísticas en porcentaje (sesiones, horas, ROI e ITM).' },
  { q: '¿Cómo la instalo en el móvil?', a: 'Ábrela en el navegador. En iPhone, pulsa Compartir y Añadir a pantalla de inicio. En Android, pulsa Instalar aplicación en el menú del navegador.' },
  { q: '¿Funciona sin conexión?', a: 'Puedes cronometrar y registrar sesiones sin red; se sincronizan cuando vuelve la conexión. Crear bolsas, cambiar ajustes y usar la parte social sí necesitan conexión.' },
  { q: '¿Qué tipos de juego admite?', a: 'Cash y torneos, online y live, con recompras o re-entries y torneos con bounty (KO). Puedes tener varias sesiones abiertas a la vez.' },
  { q: '¿Puedo traer mis sesiones de otra app?', a: 'Todavía no hay importación. Sí puedes registrar a mano sesiones ya jugadas, eligiendo la hora de inicio.' },
  { q: '¿En qué moneda funciona?', a: 'Solo en euros por ahora.' },
  { q: '¿Puedo exportar o borrar mis datos?', a: 'Sí. Desde Ajustes exportas tu historial en CSV o todos tus datos en JSON, y puedes borrar tu cuenta con todas tus sesiones, bolsas y fotos de recibos.' },
];

const EXTRAS: [string, string][] = [
  ['Bolsas y niveles', 'Varias bolsas y un nivel recomendado según tu saldo, con reglas que ajustas tú.'],
  ['Estadísticas', 'ROI, ITM, ABI medio, rachas y cómo rindes según tu estado de ánimo, por semana, mes o año.'],
  ['Recibos y calendario', 'Foto del recibo en cada sesión, y torneos programados que exportas a tu agenda.'],
  ['Sin conexión', 'Registra sin red y sincroniza después.'],
  ['Tus datos', 'Exporta o borra todo cuando quieras.'],
];

export default function Landing({ onEnter }: { onEnter: (mode: 'in' | 'up') => void }) {
  return (
    <div className="lp">
      <header className="lp-wrap lp-header">
        <span className="lp-brand">{APP_NAME}</span>
        <button className="lp-btn lp-btn-line lp-btn-sm" onClick={() => onEnter('in')}>
          Entrar
        </button>
      </header>

      <main>
        <section className="lp-wrap lp-hero">
          <div className="lp-hero-copy">
            <h1>Anota la sesión mientras la juegas.</h1>
            <p className="lp-lead">
              Temporizador, recompras y bounties desde el móvil. Y si quieres, cuéntales a tus amigos cómo te ha ido sin enseñarles cuánto.
            </p>
            <div className="lp-cta">
              <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => onEnter('up')}>
                Empezar gratis
              </button>
              <button className="lp-btn lp-btn-link" onClick={() => onEnter('in')}>
                Ya tengo cuenta
              </button>
            </div>
            <p className="lp-note">Gratis durante la beta. Se instala en el móvil como una app.</p>
          </div>
          <LiveDemo />
        </section>

        <section className="lp-wrap lp-section" aria-labelledby="lp-funciones">
          <h2 id="lp-funciones">Pensada para jugar, no para rellenar formularios</h2>

          <div className="lp-row">
            <div>
              <h3>Varias sesiones a la vez</h3>
              <p>Si juegas dos torneos o un cash y un torneo, cada uno tiene su temporizador. Pausa, añade una entrada o ciérralo sin entrar en la sesión.</p>
            </div>
            <div className="lp-mini" aria-hidden>
              <div className="lp-mini-line">
                <span>Sunday Special</span>
                <b className="lp-num">01:37:12</b>
              </div>
              <div className="lp-mini-line">
                <span>NL5 online</span>
                <b className="lp-num">00:42:08</b>
              </div>
              <div className="lp-mini-line lp-dim">
                <span>Mixto live</span>
                <b className="lp-num">Pausada</b>
              </div>
            </div>
          </div>

          <div className="lp-row lp-row-flip">
            <div>
              <h3>Bounties sin perder el hilo</h3>
              <p>Cada eliminación se apunta con un toque y su importe. Al terminar, el premio va aparte de los bounties: si cobras premio cuentas como ITM, si solo hay bounties, no.</p>
            </div>
            <div className="lp-mini" aria-hidden>
              <div className="lp-mini-line">
                <span>KO 1</span>
                <b className="lp-num lp-pos">+0,50 €</b>
              </div>
              <div className="lp-mini-line">
                <span>KO 2</span>
                <b className="lp-num lp-pos">+1,25 €</b>
              </div>
              <div className="lp-mini-line lp-mini-total">
                <span>Premio 12,00 € e ITM</span>
                <b className="lp-num">13,75 €</b>
              </div>
            </div>
          </div>

          <div className="lp-row">
            <div>
              <h3>Compartes el resultado, no tu dinero</h3>
              <p>Publica una sesión en el feed de tus amigos o envía una tarjeta por WhatsApp. Solo salen el ROI en porcentaje, el tiempo y el puesto. Los euros no salen de tu cuenta.</p>
            </div>
            <div className="lp-mini lp-post" aria-hidden>
              <div className="lp-mini-line">
                <span>Ana</span>
                <b className="lp-num lp-pos">+142,5 %</b>
              </div>
              <div className="lp-dim">Torneo online, puesto 3 de 210</div>
              <div className="lp-dim">ITM, 2,5 h de juego</div>
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-section" aria-labelledby="lp-extras">
          <h2 id="lp-extras">Y además</h2>
          <dl className="lp-extras">
            {EXTRAS.map(([t, d]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="lp-wrap lp-section" aria-labelledby="lp-pasos">
          <h2 id="lp-pasos">Empieza en un minuto</h2>
          <ol className="lp-steps">
            <li>
              <b>Crea tu cuenta.</b> Con tu correo y una contraseña.
            </li>
            <li>
              <b>Abre una sesión.</b> Elige cash o torneo y el buy-in. El temporizador arranca solo.
            </li>
            <li>
              <b>Ciérrala al terminar.</b> Apunta el resultado y cómo has jugado; el bankroll y las estadísticas se actualizan.
            </li>
          </ol>
        </section>

        <section className="lp-wrap lp-section" aria-labelledby="lp-faq">
          <h2 id="lp-faq">Preguntas frecuentes</h2>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-wrap lp-final">
          <h2 id="lp-final">La próxima sesión, anótala desde la mesa.</h2>
          <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => onEnter('up')}>
            Crear mi cuenta gratis
          </button>
        </section>
      </main>

      <footer className="lp-wrap lp-footer">
        <span>
          {APP_NAME} {APP_VERSION}, en beta
        </span>
        <button className="lp-btn lp-btn-link" onClick={() => onEnter('in')}>
          Entrar
        </button>
      </footer>
    </div>
  );
}
