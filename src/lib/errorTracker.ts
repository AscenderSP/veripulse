// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — lightweight error + event reporter
//  Thin shim so the rest of the app can call track / reportError without
//  caring whether Sentry / PostHog / Vercel Analytics is actually wired up.
//
//  To swap in Sentry: install @sentry/nextjs, init in sentry.client.config.ts
//  and sentry.server.config.ts, then replace the implementations below with
//  Sentry.captureException / Sentry.captureMessage. All call sites keep
//  working.
// ════════════════════════════════════════════════════════════════════════

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

const dsn = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined;
const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

/** Report a thrown error. In dev it goes to the console; in prod it would ship to Sentry. */
export function reportError(err: unknown, context: ErrorContext = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  if (!isProd || !dsn) {
    // eslint-disable-next-line no-console
    console.error('[reportError]', message, { ...context, stack });
    return;
  }
  // In prod with a DSN set, forward to the browser endpoint if possible.
  // The real wiring (Sentry.captureException) replaces this block.
  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const body = JSON.stringify({ message, stack, context, ts: Date.now() });
      navigator.sendBeacon('/api/log/error', body);
    }
  } catch {
    /* don't let the reporter itself throw */
  }
}

export type AnalyticsEvent =
  | 'filter_apply'
  | 'story_publish'
  | 'review_submit'
  | 'bounty_claim'
  | 'admin_action'
  | 'subscription_activate'
  | 'auth_signin'
  | 'app_error';

export interface AnalyticsPayload {
  [key: string]: string | number | boolean | null | undefined;
}

/** Record a product event. Safe to call anywhere; a no-op without a backend. */
export function track(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.debug('[track]', event, payload);
    return;
  }
  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(
        '/api/log/event',
        JSON.stringify({ event, payload, ts: Date.now() }),
      );
    }
  } catch {
    /* no-op */
  }
}

/** Install a global `window.onerror` + `unhandledrejection` sink. Call once. */
export function installGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { __vpErrorHandlersInstalled?: boolean }).__vpErrorHandlersInstalled) {
    return;
  }
  (window as unknown as { __vpErrorHandlersInstalled: boolean }).__vpErrorHandlersInstalled = true;

  window.addEventListener('error', (ev) => {
    reportError(ev.error ?? ev.message, { component: 'window', action: 'error' });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    reportError(ev.reason, { component: 'window', action: 'unhandledrejection' });
  });
}
