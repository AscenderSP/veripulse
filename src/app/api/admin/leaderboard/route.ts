import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/leaderboard — top voters, top trust, top earners. */
export async function GET() {
  const g = await requireAdmin();
  if ('error' in g) return g.error;

  const base =
    'id, username, full_name, avatar_url, trust_score, correct_votes, total_votes, wallet_balance_inr, is_journalist_verified, tier';

  const [byTrust, byVotes, byEarnings, byBounties] = await Promise.all([
    g.admin.from('profiles').select(base).order('trust_score', { ascending: false }).limit(10),
    g.admin
      .from('profiles')
      .select(base)
      .order('correct_votes', { ascending: false })
      .limit(10),
    g.admin
      .from('profiles')
      .select(base)
      .order('wallet_balance_inr', { ascending: false })
      .limit(10),
    // Bounty wins — fall back to empty array if the table doesn't exist yet.
    g.admin
      .from('bounty_claims')
      .select('user_id, reward_inr, created_at, profiles!inner(username, full_name, avatar_url)')
      .gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString())
      .limit(50),
  ]);

  return NextResponse.json({
    byTrust: byTrust.data ?? [],
    byVotes: byVotes.data ?? [],
    byEarnings: byEarnings.data ?? [],
    recentBounties: byBounties.data ?? [],
  });
}
