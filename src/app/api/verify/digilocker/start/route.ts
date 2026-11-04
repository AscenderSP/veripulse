// ════════════════════════════════════════════════════════════════════════
//  GET /api/verify/digilocker/start
//
//  Begins the DigiLocker OAuth2 flow. Server generates a cryptographic
//  state token, persists it against the signed-in user, and redirects to
//  DigiLocker's authorize endpoint. The callback route validates the
//  returned state against this row before trusting the identity.
// ════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
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
  // PKCE S256: verifier is the secret we persist; challenge is its SHA-256.
  // An intercepted authorize URL leaks only the challenge, not the verifier,
  // so the auth code cannot be exchanged by an attacker.
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const admin = createSupabaseAdminClient();
  await admin.from('digilocker_sessions').insert({
    state_token: state,
    user_id: user.id,
    nonce: verifier,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });

  const authUrl = new URL('https://api.digitallocker.gov.in/public/oauth2/1/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(authUrl.toString(), 302);
}
