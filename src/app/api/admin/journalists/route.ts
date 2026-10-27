import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { ACCOUNT_TYPES } from '@/lib/accountTiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const guard = requireAdmin;

/**
 * GET /api/admin/journalists?status=pending|approved|rejected
 * Lists journalist-verification requests for the admin console.
 */
export async function GET(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;
  const status = (req.nextUrl.searchParams.get('status') ?? 'pending') as
    | 'pending'
    | 'approved'
    | 'rejected';
  const { data, error } = await g.admin
    .from('profiles')
    .select(
      'id, username, full_name, avatar_url, city, bio, press_credential_id, journalist_employer, journalist_verification_status, created_at, trust_score',
    )
    .eq('journalist_verification_status', status)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: 'QUERY_FAILED', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

/**
 * POST /api/admin/journalists
 * Body: { userId: string, decision: 'approve' | 'reject', note?: string }
 */
export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const decision = body.decision === 'approve' ? 'approve' : body.decision === 'reject' ? 'reject' : null;
  if (!userId || !decision) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const meta = ACCOUNT_TYPES.journalist;
  const patch =
    decision === 'approve'
      ? {
          journalist_verification_status: 'approved' as const,
          is_journalist_verified: true,
          is_press_pass_paid: true,
          subscription_tier: 'press' as const,
          account_type: 'journalist' as const,
          daily_post_limit: meta.dailyPostLimit,
          badge: 'Verified Journalist',
          press_pass_expiry: new Date(Date.now() + 365 * 86400_000).toISOString(),
        }
      : {
          journalist_verification_status: 'rejected' as const,
          is_journalist_verified: false,
          is_press_pass_paid: false,
          account_type: 'citizen_reporter' as const,
          daily_post_limit: ACCOUNT_TYPES.citizen_reporter.dailyPostLimit,
          badge: 'Citizen Reporter',
        };

  const { error } = await g.admin.from('profiles').update(patch).eq('id', userId);
  if (error) {
    return NextResponse.json({ error: 'UPDATE_FAILED', detail: error.message }, { status: 500 });
  }

  // Notify the user. Non-fatal if the notifications table rejects us.
  try {
    await g.admin.from('notifications').insert({
      user_id: userId,
      type: decision === 'approve' ? 'journalist_approved' : 'journalist_rejected',
      title:
        decision === 'approve'
          ? 'Press credentials approved'
          : 'Press credentials need more detail',
      body:
        decision === 'approve'
          ? 'Your Verified Journalist badge is live. Unlimited posts + UPI payouts unlocked.'
          : 'We couldn’t confirm your press credential. Reach out to support with a scan of your card.',
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true });
}
