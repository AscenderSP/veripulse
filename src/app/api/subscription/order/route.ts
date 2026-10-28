// ════════════════════════════════════════════════════════════════════════
//  POST /api/subscription/order
//
//  Creates a Razorpay subscription for the current user and returns its
//  id so the browser can open Checkout. The client never activates the
//  tier; the webhook does, once Razorpay confirms the first charge.
// ════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { user } = await getRequestUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_PRO_PLAN_ID;
  if (!keyId || !keySecret || !planId) {
    return NextResponse.json({ error: 'PAYMENTS_NOT_CONFIGURED' }, { status: 503 });
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const body = {
    plan_id: planId,
    total_count: 12,
    customer_notify: 1,
    notes: { user_id: user.id, plan: 'pro' },
  };

  const resp = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return NextResponse.json({ error: 'RAZORPAY_FAILED', detail }, { status: 502 });
  }
  const sub = (await resp.json()) as { id: string; status: string };
  return NextResponse.json({
    subscriptionId: sub.id,
    keyId,
    userId: user.id,
  });
}
