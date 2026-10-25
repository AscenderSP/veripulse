/**
 * RazorpayX Composite UPI payout client + webhook signature verification.
 * The DB has already debited the wallet before we reach here; this only
 * moves the actual money and records the provider id / UTR.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const API = 'https://api.razorpay.com/v1';

function auth(): string {
  const id = process.env.RAZORPAYX_KEY_ID;
  const secret = process.env.RAZORPAYX_KEY_SECRET;
  if (!id || !secret) throw new Error('RazorpayX credentials not set');
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

export interface PayoutResult {
  ok: boolean;
  payoutId?: string;
  status?: string;
  utr?: string;
  error?: string;
}

/**
 * Create a composite UPI payout (fund account created inline from the VPA).
 * `idempotencyKey` is sent as X-Payout-Idempotency so a retried request from
 * the drainer never double-pays.
 */
export async function createUpiPayout(params: {
  amountPaise: number;
  upiVpa: string;
  name: string;
  idempotencyKey: string;
  reference: string;
}): Promise<PayoutResult> {
  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!accountNumber) return { ok: false, error: 'RAZORPAYX_ACCOUNT_NUMBER not set' };

  const res = await fetch(`${API}/payouts`, {
    method: 'POST',
    headers: {
      Authorization: auth(),
      'Content-Type': 'application/json',
      'X-Payout-Idempotency': params.idempotencyKey,
    },
    body: JSON.stringify({
      account_number: accountNumber,
      amount: params.amountPaise,
      currency: 'INR',
      mode: 'UPI',
      purpose: 'payout',
      fund_account: {
        account_type: 'vpa',
        vpa: { address: params.upiVpa },
        contact: { name: params.name, type: 'customer' },
      },
      queue_if_low_balance: true,
      reference_id: params.reference,
      narration: 'VeriPulse Earnings',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { ok: false, error: data?.error?.description ?? `HTTP ${res.status}` };
  }
  return {
    ok: true,
    payoutId: data.id,
    status: data.status,
    utr: data.utr ?? undefined,
  };
}

/** Verify a RazorpayX webhook signature (HMAC-SHA256 over the raw body). */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAYX_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
