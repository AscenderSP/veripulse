// ════════════════════════════════════════════════════════════════════════
//  POST /api/cinema/reviews/submit
//
//  Delegates the three-pillar gate to the SQL RPC `submit_cinema_review`,
//  which checks:
//    · ticket ownership + not-yet-consumed
//    · temporal window (unlock_at < now < unlock_at + 4h)
//    · 500 m geo-fence against the cinema coord
//  then inserts movie_reviews, consumes the ticket, and credits VPcoins
//  into master_transactions. All in one transaction.
// ════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase/server';
import { verifyCaptchaToken } from '@/lib/captchaVerify';
import { sanitizeUserText } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATING_KEYS = ['pacing', 'theater', 'acting', 'rewatch', 'reality_gap'] as const;
type RatingKey = typeof RATING_KEYS[number];

interface Body {
  ticket_id?: unknown;
  ratings?: Partial<Record<RatingKey, unknown>>;
  verdict?: unknown;
  spoiler?: unknown;
  selfie_url?: unknown;
  lat?: unknown;
  lng?: unknown;
  captcha_token?: unknown;
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getRequestUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;

  const captcha = verifyCaptchaToken(body.captcha_token);
  if (!captcha.ok && process.env.CAPTCHA_SECRET) {
    return NextResponse.json({ error: 'CAPTCHA_REQUIRED' }, { status: 400 });
  }

  const ticketId = sanitizeUserText(body.ticket_id, 40);
  const verdict  = sanitizeUserText(body.verdict, 220);
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!ticketId || !verdict || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'BAD_PARAMS' }, { status: 400 });
  }

  // Clamp each rating to 1-10; missing → 0 (SQL averages anyway).
  const ratings: Record<RatingKey, number> = {
    pacing: 0, theater: 0, acting: 0, rewatch: 0, reality_gap: 0,
  };
  for (const k of RATING_KEYS) {
    const v = Number(body.ratings?.[k]);
    ratings[k] = Number.isFinite(v) ? Math.max(1, Math.min(10, Math.round(v))) : 0;
  }

  const spoiler = Boolean(body.spoiler);
  const selfieUrl = sanitizeUserText(body.selfie_url, 500) || null;

  const { data, error } = await supabase.rpc('submit_cinema_review', {
    p_ticket_id: ticketId,
    p_ratings: ratings,
    p_verdict: verdict,
    p_spoiler: spoiler,
    p_selfie_url: selfieUrl,
    p_user_lat: lat,
    p_user_lng: lng,
  });

  if (error) {
    const map: Record<string, number> = {
      TICKET_NOT_FOUND: 404,
      TICKET_ALREADY_USED: 409,
      TOO_EARLY: 423,
      WINDOW_CLOSED: 410,
      OUT_OF_FENCE: 403,
      AUTH_REQUIRED: 401,
    };
    const code = (error.message || '').trim();
    const status = map[code] ?? 500;
    return NextResponse.json({ error: code || 'FAILED' }, { status });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    review_id: row?.review_id ?? null,
    reward_vp: row?.reward_vp ?? 0,
    window_tier: row?.window_tier ?? 'standard',
  });
}
