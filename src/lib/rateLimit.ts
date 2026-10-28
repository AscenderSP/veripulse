// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — in-memory sliding-window rate limiter for /api/admin/*
//  Server-side only. For a multi-instance deployment, swap this for
//  Upstash Redis / Vercel KV using the same signature.
// ════════════════════════════════════════════════════════════════════════

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Check whether `key` can make another request. `limit` is the max in the
 * rolling window of `windowMs` milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitDecision {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { allowed: true, limit, remaining: limit - 1, resetMs: windowMs };
  }
  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const resetMs = Math.max(0, windowMs - (now - existing.windowStart));
  return { allowed: existing.count <= limit, limit, remaining, resetMs };
}

/**
 * Reap stale buckets so the Map doesn't grow unbounded. Called from the
 * admin middleware on roughly 1 in 100 requests.
 */
export function reapRateLimits(windowMs: number): void {
  const cutoff = Date.now() - windowMs * 2;
  for (const [k, v] of buckets) if (v.windowStart < cutoff) buckets.delete(k);
}

/** Build the standard key for a user + bucket name. */
export function rateLimitKey(userId: string, bucket: string): string {
  return `${bucket}:${userId}`;
}
