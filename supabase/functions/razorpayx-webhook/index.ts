// ════════════════════════════════════════════════════════════════════════
//  Supabase Edge Function — razorpayx-webhook
//  Receives RazorpayX payout.* events. Verifies X-Razorpay-Signature
//  (HMAC-SHA256 of the raw body), drops replays by event id, and applies
//  the status via apply_payout_webhook — which records the bank UTR on
//  success and refunds the wallet on failure/reversal.
//
//  Configure in RazorpayX → Settings → Webhooks:
//    URL:    https://<project>.functions.supabase.co/razorpayx-webhook
//    Events: payout.processed, payout.reversed, payout.failed, payout.updated
//  Deploy with --no-verify-jwt (RazorpayX sends no Supabase JWT).
// ════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const WEBHOOK_SECRET = Deno.env.get('RAZORPAYX_WEBHOOK_SECRET')!;

const enc = new TextEncoder();

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  if (!WEBHOOK_SECRET || !timingSafeEqual(await hmacHex(WEBHOOK_SECRET, raw), signature)) {
    return new Response('bad signature', { status: 401 });
  }

  const event = JSON.parse(raw);
  const payout = event?.payload?.payout?.entity;
  if (!payout?.id || !String(event.event ?? '').startsWith('payout.')) {
    return Response.json({ ignored: true });
  }

  // Replay guard (same table as affiliate postbacks; sha256 keeps ids uniform).
  const eventId = req.headers.get('x-razorpay-event-id') ?? `${payout.id}:${payout.status}`;
  const whId = await sha256Hex(`razorpayx:${eventId}`);
  const { error: dupErr } = await admin.from('processed_webhooks').insert({ id: whId, provider: 'razorpayx' });
  if (dupErr) {
    if (dupErr.code === '23505') return Response.json({ replay: true });
    return Response.json({ error: dupErr.message }, { status: 500 });
  }

  const { error } = await admin.rpc('apply_payout_webhook', {
    p_razorpay_payout_id: payout.id,
    p_reference_id: payout.reference_id ?? null,
    p_status: payout.status,
    p_utr: payout.utr ?? null,
    p_reason: payout.status_details?.description ?? payout.failure_reason ?? null,
  });
  if (error) {
    // Let RazorpayX retry: forget the event id so the retry is processed.
    await admin.from('processed_webhooks').delete().eq('id', whId);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
});
