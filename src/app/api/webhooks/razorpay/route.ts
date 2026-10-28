// ════════════════════════════════════════════════════════════════════════
//  POST /api/webhooks/razorpay
//
//  Server-trusted side of subscription activation. The browser-side
//  `activateSubscription()` now opens Razorpay Checkout and relies on this
//  webhook to flip the profile row — it cannot fabricate a subscription
//  without a signed webhook from Razorpay.
//
//  Verify: HMAC-SHA256 of the raw request body against RAZORPAY_WEBHOOK_SECRET,
//  compared in constant time to the X-Razorpay-Signature header.
//  Events supported:
//    · subscription.activated / subscription.charged → activate / renew
//    · subscription.cancelled                        → revoke tier
//    · payment.captured { entity.notes.plan_id='press_pass' } → journalist pass
//
//  Idempotency: every event carries `event_id`; we insert into
//  razorpay_webhook_events on first sight and skip on conflict.
// ════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { ACCOUNT_TYPES } from '@/lib/accountTiers';
import { track } from '@/lib/errorTracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUBSCRIPTION_PERIOD_DAYS = 30;

function verify(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  try {
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface RazorpayEvent {
  event?: string;
  payload?: {
    subscription?: { entity?: { id?: string; status?: string; notes?: { user_id?: string; plan?: string } } };
    payment?: { entity?: { id?: string; notes?: { user_id?: string; plan?: string } } };
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503 });
  }
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  if (!verify(raw, signature, secret)) {
    return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 401 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 });
  }

  const eventId = req.headers.get('x-razorpay-event-id') ?? `evt_${Date.now()}`;
  const admin = createSupabaseAdminClient();

  // Idempotency guard. The table is created lazily; migration 0009 adds it.
  const { error: dupErr } = await admin
    .from('razorpay_webhook_events')
    .insert({ event_id: eventId, event: event.event, payload: event });
  // Error 23505 = unique violation. Anything else is logged but we still
  // attempt to apply the mutation, because missing idempotency row shouldn't
  // block a legitimate activation.
  if (dupErr && (dupErr as unknown as { code?: string }).code === '23505') {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  const sub = event.payload?.subscription?.entity;
  const pay = event.payload?.payment?.entity;

  if (event.event === 'subscription.activated' || event.event === 'subscription.charged') {
    const userId = sub?.notes?.user_id;
    if (!userId) return NextResponse.json({ ok: true, skipped: 'no_user_id' });
    const expires = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 86400_000).toISOString();
    const meta = ACCOUNT_TYPES.pro_reporter;
    await admin
      .from('profiles')
      .update({
        subscription_tier: 'pro',
        subscription_expires_at: expires,
        account_type: 'pro_reporter',
        daily_post_limit: meta.dailyPostLimit,
        badge: 'Pro Reporter',
      })
      .eq('id', userId);
    track('subscription_activate', { user_id: userId, event: event.event });
    return NextResponse.json({ ok: true });
  }

  if (event.event === 'subscription.cancelled') {
    const userId = sub?.notes?.user_id;
    if (!userId) return NextResponse.json({ ok: true, skipped: 'no_user_id' });
    const meta = ACCOUNT_TYPES.citizen_reporter;
    await admin
      .from('profiles')
      .update({
        subscription_tier: 'free',
        subscription_expires_at: null,
        account_type: 'citizen_reporter',
        daily_post_limit: meta.dailyPostLimit,
        badge: 'Citizen Reporter',
      })
      .eq('id', userId);
    return NextResponse.json({ ok: true });
  }

  if (event.event === 'payment.captured' && pay?.notes?.plan === 'press_pass') {
    const userId = pay.notes?.user_id;
    if (!userId) return NextResponse.json({ ok: true, skipped: 'no_user_id' });
    await admin.from('profiles').update({ is_press_pass_paid: true }).eq('id', userId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event.event });
}
