// Sentry — Node runtime. Same opt-in pattern as sentry.client.config.ts.
export {};

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import(/* webpackIgnore: true */ /* @vite-ignore */ '@sentry/nextjs' as string)
    .then((Sentry: unknown) => {
      (Sentry as { init: (opts: Record<string, unknown>) => void }).init({
        dsn,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      });
    })
    .catch(() => {
      /* SDK not installed. */
    });
}
