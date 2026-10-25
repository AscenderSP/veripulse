import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { webhookId } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET|POST /api/affiliate/postback?secret=...&subid=...&commission=...&status=paid&txn=...
 *
 * Server-to-server postback from the merchant / aggregator (Cuelinks, Amazon
 * Associates, Flipkart). Secured by a shared secret compared in constant time.
 * Idempotent: the (provider, txn) pair is hashed into processed_webhooks, so a
 * replayed postback settles nothing twice. On status=paid it runs the atomic
 * 70/20/10 split via settle_affiliate_conversion.
 */
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams;

  const secret = q.get('secret') ?? req.headers.get('x-postback-secret') ?? '';
  const expected = process.env.AFFILIATE_POSTBACK_SECRET ?? '';
  if (!expected || !safeEqual(secret, expected)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const subId = q.get('subid') ?? '';
  const commission = Number(q.get('commission') ?? '0');
  const status = (q.get('status') ?? '').toLowerCase();
  const txn = q.get('txn') ?? subId; // merchant transaction id for replay guard

  if (!subId || !Number.isFinite(commission) || commission <= 0) {
    return NextResponse.json({ error: 'BAD_PARAMS' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  if (status !== 'paid') {
    // Record non-terminal states on the click row without settling money.
    await admin
      .from('affiliate_clicks')
      .update({ conversion_status: status || 'pending', updated_at: new Date().toISOString() })
      .eq('sub_id', subId);
    return NextResponse.json({ ok: true, settled: false, reason: 'NOT_PAID' });
  }

  const whId = webhookId('affiliate', txn);
  const platformPct = Number(process.env.PLATFORM_SHARE_PCT ?? 70);
  const reviewerPct = Number(process.env.REVIEWER_SHARE_PCT ?? 20);
  const sentinelPct = Number(process.env.SENTINEL_SHARE_PCT ?? 10);

  const { data, error } = await admin.rpc('settle_affiliate_conversion', {
    p_sub_id: subId,
    p_commission: commission,
    p_webhook_id: whId,
    p_platform_pct: platformPct,
    p_reviewer_pct: reviewerPct,
    p_sentinel_pct: sentinelPct,
  });

  if (error) {
    return NextResponse.json({ error: 'SETTLE_FAILED', detail: error.message }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    settled: row?.settled ?? false,
    reviewer_credit: row?.reviewer_credit ?? 0,
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const GET = handle;
export const POST = handle;
