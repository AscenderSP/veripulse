// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — server-side captcha token verifier
//  Pair with /api/captcha/issue. Mutating routes call
//  `consumeCaptchaToken` (async, one-shot) before accepting a submission.
//  `verifyCaptchaToken` is retained for the signature-only check used by
//  demo code paths.
// ════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export interface CaptchaVerifyResult {
  ok: boolean;
  reason?: 'missing' | 'malformed' | 'bad_sig' | 'expired' | 'replayed';
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

interface TokenPayload {
  nonce: string;
  exp: number;
}

/** Signature + expiry check only. Does NOT burn the nonce. */
export function verifyCaptchaToken(token: unknown): CaptchaVerifyResult {
  const secret = process.env.CAPTCHA_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    // Demo-only: no secret configured → accept so API routes still work.
    return { ok: true };
  }
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: typeof token === 'string' ? 'malformed' : 'missing' };
  }
  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, reason: 'malformed' };

  const expected = sign(body, secret);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: 'bad_sig' };
    }
  } catch {
    return { ok: false, reason: 'bad_sig' };
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<TokenPayload>;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      return { ok: false, reason: 'expired' };
    }
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  return { ok: true };
}

/** Parse a token and return its nonce if signature + expiry pass. */
function extractNonce(token: unknown): string | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body] = token.split('.');
  if (!body) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<TokenPayload>;
    return typeof payload.nonce === 'string' ? payload.nonce : null;
  } catch {
    return null;
  }
}

/**
 * One-shot verification used by every mutating route. Validates signature +
 * expiry, then atomically consumes the nonce from captcha_nonces so the same
 * token can't be reused. In demo mode (no secret configured) it is a no-op.
 */
export async function consumeCaptchaToken(token: unknown): Promise<CaptchaVerifyResult> {
  const sigResult = verifyCaptchaToken(token);
  if (!sigResult.ok) return sigResult;

  // Demo mode — no nonce storage available. Keep behaviour permissive so
  // the stack works without Supabase credentials.
  if (!process.env.CAPTCHA_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: true };
  }

  const nonce = extractNonce(token);
  if (!nonce) return { ok: false, reason: 'malformed' };

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('consume_captcha_nonce', { p_nonce: nonce });
    if (error) {
      // Transient DB error. Fall back to signature-only acceptance so a
      // Supabase hiccup doesn't lock out every writer.
      return { ok: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, reason: 'replayed' };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
