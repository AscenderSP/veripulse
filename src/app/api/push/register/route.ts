// POST /api/push/register — client sends { token, platform }. We upsert
// into push_tokens tied to the signed-in user. RLS enforces user_id = self.

import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, createSupabaseAdminClient } from '@/lib/supabase/server';
import { sanitizeUserText } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { user } = await getRequestUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { token?: unknown; platform?: unknown };
  const token = sanitizeUserText(body.token, 500);
  const platform = sanitizeUserText(body.platform, 10);
  if (!token || !['ios', 'android', 'web'].includes(platform)) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  // Upsert so a reinstall updates last_seen_at without duplicating.
  const { error } = await admin
    .from('push_tokens')
    .upsert(
      { user_id: user.id, token, platform, last_seen_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    );
  if (error) return NextResponse.json({ error: 'INSERT_FAILED' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { user } = await getRequestUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { token?: unknown };
  const token = sanitizeUserText(body.token, 500);
  if (!token) return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  const admin = createSupabaseAdminClient();
  await admin.from('push_tokens').delete().match({ user_id: user.id, token });
  return NextResponse.json({ ok: true });
}
