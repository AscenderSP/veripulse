'use client';

import { isNative } from './nativeHardware';
import { isSupabaseConfigured } from './demoData';
import { getSupabaseBrowserClient } from './supabase/client';

/**
 * On the web the API lives at a relative path on the same origin. Inside the
 * native shell (Capacitor) there is no local server, so calls are sent to the
 * deployed web origin configured at build time.
 */
export function apiUrl(path: string): string {
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN;
  if (isNative() && origin && !origin.includes('example')) {
    return `${origin.replace(/\/$/, '')}${path}`;
  }
  return path;
}

/**
 * fetch() against our API. Always attaches the Supabase access token as a
 * Bearer header — cookies don't cross origins from the native shell.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (isSupabaseConfigured()) {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(apiUrl(path), { credentials: 'include', ...init, headers });
}
