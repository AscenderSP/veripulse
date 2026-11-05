/**
 * Per-profile activity log, persisted in localStorage so a Citizen
 * Profile can show its owner's recent posts / votes / follows / reviews
 * across sessions and page reloads.
 *
 * Shape (persisted):
 *   veripulse_demo_activity_v1 = Record<profileId, ActivityEvent[]>  // newest first, capped
 *
 * Reads and writes are try/catch guarded — a disabled or full
 * localStorage never crashes the call site, it just degrades to "no
 * history" rather than silently losing the action itself.
 */

const KEY = 'veripulse_demo_activity_v1';
const PER_PROFILE_CAP = 100;

export type ActivityType = 'post' | 'vote' | 'review' | 'follow' | 'unfollow';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  /** ISO timestamp. */
  at: string;
  /** What the action was against (story id, article id, user id, product id). */
  targetId: string | null;
  /** Short human-readable title of the target (story headline, article title, user name). */
  targetLabel: string | null;
  /** Free-form per-type payload: vote ('real' | 'hoax' | 'needs_context'), score, etc. */
  meta?: Record<string, string | number | boolean | null>;
}

type ActivityMap = Record<string, ActivityEvent[]>;

function readMap(): ActivityMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ActivityMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: ActivityMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
    return;
  } catch {
    /* quota — drop older entries across all profiles and retry */
  }
  const trimmed: ActivityMap = {};
  for (const [pid, list] of Object.entries(map)) {
    trimmed[pid] = list.slice(0, Math.max(10, Math.floor(PER_PROFILE_CAP / 4)));
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* give up silently — the action itself already happened */
  }
}

/** Append one event for this profile. Returns the stored event. */
export function recordActivity(args: {
  profileId: string | null | undefined;
  type: ActivityType;
  targetId?: string | null;
  targetLabel?: string | null;
  meta?: ActivityEvent['meta'];
}): ActivityEvent | null {
  const pid = args.profileId;
  if (!pid) return null;
  const event: ActivityEvent = {
    id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: args.type,
    at: new Date().toISOString(),
    targetId: args.targetId ?? null,
    targetLabel: args.targetLabel ?? null,
    meta: args.meta,
  };
  const map = readMap();
  const list = map[pid] ?? [];
  list.unshift(event);
  map[pid] = list.slice(0, PER_PROFILE_CAP);
  writeMap(map);
  return event;
}

/** All events for one profile, newest-first. */
export function getActivity(profileId: string | null | undefined): ActivityEvent[] {
  if (!profileId) return [];
  return readMap()[profileId] ?? [];
}

/** Count events by type for one profile — handy for profile header stats. */
export function getActivityCounts(profileId: string | null | undefined): Record<ActivityType, number> {
  const base: Record<ActivityType, number> = {
    post: 0, vote: 0, review: 0, follow: 0, unfollow: 0,
  };
  for (const e of getActivity(profileId)) {
    base[e.type] = (base[e.type] ?? 0) + 1;
  }
  return base;
}

/** Clear one profile's history — used by the settings "Reset activity" row. */
export function clearActivity(profileId: string | null | undefined): void {
  if (!profileId) return;
  const map = readMap();
  if (!(profileId in map)) return;
  delete map[profileId];
  writeMap(map);
}
