import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, createSupabaseAdminClient } from '@/lib/supabase/server';
import { createUpiPayout } from '@/lib/razorpayx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUSINESS_ERRORS = [
  'BELOW_MIN_PAYOUT',
  'TRUST_TOO_LOW',
  'INSUFFICIENT_BALANCE',
  'NO_UPI_ON_FILE',
  'BAD_IDEMPOTENCY_KEY',
];

/**
 * POST /api/payouts/upi
 * Body: { amount_inr, idempotency_key }
 *
 * request_upi_payout does the money-safe part atomically: it locks the wallet
 * row FOR UPDATE, validates balance (>= ₹100) and trust (>= 70) — both fixed
 * server-side — DEBITS, writes the ledger, and enqueues the request, all
 * before any external call. Only then do we hit RazorpayX. A hard failure
 * reverses the debit; a timeout leaves the row for the razorpayx-payout
 * drainer, which retries with the same idempotency key.
 *
 * The RazorpayX idempotency key is our payout row id: stable across retries
 * from this route and the drainer, so a payout can never be sent twice.
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getRequestUser();
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

    const body = await req.json();
    const amount = Math.round(Number(body.amount_inr) * 100) / 100;
    const idemKey: string = (body.idempotency_key ?? '').toString();
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'BAD_AMOUNT' }, { status: 400 });
    }
    if (idemKey.length < 8 || idemKey.length > 120) {
      return NextResponse.json({ error: 'BAD_IDEMPOTENCY_KEY' }, { status: 400 });
    }

    // ── Atomic debit + enqueue (acts as the user) ──
    const { data, error } = await supabase.rpc('request_upi_payout', {
      p_amount_inr: amount,
      p_idempotency_key: idemKey,
    });

    if (error) {
      const code = BUSINESS_ERRORS.find((c) => error.message.includes(c));
      return NextResponse.json({ error: code ?? 'PAYOUT_REQUEST_FAILED' }, { status: code ? 422 : 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    const payoutId: string = row.payout_id;

    // Idempotent replay → current state, no re-pay.
    if (row.status !== 'queued') {
      return NextResponse.json({ payout_id: payoutId, status: row.status, replayed: true });
    }

    const admin = createSupabaseAdminClient();
    // Claim the row: only flip queued → processing once, so the drainer and a
    // replayed request can't both send it.
    const { data: claimed } = await admin
      .from('payout_requests')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', payoutId)
      .eq('status', 'queued')
      .select('amount_paise, upi_vpa')
      .maybeSingle();
    if (!claimed) {
      return NextResponse.json({ payout_id: payoutId, status: 'processing', replayed: true });
    }

    const { data: prof } = await admin.from('profiles').select('username').eq('id', user.id).single();

    let result;
    try {
      result = await createUpiPayout({
        amountPaise: claimed.amount_paise,
        upiVpa: claimed.upi_vpa,
        name: prof?.username ?? 'VeriPulse User',
        idempotencyKey: payoutId,
        reference: payoutId,
      });
    } catch {
      // Network/timeout: outcome unknown. Leave it 'processing' — the drainer
      // retries with the same idempotency key, which RazorpayX dedupes.
      return NextResponse.json({ payout_id: payoutId, status: 'processing' }, { status: 202 });
    }

    if (!result.ok) {
      await admin.rpc('reverse_failed_payout', {
        p_payout_id: payoutId,
        p_reason: result.error ?? 'RAZORPAYX_FAILED',
      });
      return NextResponse.json(
        { payout_id: payoutId, status: 'reversed', error: result.error },
        { status: 502 },
      );
    }

    await admin
      .from('payout_requests')
      .update({
        status: result.status === 'processed' ? 'processed' : 'processing',
        razorpay_payout_id: result.payoutId,
        bank_utr: result.utr ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payoutId);

    return NextResponse.json({
      payout_id: payoutId,
      razorpay_payout_id: result.payoutId,
      status: result.status,
      utr: result.utr ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return NextResponse.json({ error: 'SERVER_ERROR', detail: msg }, { status: 500 });
  }
}
