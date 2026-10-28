// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — error + event reporter
//
//  Dual-sink: in production, every call fans out to the local /api/log/*
//  endpoints (app_logs / app_events tables) AND to Sentry if the SDK is
//  loaded globally. The Sentry call is wrapped in `typeof window.Sentry`
//  so we don't take a hard dependency on @sentry/nextjs — install it via
//  `npm i @sentry/nextjs` and the import block in `sentry.client.config.ts`
//  will light up both sinks automatically.
// ════════════════════════════════════════════════════════════════════════

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
const apiOrigin =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_ORIGIN ?? '' : '';

interface SentryGlobal {
  captureException?: (err: unknown, hint?: { contexts?: Record<string, unknown> }) => void;
  captureMessage?: (msg: string, level?: string) => void;
}

function getSentry(): SentryGlobal | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { Sentry?: SentryGlobal };
  return w.Sentry ?? null;
}

function beaconUrl(path: string): string {
  if (!apiOrigin || apiOrigin === '/') return path;
  return `${apiOrigin.replace(/\/+$/, '')}${path}`;
}

/** Report a thrown error. Routed to Sentry (if loaded) + /api/log/error. */
export function reportError(err: unknown, context: ErrorContext = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  // 1. Sentry if available.
  try {
    const Sentry = getSentry();
    Sentry?.captureException?.(err, { contexts: { vp: context as Record<string, unknown> } });
  } catch {
    /* non-fatal */
  }

  if (!isProd) {
    // eslint-disable-next-line no-console
    console.error('[reportError]', message, { ...context, stack });
    return;
  }

  // 2. Own beacon → app_logs.
  try {
    const body = JSON.stringify({ message, stack, context, ts: Date.now() });
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(beaconUrl('/api/log/error'), body);
    } else {
      void fetch(beaconUrl('/api/log/error'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
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
    const body = JSON.stringify({ event, payload, ts: Date.now() });
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(beaconUrl('/api/log/event'), body);
    } else {
      void fetch(beaconUrl('/api/log/event'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
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
