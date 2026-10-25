import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Request-scoped client that acts AS the signed-in user (RLS applies).
 *
 * Web requests carry the session in cookies. The native shell calls the API
 * cross-origin, where cookies don't travel, so it sends
 * `Authorization: Bearer <access_token>` instead — honoured first.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const bearer = (await headers()).get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore; middleware
          // refreshes the session cookie.
        }
      },
    },
  });
}

/** The user client plus the verified user (null when signed out). */
export async function getRequestUser(): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const supabase = await createSupabaseServerClient();
  const bearer = (await headers()).get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const {
    data: { user },
  } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Service-role client that BYPASSES RLS. Use ONLY in trusted server code
 * (route handlers / edge functions) for operations the user is not allowed
 * to perform directly: story ingestion, affiliate settlement, payout
 * draining, audit-ledger writes. Never import this into client code.
 */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
