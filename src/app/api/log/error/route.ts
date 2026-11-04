import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabase/server';
import { sanitizeUserText } from '@/lib/sanitize';
import { rateLimit, rateLimitKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serialize `extra` with a hard cap. If the JSON is longer than `max` chars
 * we fall back to a string excerpt rather than slicing the JSON (which can
 * leave a half-open object that JSON.parse would reject). Also scrubs the
 * common auth-token field names so an error payload can't leak credentials.
 */
function safeTruncate(value: unknown, max = 10_000): unknown {
  if (!value || typeof value !== 'object') return null;
  try {
    const scrubbed = JSON.parse(
      JSON.stringify(value, (key, v) => {
        if (/access_token|refresh_token|authorization|api_key|apikey|secret/i.test(key)) {
          return '[redacted]';
        }
        return v;
      }),
    );
    const json = JSON.stringify(scrubbed);
    if (json.length <= max) return scrubbed;
    return { _truncated: true, excerpt: json.slice(0, max) };
  } catch {
    return null;
  }
}

interface ErrorBody {
  message?: unknown;
  stack?: unknown;
  context?: {
    component?: unknown;
    action?: unknown;
    userId?: unknown;
    extra?: unknown;
  };
  ts?: unknown;
}

/**
 * POST /api/log/error — browser-side error sink.
 * Rate-limited per IP (60/min) to stop a bad client from flooding the table.
 */
export async function POST(req: NextRequest) {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
  const decision = rateLimit(rateLimitKey(ip, 'error-log'), 60, 60_000);
  if (!decision.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  }

  let body: ErrorBody;
  try {
    body = (await req.json()) as ErrorBody;
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 });
  }

  const message = sanitizeUserText(body.message, 2000);
  if (!message) return NextResponse.json({ error: 'EMPTY' }, { status: 400 });

  const { user } = await getRequestUser();
  const admin = createSupabaseAdminClient();

  const row = {
    user_id: user?.id ?? null,
    level: 'error' as const,
    message,
    stack: sanitizeUserText(body.stack, 8000) || null,
    component: sanitizeUserText(body.context?.component, 120) || null,
    action: sanitizeUserText(body.context?.action, 120) || null,
    extra: safeTruncate(body.context?.extra),
    ip_address: ip === 'unknown' ? null : ip,
    user_agent: h.get('user-agent'),
  };

  const { error } = await admin.from('app_logs').insert(row);
  if (error) {
    return NextResponse.json({ error: 'INSERT_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
