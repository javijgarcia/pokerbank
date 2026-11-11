import type { ReactNode } from 'react';

/** Iconos de trazo (misma línea que la barra de navegación). Decorativos: llevan aria-hidden. */
function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={{ flex: 'none' }}>
      {children}
    </svg>
  );
}

/** Cash: fichas apiladas. */
export const IconCash = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <ellipse cx="12" cy="6.5" rx="7" ry="2.8" />
    <path d="M5 6.5v4.2c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6.5" />
    <path d="M5 10.7v4.2c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4.2" />
    <path d="M5 14.9v2.6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-2.6" />
  </Svg>
);

/** Torneo: trofeo. */
export const IconTrophy = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M8 4h8v5a4 4 0 01-8 0V4z" />
    <path d="M8 6H5v1.5A3 3 0 008 10.5M16 6h3v1.5a3 3 0 01-3 3" />
    <path d="M12 13v4M8.5 20h7M10 17h4v3h-4z" />
  </Svg>
);

/** Online: globo. */
export const IconGlobe = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9S14.5 18.4 12 21c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" />
  </Svg>
);

/** Live: chincheta de lugar. */
export const IconPin = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 21s7-6.2 7-11.2A7 7 0 005 9.8C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.8" r="2.6" />
  </Svg>
);

/** Todo: capas. */
export const IconLayers = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Svg>
);
