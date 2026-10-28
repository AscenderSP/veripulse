// ════════════════════════════════════════════════════════════════════════
//  Sentry — browser init.
//  Opt-in: ships inert unless BOTH @sentry/nextjs is installed AND
//  NEXT_PUBLIC_SENTRY_DSN is set. The dynamic import lets the config live
//  in-tree without taking a hard dependency on the SDK.
//
//  To enable:
//    npm install @sentry/nextjs
//    set NEXT_PUBLIC_SENTRY_DSN=https://…@o0.ingest.sentry.io/0 in .env
// ════════════════════════════════════════════════════════════════════════

export {};

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  // Dynamic import so the file stays valid even when the SDK isn't installed.
  // Any webpack/Turbopack resolution failure is swallowed; we fall back to
  // the own /api/log/error beacon which keeps working regardless.
  import(/* webpackIgnore: true */ /* @vite-ignore */ '@sentry/nextjs' as string)
    .then((Sentry: unknown) => {
      const S = Sentry as {
        init: (opts: Record<string, unknown>) => void;
      };
      S.init({
        dsn,
        tracesSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 0,
        environment: process.env.NODE_ENV,
      });
      if (typeof window !== 'undefined') {
        (window as unknown as { Sentry: unknown }).Sentry = Sentry;
      }
    })
    .catch(() => {
      /* SDK not installed — beacon-only mode. */
    });
}
