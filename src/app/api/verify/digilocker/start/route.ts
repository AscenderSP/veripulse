// ════════════════════════════════════════════════════════════════════════
//  GET /api/verify/digilocker/start
//
//  Begins the DigiLocker OAuth2 flow. Server generates a cryptographic
//  state token, persists it against the signed-in user, and redirects to
//  DigiLocker's authorize endpoint. The callback route validates the
//  returned state against this row before trusting the identity.
// ════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { user } = await getRequestUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const clientId = process.env.DIGILOCKER_CLIENT_ID;
  const redirectUri = process.env.DIGILOCKER_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'DIGILOCKER_NOT_CONFIGURED' }, { status: 503 });
  }

  const state = randomBytes(24).toString('hex');
  const nonce = randomBytes(16).toString('hex');
  const admin = createSupabaseAdminClient();
  await admin.from('digilocker_sessions').insert({
    state_token: state,
    user_id: user.id,
    nonce,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });

  const authUrl = new URL('https://api.digitallocker.gov.in/public/oauth2/1/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', nonce);
  authUrl.searchParams.set('code_challenge_method', 'plain');

  return NextResponse.redirect(authUrl.toString(), 302);
}
