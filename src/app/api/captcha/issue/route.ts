// ════════════════════════════════════════════════════════════════════════
//  POST /api/captcha/issue
//
//  Mints a short-lived signed captcha token. The browser widget stores it
//  with the challenge and, on solve, forwards it to the mutating route
//  alongside the user's answer. The verify route then checks the token's
//  HMAC + expiry; no server-side state is needed.
//
//  Token = base64url(payload) + "." + base64url(HMAC-SHA256(secret, payload))
//  payload = { nonce, exp }
// ════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';
import { rateLimit, rateLimitKey } from '@/lib/rateLimit';
import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export async function POST() {
  const secret = process.env.CAPTCHA_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'veripulse-dev';
  // Per-IP throttle so the issue endpoint isn't itself an abuse surface.
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
  const dec = rateLimit(rateLimitKey(ip, 'captcha-issue'), 60, 60_000);
  if (!dec.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  }

  const payload = {
    nonce: randomBytes(12).toString('base64url'),
    exp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 min
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(body, secret);
  return NextResponse.json({ token: `${body}.${sig}` });
}
