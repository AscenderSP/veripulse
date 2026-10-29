// GET /api/cinema/reviews?movie_id=... — public list of reviews for a
// movie, newest first. Spoilers come back with their body nulled so the
// UI can render a "tap to reveal" affordance.

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const movie_id = req.nextUrl.searchParams.get('movie_id');
  if (!movie_id) return NextResponse.json({ error: 'MISSING_MOVIE' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('movie_reviews')
    .select('id, user_id, overall_score, reality_gap, verdict, spoiler, window_tier, distance_meters, created_at')
    .eq('movie_id', movie_id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((r: Record<string, unknown>) =>
    r.spoiler
      ? { ...r, verdict: null, spoiler: true }
      : { ...r, spoiler: false },
  );
  return NextResponse.json({ items });
}
