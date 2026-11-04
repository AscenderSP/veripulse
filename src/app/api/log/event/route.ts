import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabase/server';
import { sanitizeUserText } from '@/lib/sanitize';
import { rateLimit, rateLimitKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_EVENTS = new Set([
  'filter_apply',
  'story_publish',
  'review_submit',
  'bounty_claim',
  'admin_action',
  'subscription_activate',
  'auth_signin',
  'app_error',
]);

/** POST /api/log/event — product analytics beacon. Rate-limited per IP. */
export async function POST(req: NextRequest) {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
  const decision = rateLimit(rateLimitKey(ip, 'event-log'), 300, 60_000);
  if (!decision.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  }

  let body: { event?: unknown; payload?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 });
  }

  const event = sanitizeUserText(body.event, 60);
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: 'UNKNOWN_EVENT' }, { status: 400 });
  }

  const { user } = await getRequestUser();
  const admin = createSupabaseAdminClient();

  let payload: unknown = null;
  if (body.payload && typeof body.payload === 'object') {
    try {
      const json = JSON.stringify(body.payload);
      // Cap size but avoid slicing JSON mid-structure.
      if (json.length <= 10_000) {
        payload = JSON.parse(json);
      } else {
        payload = { _truncated: true, excerpt: json.slice(0, 10_000) };
      }
    } catch {
      payload = null;
    }
  }

  const { error } = await admin.from('app_events').insert({
    user_id: user?.id ?? null,
    event,
    payload,
  });
  if (error) return NextResponse.json({ error: 'INSERT_FAILED' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
