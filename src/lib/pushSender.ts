// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — server-side push dispatcher.
//
//  Sends via Firebase Cloud Messaging HTTP v1 (works for both Android and
//  iOS when the FCM project has an APNs auth key uploaded). The server-key
//  mode is simpler but FCM has deprecated it; we use a service-account
//  bearer token minted from a signed JWT at call-time.
//
//  Required env:
//    FCM_PROJECT_ID
//    FCM_CLIENT_EMAIL
//    FCM_PRIVATE_KEY         (newlines escaped as \n)
//
//  Pairs with /api/push/register (which populates push_tokens).
// ════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSign } from 'crypto';
import { reportError } from './errorTracker';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}
let tokenCache: AccessTokenCache | null = null;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) return tokenCache.token;

  const projectId = process.env.FCM_PROJECT_ID;
  const email = process.env.FCM_CLIENT_EMAIL;
  const key = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !email || !key) return null;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(key);
  const jwt = `${unsigned}.${b64url(sig)}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  if (!resp.ok) {
    reportError(new Error('fcm_oauth_failed'), { component: 'pushSender', action: 'oauth' });
    return null;
  }
  const { access_token, expires_in } = (await resp.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = { token: access_token, expiresAt: now + expires_in };
  return access_token;
}

/** Send `payload` to every registered device of `userId`. Returns delivered count. */
export async function sendPush(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const projectId = process.env.FCM_PROJECT_ID;
  const accessToken = await getAccessToken();
  if (!projectId || !accessToken) return 0;

  const { data } = await admin
    .from('push_tokens')
    .select('token, platform')
    .eq('user_id', userId);
  const tokens = (data as { token: string; platform: string }[] | null) ?? [];
  if (tokens.length === 0) return 0;

  let delivered = 0;
  await Promise.all(
    tokens.map(async (row) => {
      try {
        const resp = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: row.token,
                notification: { title: payload.title, body: payload.body },
                data: payload.data ?? {},
              },
            }),
          },
        );
        if (resp.ok) delivered++;
        else if (resp.status === 404 || resp.status === 400) {
          // Token invalid / unregistered — reap it.
          await admin.from('push_tokens').delete().eq('token', row.token);
        }
      } catch (err) {
        reportError(err, { component: 'pushSender', action: 'send', userId });
      }
    }),
  );
  return delivered;
}
