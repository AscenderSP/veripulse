'use client';

// Loads the browser-side Sentry config once on mount. The config file is
// a no-op without NEXT_PUBLIC_SENTRY_DSN + @sentry/nextjs installed, so
// this import is safe in every build.
import { useEffect } from 'react';

export function SentryBootstrap() {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import('../../../sentry.client.config');
  }, []);
  return null;
}
