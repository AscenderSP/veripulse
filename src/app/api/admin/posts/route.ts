import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/posts?status=live|taken_down&q=...
 * Lists recent stories for moderation. "taken_down" filters to admin
 * takedowns + quarantined; "live" is everything else.
 */
export async function GET(req: NextRequest) {
  const g = await requireAdmin();
  if ('error' in g) return g.error;
  const status = (req.nextUrl.searchParams.get('status') ?? 'live') as 'live' | 'taken_down';
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();

  let query = g.admin
    .from('stories')
    .select(
      'id, author_id, category, location_name, titles, media_url, rollout_stage, credibility_score, ai_probability_score, ad_impressions, admin_taken_down, takedown_reason, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (status === 'taken_down') {
    query = query.or('admin_taken_down.eq.true,rollout_stage.eq.quarantined');
  } else {
    query = query.neq('rollout_stage', 'quarantined').is('admin_taken_down', false);
  }
  if (q) query = query.ilike('titles->>en', `%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'QUERY_FAILED', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

/**
 * PATCH /api/admin/posts
 * Body: { storyId, action: 'takedown' | 'restore', reason?: string }
 */
export async function PATCH(req: NextRequest) {
  const g = await requireAdmin();
  if ('error' in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const storyId = typeof body.storyId === 'string' ? body.storyId : '';
  const action = body.action === 'takedown' ? 'takedown' : body.action === 'restore' ? 'restore' : null;
  if (!storyId || !action) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const patch =
    action === 'takedown'
      ? {
          admin_taken_down: true,
          rollout_stage: 'quarantined' as const,
          takedown_reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : 'Admin takedown',
          taken_down_at: new Date().toISOString(),
          taken_down_by: g.adminUser.id,
        }
      : {
          admin_taken_down: false,
          rollout_stage: 'public' as const,
          takedown_reason: null,
          taken_down_at: null,
          taken_down_by: null,
        };

  const { error } = await g.admin.from('stories').update(patch).eq('id', storyId);
  if (error) {
    return NextResponse.json({ error: 'UPDATE_FAILED', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
