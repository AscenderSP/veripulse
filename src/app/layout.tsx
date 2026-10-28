import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LangProvider } from '@/hooks/useLang';
import { SessionProvider } from '@/hooks/useSession';
import { ThemeProvider } from '@/hooks/useTheme';
import { GlobalErrorBoundary } from '@/components/shell/GlobalErrorBoundary';

export const metadata: Metadata = {
  title: 'VeriPulse — Verified News & Owner Intelligence',
  description:
    'Crowdsourced, fact-checked news and verified-owner product intelligence. Three languages, one source of truth.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'VeriPulse' },
};

export const viewport: Viewport = {
  themeColor: '#070B14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover', // required for env(safe-area-inset-*)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <GlobalErrorBoundary>
          <ThemeProvider>
            <LangProvider>
              <SessionProvider>{children}</SessionProvider>
            </LangProvider>
          </ThemeProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
