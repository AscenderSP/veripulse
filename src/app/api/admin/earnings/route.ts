import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CPM_INR = 0.8; // ₹0.80 per 1000 impressions (indicative RPM)

/** GET /api/admin/earnings — platform revenue + payout totals + top earners. */
export async function GET() {
  const g = await requireAdmin();
  if ('error' in g) return g.error;

  const [impressions, payouts, wallets, topEarners, dailyRows] = await Promise.all([
    g.admin.from('stories').select('ad_impressions'),
    g.admin.from('payout_requests').select('amount_inr, status'),
    g.admin.from('profiles').select('wallet_balance_inr'),
    g.admin
      .from('profiles')
      .select('id, username, full_name, avatar_url, wallet_balance_inr, trust_score')
      .order('wallet_balance_inr', { ascending: false })
      .limit(10),
    g.admin
      .from('stories')
      .select('created_at, ad_impressions')
      .gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString()),
  ]);

  const totalImpressions = (impressions.data ?? []).reduce(
    (sum: number, s: { ad_impressions?: number }) => sum + (s.ad_impressions ?? 0),
    0,
  );
  const grossRevenueInr = +((totalImpressions / 1000) * CPM_INR).toFixed(2);

  const payoutRows = (payouts.data ?? []) as { amount_inr?: number; status?: string }[];
  const payoutsProcessedInr = payoutRows
    .filter((p) => p.status === 'processed')
    .reduce((s, p) => s + (p.amount_inr ?? 0), 0);
  const payoutsQueuedInr = payoutRows
    .filter((p) => p.status === 'queued' || p.status === 'processing')
    .reduce((s, p) => s + (p.amount_inr ?? 0), 0);

  const outstandingWalletsInr = (wallets.data ?? []).reduce(
    (sum: number, w: { wallet_balance_inr?: number }) => sum + (w.wallet_balance_inr ?? 0),
    0,
  );

  // Daily impressions for the last 7 days — simple bucketing.
  const buckets: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  for (const row of (dailyRows.data ?? []) as { created_at: string; ad_impressions?: number }[]) {
    const key = row.created_at.slice(0, 10);
    if (key in buckets) buckets[key] += row.ad_impressions ?? 0;
  }
  const daily = Object.entries(buckets).map(([date, imp]) => ({
    date,
    impressions: imp,
    inr: +((imp / 1000) * CPM_INR).toFixed(2),
  }));

  return NextResponse.json({
    cpmInr: CPM_INR,
    totalImpressions,
    grossRevenueInr,
    payoutsProcessedInr: +payoutsProcessedInr.toFixed(2),
    payoutsQueuedInr: +payoutsQueuedInr.toFixed(2),
    outstandingWalletsInr: +outstandingWalletsInr.toFixed(2),
    netMarginInr: +(grossRevenueInr - payoutsProcessedInr - outstandingWalletsInr).toFixed(2),
    topEarners: topEarners.data ?? [],
    daily,
  });
}
