import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { DataProvider } from '@/lib/data';
import AppShell from '@/components/AppShell';
import SwRegister from '@/components/SwRegister';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'PokerBank',
  description: 'Registro de sesiones y gestión de bankroll de póker',
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
