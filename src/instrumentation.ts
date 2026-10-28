// Next.js 15 instrumentation hook. Loads the right Sentry config per
// runtime. Also a no-op if the DSN or SDK are missing.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
