// ════════════════════════════════════════════════════════════════════════
//  POST /api/cinema/tickets/verify
//
//  Pillar 1 of Cinema Sentinel. The client has already parsed its own
//  copy of the ticket (QR decode, OCR via Gemini, or a manual form). We
//  take the five canonical fields, recompute the SHA-256 claim hash
//  server-side so the client can't lie about it, and insert into
//  movie_tickets. The UNIQUE constraint on ticket_claim_hash enforces
//  "one seat on one show == one review" regardless of who tries.
// ════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getRequestUser, createSupabaseAdminClient } from '@/lib/supabase/server';
import { verifyCaptchaToken } from '@/lib/captchaVerify';
import { sanitizeUserText } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  movie_id?: unknown;
  cinema_id?: unknown;
  show_time?: unknown;
  seat_no?: unknown;
  booking_id?: unknown;
  source?: unknown;
  captcha_token?: unknown;
}

function serverClaimHash(parts: {
  movie_id: string;
  cinema_id: string;
  show_time: string;
  seat_no: string;
  booking_id: string;
}): string {
  const canonical = [
    parts.movie_id.trim().toLowerCase(),
    parts.cinema_id.trim().toLowerCase(),
    new Date(parts.show_time).toISOString(),
    parts.seat_no.trim().toUpperCase().replace(/\s+/g, ''),
    parts.booking_id.trim().toUpperCase(),
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

export async function POST(req: NextRequest) {
  const { user } = await getRequestUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;

  const captcha = verifyCaptchaToken(body.captcha_token);
  if (!captcha.ok && process.env.CAPTCHA_SECRET) {
    return NextResponse.json({ error: 'CAPTCHA_REQUIRED' }, { status: 400 });
  }

  const movie_id    = sanitizeUserText(body.movie_id, 80);
  const cinema_id   = sanitizeUserText(body.cinema_id, 80);
  const show_time   = sanitizeUserText(body.show_time, 40);
  const seat_no     = sanitizeUserText(body.seat_no, 20);
  const booking_id  = sanitizeUserText(body.booking_id, 32);
  const source =
    body.source === 'qr_bookmyshow' || body.source === 'ocr_photo' || body.source === 'manual'
      ? (body.source as 'qr_bookmyshow' | 'ocr_photo' | 'manual')
      : 'manual';

  if (!movie_id || !cinema_id || !show_time || !seat_no || !booking_id) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }
  const showAt = new Date(show_time);
  if (Number.isNaN(showAt.getTime())) {
    return NextResponse.json({ error: 'BAD_SHOW_TIME' }, { status: 400 });
  }

  const hash = serverClaimHash({ movie_id, cinema_id, show_time, seat_no, booking_id });

  const admin = createSupabaseAdminClient();

  // Movie + cinema must exist.
  const [{ data: movie }, { data: cinema }] = await Promise.all([
    admin.from('movies').select('id, duration_minutes, interval_minutes').eq('id', movie_id).single(),
    admin.from('cinemas').select('id, lat, lng').eq('id', cinema_id).single(),
  ]);
  if (!movie)  return NextResponse.json({ error: 'UNKNOWN_MOVIE'  }, { status: 404 });
  if (!cinema) return NextResponse.json({ error: 'UNKNOWN_CINEMA' }, { status: 404 });

  const { data: inserted, error } = await admin
    .from('movie_tickets')
    .insert({
      user_id: user.id,
      movie_id,
      cinema_id,
      show_time: showAt.toISOString(),
      seat_no,
      booking_id,
      ticket_claim_hash: hash,
      source,
    })
    .select('id')
    .single();
  if (error) {
    // 23505 = unique violation (someone already claimed this seat).
    const code = (error as unknown as { code?: string }).code;
    if (code === '23505') {
      return NextResponse.json({ error: 'TICKET_ALREADY_CLAIMED' }, { status: 409 });
    }
    return NextResponse.json({ error: 'INSERT_FAILED', detail: error.message }, { status: 500 });
  }

  // Compute the review-unlock timestamp so the client can show a countdown.
  const movieRow = movie as { duration_minutes: number; interval_minutes: number };
  const unlockAt = new Date(
    showAt.getTime() + (movieRow.duration_minutes + movieRow.interval_minutes) * 60_000,
  );

  return NextResponse.json({
    ticket_id: (inserted as { id: string }).id,
    unlock_at: unlockAt.toISOString(),
    cinema: cinema as { id: string; lat: number; lng: number },
  });
}
