import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { DataProvider } from '@/lib/data';
import AppShell from '@/components/AppShell';
import SwRegister from '@/components/SwRegister';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'PokerBank: anota tus sesiones de póker mientras las juegas',
  description: 'Temporizador, recompras y bounties desde el móvil, bankroll por bolsas y un feed con amigos donde solo se ve el ROI, nunca tu dinero. Gratis en beta.',
  openGraph: {
    title: 'PokerBank: anota tus sesiones de póker mientras las juegas',
    description: 'Temporizador, bounties, bankroll y un feed con amigos sin enseñar euros. Gratis en beta.',
    type: 'website',
    locale: 'es_ES',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'PokerBank', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#0b0f14',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <DataProvider>
          <AppShell>{children}</AppShell>
        </DataProvider>
        <SwRegister />
      </body>
    </html>
  );
}
