// ════════════════════════════════════════════════════════════════════════
//  Supabase Edge Function — razorpayx-payout
//  Drains payout_requests that the API route couldn't finish (timeouts,
//  crashes between debit and RazorpayX call). Rows are claimed with
//  FOR UPDATE SKIP LOCKED via claim_payouts(), and every call reuses the
//  payout row id as X-Payout-Idempotency, so a retry can never double-pay.
//
//  Schedule every 5 minutes:
//    select cron.schedule('vp-payout-drainer','*/5 * * * *',
//      $$ select net.http_post(
//           url := 'https://<project>.functions.supabase.co/razorpayx-payout',
//           headers := jsonb_build_object('Authorization','Bearer <service-role-key>')
//         ); $$);
// ════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const KEY_ID = Deno.env.get('RAZORPAYX_KEY_ID')!;
const KEY_SECRET = Deno.env.get('RAZORPAYX_KEY_SECRET')!;
const ACCOUNT = Deno.env.get('RAZORPAYX_ACCOUNT_NUMBER')!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface PayoutRow {
  id: string;
  user_id: string;
  amount_paise: number;
  upi_vpa: string;
}

async function sendPayout(row: PayoutRow, name: string) {
  const res = await fetch('https://api.razorpay.com/v1/payouts', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${KEY_ID}:${KEY_SECRET}`),
      'Content-Type': 'application/json',
      'X-Payout-Idempotency': row.id,
    },
    body: JSON.stringify({
      account_number: ACCOUNT,
      amount: row.amount_paise,
      currency: 'INR',
      mode: 'UPI',
      purpose: 'payout',
      fund_account: {
        account_type: 'vpa',
        vpa: { address: row.upi_vpa },
        contact: { name, type: 'customer' },
      },
      queue_if_low_balance: true,
      reference_id: row.id,
      narration: 'VeriPulse Earnings',
    }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  // Only the scheduler (service role) may trigger a drain.
  if (req.headers.get('authorization') !== `Bearer ${SERVICE_KEY}`) {
    return new Response('forbidden', { status: 403 });
  }

  const { data: rows, error } = await admin.rpc('claim_payouts', { p_limit: 10 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: { id: string; outcome: string }[] = [];
  for (const row of (rows ?? []) as PayoutRow[]) {
    const { data: prof } = await admin.from('profiles').select('username').eq('id', row.user_id).single();
    try {
      const r = await sendPayout(row, prof?.username ?? 'VeriPulse User');
      if (r.ok) {
        await admin
          .from('payout_requests')
          .update({
            status: r.data.status === 'processed' ? 'processed' : 'processing',
            razorpay_payout_id: r.data.id,
            bank_utr: r.data.utr ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        results.push({ id: row.id, outcome: r.data.status });
      } else if (r.status >= 400 && r.status < 500) {
        // Definitive rejection (bad VPA, validation) → refund the wallet.
        await admin.rpc('reverse_failed_payout', {
          p_payout_id: row.id,
          p_reason: r.data?.error?.description ?? `HTTP ${r.status}`,
        });
        results.push({ id: row.id, outcome: 'reversed' });
      } else {
        results.push({ id: row.id, outcome: `retry (HTTP ${r.status})` }); // 5xx: next sweep
      }
    } catch (e) {
      results.push({ id: row.id, outcome: `retry (${e instanceof Error ? e.message : e})` });
    }
  }

  return Response.json({ drained: results.length, results });
});
