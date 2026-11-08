// Persistent snapshot of the last live news/feed payload so a page refresh
// paints the latest known articles instead of flashing the baked-in demo
// list while the Supabase fetch is still in flight.
//
// Snapshots expire after NEWS_EXPIRY_MS so a cold open after a long gap
// never shows stale content — the UI just takes the normal hydrate path.

import { NEWS_EXPIRY_MS } from './journalism';

const KEY_PREFIX = 'veripulse_live_cache_v1:';

type Envelope<T> = { at: number; items: T[] };

export function readSnapshot<T>(key: string): T[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || !Array.isArray(env.items)) return null;
    if (Date.now() - env.at > NEWS_EXPIRY_MS) return null;
    return env.items;
  } catch {
    return null;
  }
}

export function writeSnapshot<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    const env: Envelope<T> = { at: Date.now(), items };
    window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(env));
  } catch {
    // quota exceeded or private-mode — drop the snapshot silently; the
    // live fetch will still hydrate the UI on next paint.
  }
}
