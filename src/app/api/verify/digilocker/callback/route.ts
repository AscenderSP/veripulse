// ════════════════════════════════════════════════════════════════════════
//  GET /api/verify/digilocker/callback?code=...&state=...
//
//  DigiLocker redirects back here with an authorization code. We:
//    1. Validate state against the digilocker_sessions row (replay safe).
//    2. Exchange the code for an access token at the DigiLocker token
//       endpoint.
//    3. Fetch the signed-in user's info and the Aadhaar e-KYC payload.
//    4. Mark the profile as is_id_verified + record provider on auth log.
//
//  On success, we redirect back to /?verified=1. On failure, /?verified=0.
// ════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { reportError, track } from '@/lib/errorTracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const origin = req.nextUrl.origin;

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/?verified=0&reason=missing_params`, 302);
  }

  const clientId = process.env.DIGILOCKER_CLIENT_ID;
  const clientSecret = process.env.DIGILOCKER_CLIENT_SECRET;
  const redirectUri = process.env.DIGILOCKER_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(`${origin}/?verified=0&reason=not_configured`, 302);
  }

  const admin = createSupabaseAdminClient();

  // 1. Atomically claim the state token. An UPDATE … WHERE consumed_at IS
  //    NULL … RETURNING is race-free: two concurrent callbacks cannot both
  //    see the row as un-consumed.
  const nowIso = new Date().toISOString();
  const { data: claimedRows } = await admin
    .from('digilocker_sessions')
    .update({ consumed_at: nowIso })
    .eq('state_token', state)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select('user_id, nonce, expires_at');
  const row = claimedRows?.[0] as
    | { user_id: string; nonce: string; expires_at: string }
    | undefined;
  if (!row) {
    return NextResponse.redirect(`${origin}/?verified=0&reason=bad_state`, 302);
  }

  // 2. Exchange code for access token.
  try {
    const tokenResp = await fetch('https://api.digitallocker.gov.in/public/oauth2/1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: row.nonce,
      }).toString(),
    });
    if (!tokenResp.ok) {
      const detail = await tokenResp.text().catch(() => '');
      reportError(new Error('digilocker token exchange failed'), {
        component: 'digilocker',
        action: 'token',
        extra: { detail },
      });
      return NextResponse.redirect(`${origin}/?verified=0&reason=token`, 302);
    }
    const tok = (await tokenResp.json()) as { access_token?: string };
    if (!tok.access_token) {
      return NextResponse.redirect(`${origin}/?verified=0&reason=no_token`, 302);
    }

    // 3. Fetch signed-in user's info (name + DOB + reference id).
    const userResp = await fetch(
      'https://api.digitallocker.gov.in/public/oauth2/1/user',
      { headers: { Authorization: `Bearer ${tok.access_token}` } },
    );
    if (!userResp.ok) {
      return NextResponse.redirect(`${origin}/?verified=0&reason=user_fetch`, 302);
    }
    const info = (await userResp.json()) as {
      user_id?: string;
      full_name?: string;
      dob?: string;
    };

    // 4. Mark profile verified. We also stamp auth_provider so the admin
    // dashboard can tell DigiLocker-verified users apart from manual ones.
    await admin
      .from('profiles')
      .update({
        is_id_verified: true,
        full_name: info.full_name ?? undefined,
        auth_provider: 'digilocker',
      })
      .eq('id', row.user_id);
    track('auth_signin', { user_id: row.user_id, provider: 'digilocker' });
  } catch (err) {
    reportError(err, { component: 'digilocker', action: 'callback' });
    return NextResponse.redirect(`${origin}/?verified=0&reason=exception`, 302);
  }

  return NextResponse.redirect(`${origin}/?verified=1`, 302);
}
