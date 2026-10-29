// GET /api/cinema/movies — list currently reviewable movies with the
// crowd reality score aggregated by the submit RPC. Public read; works
// in demo mode by falling back to the seed set the client already has.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('movies')
    .select(
      'id, title, language, duration_minutes, release_date, poster_url, critic_hype_score, reality_gap_sum, reality_gap_count',
    )
    .order('release_date', { ascending: false })
    .limit(60);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((m: Record<string, unknown>) => {
    const count = Number(m.reality_gap_count ?? 0);
    const sum = Number(m.reality_gap_sum ?? 0);
    return {
      ...m,
      crowd_reality_score: count > 0 ? Number((sum / count).toFixed(2)) : null,
    };
  });
  return NextResponse.json({ items });
}
