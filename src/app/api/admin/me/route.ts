import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabase/server';
import { checkAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/me — admin check + overview stats for the dashboard. */
export async function GET() {
  const { supabase, user } = await getRequestUser();
  if (!user) return NextResponse.json({ isAdmin: false }, { status: 401 });
  const result = await checkAdmin(supabase, user);
  if (!result.isAdmin) return NextResponse.json({ isAdmin: false }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [
    { count: pendingJournalists },
    { count: totalProfiles },
    { count: stories24h },
    { count: suspendedUsers },
    { count: takenDown },
    { count: quarantined },
    { count: activeAdmins },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('journalist_verification_status', 'pending'),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('stories').select('id', { count: 'exact', head: true }).gte('created_at', since24),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', true),
    admin.from('stories').select('id', { count: 'exact', head: true }).eq('admin_taken_down', true),
    admin
      .from('stories')
      .select('id', { count: 'exact', head: true })
      .eq('rollout_stage', 'quarantined'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true),
  ]);

  return NextResponse.json({
    isAdmin: true,
    reason: result.reason,
    stats: {
      pendingJournalists: pendingJournalists ?? 0,
      totalProfiles: totalProfiles ?? 0,
      stories24h: stories24h ?? 0,
      suspendedUsers: suspendedUsers ?? 0,
      takenDown: takenDown ?? 0,
      quarantined: quarantined ?? 0,
      activeAdmins: activeAdmins ?? 0,
    },
  });
}
