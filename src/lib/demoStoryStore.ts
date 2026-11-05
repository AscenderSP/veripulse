/**
 * Shared, localStorage-backed story store for dummy / preset-dummy
 * accounts' posts. A real Supabase-authenticated submit still goes to
 * /api/stories/submit; this store is for sessions that have no JWT
 * (full demo mode or a signInPreset dummy) and exists so end-to-end
 * testing of "file a citizen report" produces a visible, persistent
 * story card like the live path does.
 *
 * Shape (persisted):
 *   veripulse_demo_stories_v1 = Story[]  // newest first
 *
 * Reads and writes are try/catch guarded — a disabled or full
 * localStorage never crashes the submit flow, it just degrades to
 * "the post is gone after reload."
 */

import type { Story } from './types.ts';

const KEY = 'veripulse_demo_stories_v1';

function readList(): Story[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Story[]) : [];
  } catch {
    return [];
  }
}

function writeList(list: Story[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    return;
  } catch {
    /* fall through to recovery */
  }
  // Quota: try again progressively cheaper. Drop media_url on the oldest
  // entries first (they're background noise), then drop entries wholesale
  // until the newest post lands. Last post the user filed is NOT negotiable.
  const stripped = list.map((s, i) => (i === 0 ? s : { ...s, media_url: null }));
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stripped));
    return;
  } catch { /* still over */ }
  for (let keep = Math.min(stripped.length, 5); keep >= 1; keep--) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(stripped.slice(0, keep)));
      return;
    } catch { /* keep shrinking */ }
  }
  // Nothing fits — strip the newest post's media too and save just its text.
  try {
    window.localStorage.setItem(KEY, JSON.stringify([{ ...list[0], media_url: null }]));
  } catch {
    /* localStorage genuinely unusable; the post is lost — same behavior
       as before this recovery path existed. */
  }
}

/** Every dummy-posted story in the browser, newest first. */
export function getDemoStories(): Story[] {
  return readList();
}

/**
 * Append a fresh dummy-posted story to the front of the list. Returns
 * the full row that was persisted so the caller can patch state with it
 * before the next Feed reload picks it up from storage.
 */
export function addDemoStory(input: {
  authorId: string;
  text: string;
  locationName: string;
  lat: number | null;
  lng: number | null;
  mediaUrl: string | null;
}): Story {
  const now = new Date().toISOString();
  const words = input.text.trim().split(/\s+/).filter(Boolean);
  const title = words.slice(0, 10).join(' ') || 'Citizen report';
  const summary = input.text.trim().slice(0, 300);
  const story: Story = {
    id: `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    author_id: input.authorId,
    category: 'Civic',
    location_name: input.locationName || 'Unknown',
    lat: input.lat,
    lng: input.lng,
    titles: { en: title, bn: title, hi: title },
    summaries: { en: summary, bn: summary, hi: summary },
    media_url: input.mediaUrl,
    media_type: 'image',
    c2pa_verified: !!input.mediaUrl,
    ai_probability_score: 5,
    credibility_score: 55,
    rollout_stage: 'tier_1',
    completeness_score: Math.min(
      100,
      Math.round((words.length / 45) * 70) + (input.mediaUrl ? 15 : 0) + (input.lat ? 10 : 0),
    ),
    ad_impressions: 0,
    source: 'citizen',
    created_at: now,
    updated_at: now,
  };
  const list = readList();
  list.unshift(story);
  writeList(list);
  return story;
}
