// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — server-side captcha token verifier
//  Pair with /api/captcha/issue. Mutating routes call `verifyCaptchaToken`
//  before accepting a submission from the client.
// ════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from 'crypto';

export interface CaptchaVerifyResult {
  ok: boolean;
  reason?: 'missing' | 'malformed' | 'bad_sig' | 'expired';
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Verify a token produced by /api/captcha/issue. The CAPTCHA_SECRET env
 * var must match the one that signed it. In demo (no secret) we accept
 * any value, which keeps the modal visible but harmless.
 */
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
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      exp?: number;
    };
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      return { ok: false, reason: 'expired' };
    }
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  return { ok: true };
}
