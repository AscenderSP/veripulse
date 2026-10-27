import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { ACCOUNT_TYPES } from '@/lib/accountTiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users?q=...&filter=suspended|journalists|all
 * Returns profiles the admin can act on. 100 rows max; use ?q for search.
 */
export async function GET(req: NextRequest) {
  const g = await requireAdmin();
  if ('error' in g) return g.error;
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const filter = (req.nextUrl.searchParams.get('filter') ?? 'all') as
    | 'all'
    | 'suspended'
    | 'journalists'
    | 'admins';

  let query = g.admin
    .from('profiles')
    .select(
      'id, username, full_name, avatar_url, account_type, subscription_tier, tier, trust_score, is_admin, is_suspended, suspended_until, suspension_reason, wallet_balance_inr, is_journalist_verified, journalist_verification_status, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (filter === 'suspended') query = query.eq('is_suspended', true);
  else if (filter === 'journalists') query = query.eq('is_journalist_verified', true);
  else if (filter === 'admins') query = query.eq('is_admin', true);
  if (q) query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'QUERY_FAILED', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

/**
 * PATCH /api/admin/users
 * Body: { userId, action, reason?, days? }
 * action = suspend | unsuspend | grant_admin | revoke_admin | revoke_journalist | reset_trust
 */
export async function PATCH(req: NextRequest) {
  const g = await requireAdmin();
  if ('error' in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const action = body.action as string | undefined;
  if (!userId || !action) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  // Guard: an admin can't revoke their own admin flag, and can't suspend
  // themselves — avoids locking the ops team out by mistake.
  if (userId === g.adminUser.id && (action === 'revoke_admin' || action === 'suspend')) {
    return NextResponse.json({ error: 'SELF_LOCK_BLOCKED' }, { status: 400 });
  }

  let patch: Record<string, unknown> | null = null;
  let notification: { type: string; title: string; body: string } | null = null;

  if (action === 'suspend') {
    const days = Number(body.days) > 0 ? Number(body.days) : 7;
    patch = {
      is_suspended: true,
      suspended_until: new Date(Date.now() + days * 86400_000).toISOString(),
      suspension_reason:
        typeof body.reason === 'string' ? body.reason.slice(0, 500) : 'Policy violation',
    };
    notification = {
      type: 'suspension',
      title: `Your account has been suspended for ${days} day${days === 1 ? '' : 's'}`,
      body:
        (typeof body.reason === 'string' ? body.reason : 'Policy violation') +
        ' — You can appeal through support.',
    };
  } else if (action === 'unsuspend') {
    patch = { is_suspended: false, suspended_until: null, suspension_reason: null };
    notification = {
      type: 'suspension_lifted',
      title: 'Your suspension has been lifted',
      body: 'Welcome back. Please review the community guidelines before posting again.',
    };
  } else if (action === 'grant_admin') {
    patch = { is_admin: true };
  } else if (action === 'revoke_admin') {
    patch = { is_admin: false };
  } else if (action === 'revoke_journalist') {
    patch = {
      is_journalist_verified: false,
      is_press_pass_paid: false,
      journalist_verification_status: 'rejected',
      account_type: 'citizen_reporter',
      daily_post_limit: ACCOUNT_TYPES.citizen_reporter.dailyPostLimit,
      badge: 'Citizen Reporter',
    };
  } else if (action === 'reset_trust') {
    patch = { trust_score: 50 };
  } else {
    return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 });
  }

  const { error } = await g.admin.from('profiles').update(patch).eq('id', userId);
  if (error) {
    return NextResponse.json({ error: 'UPDATE_FAILED', detail: error.message }, { status: 500 });
  }

  if (notification) {
    try {
      await g.admin.from('notifications').insert({ user_id: userId, ...notification });
    } catch {
      /* non-fatal */
    }
  }
  return NextResponse.json({ ok: true });
}
