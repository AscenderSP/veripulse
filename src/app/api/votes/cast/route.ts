import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase/server';
import type { VoteAction } from '@/lib/types';
import { verifyCaptchaToken } from '@/lib/captchaVerify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID: VoteAction[] = ['real', 'hoax', 'needs_context'];

/**
 * POST /api/votes/cast  Body: { story_id, vote }
 * All weighting + credibility math happens inside cast_weighted_vote; the
 * client cannot influence weight. Returns the new credibility and stage.
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getRequestUser();
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

    const body = await req.json();
    const storyId: string = body.story_id;
    const vote: VoteAction = body.vote;
    if (!storyId || !VALID.includes(vote)) {
      return NextResponse.json({ error: 'BAD_PARAMS' }, { status: 400 });
    }
    // Captcha gate — enforced only when CAPTCHA_SECRET is set. The browser
    // ships a token once per batch; absence is treated as a fresh batch
    // and still accepted when no secret is configured (demo mode).
    const captcha = verifyCaptchaToken(body.captcha_token);
    if (!captcha.ok && process.env.CAPTCHA_SECRET) {
      return NextResponse.json({ error: 'CAPTCHA_REQUIRED' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('cast_weighted_vote', {
      p_story_id: storyId,
      p_vote: vote,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      credibility: row?.new_credibility,
      stage: row?.new_stage,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return NextResponse.json({ error: 'SERVER_ERROR', detail: msg }, { status: 500 });
  }
}
