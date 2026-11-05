/**
 * Shared, localStorage-backed vote store for demo / preset-dummy accounts.
 *
 * Real Supabase-authenticated sessions still go through cast_weighted_vote
 * and propagate via stories UPDATE Realtime. This store is strictly for
 * sessions that have no JWT (full demo mode or a signInPreset dummy) and
 * exists so end-to-end testing with multiple dummy profiles in the same
 * browser behaves like the live path:
 *
 *   • Each profile can cast one vote per story — locked, final.
 *   • Credibility shifts accumulate ACROSS all dummy profiles in the
 *     browser, so dummy B seeing a story dummy A down-voted sees the
 *     shifted credibility, not the baseline.
 *   • State survives a page refresh.
 *
 * Shape (persisted):
 *   veripulse_demo_votes_v1      = { [storyId]: { [profileId]: vote } }
 *   veripulse_demo_credibility_v1 = { [storyId]: { credibility, stage } }
 *
 * Both reads and writes are try/catch guarded — a disabled or full
 * localStorage never crashes the vote flow, it just behaves like the old
 * in-memory path for that session.
 */

import { nextCredibility, nextStage, type ConsensusVote, type ConsensusStage } from './consensus';

const VOTES_KEY = 'veripulse_demo_votes_v1';
const CRED_KEY = 'veripulse_demo_credibility_v1';

type VotesMap = Record<string, Record<string, ConsensusVote>>;
type CredMap = Record<string, { credibility: number; stage: ConsensusStage }>;

function readMap<T extends object>(key: string): T {
  if (typeof window === 'undefined') return {} as T;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {} as T;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' ? parsed : {}) as T;
  } catch {
    return {} as T;
  }
}

function writeMap(key: string, value: object): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage disabled or over quota — best-effort only.
  }
}

/** The vote this profile cast on this story, or null. */
export function getVote(storyId: string, profileId: string): ConsensusVote | null {
  const m = readMap<VotesMap>(VOTES_KEY);
  return m[storyId]?.[profileId] ?? null;
}

/** All votes this profile has cast, keyed by storyId. Used to rehydrate
 *  the per-profile lock map on mount. */
export function getProfileVotes(profileId: string): Record<string, ConsensusVote> {
  const m = readMap<VotesMap>(VOTES_KEY);
  const out: Record<string, ConsensusVote> = {};
  for (const [storyId, votes] of Object.entries(m)) {
    const v = votes?.[profileId];
    if (v) out[storyId] = v;
  }
  return out;
}

/** Accumulated credibility for this story across every dummy profile in
 *  the browser, or null when no dummy has voted on it yet. */
export function getCredibility(
  storyId: string,
): { credibility: number; stage: ConsensusStage } | null {
  const m = readMap<CredMap>(CRED_KEY);
  return m[storyId] ?? null;
}

/** Count of distinct profiles that have already voted on this story —
 *  feeds the early-voter multiplier the same way prior_vote_count feeds
 *  cast_weighted_vote. */
export function priorDemoVoteCount(storyId: string): number {
  const m = readMap<VotesMap>(VOTES_KEY);
  return Object.keys(m[storyId] ?? {}).length;
}

/**
 * Record a dummy vote. Returns the new credibility/stage, or the existing
 * stored values if this profile has already voted on this story (the
 * one-vote-per-profile lock). Weight is caller-supplied — compute it with
 * voteWeight() using priorDemoVoteCount for parity with the live path.
 *
 * `baseCredibility` / `baseStage` are the fallback ground-truth from the
 * story row, used when the store has no override yet (first ever vote).
 */
export function recordVote(args: {
  storyId: string;
  profileId: string;
  vote: ConsensusVote;
  weight: number;
  baseCredibility: number;
  baseStage: ConsensusStage;
}): { credibility: number; stage: ConsensusStage; locked: boolean } {
  const { storyId, profileId, vote, weight, baseCredibility, baseStage } = args;

  const votes = readMap<VotesMap>(VOTES_KEY);
  const existing = votes[storyId]?.[profileId];
  if (existing) {
    const cur = getCredibility(storyId);
    return {
      credibility: cur?.credibility ?? baseCredibility,
      stage: cur?.stage ?? baseStage,
      locked: true,
    };
  }

  const creds = readMap<CredMap>(CRED_KEY);
  const current = creds[storyId] ?? { credibility: baseCredibility, stage: baseStage };
  const newCred = nextCredibility(current.credibility, vote, weight);
  const newStage = nextStage(current.stage, newCred);

  votes[storyId] = { ...(votes[storyId] ?? {}), [profileId]: vote };
  creds[storyId] = { credibility: newCred, stage: newStage };
  writeMap(VOTES_KEY, votes);
  writeMap(CRED_KEY, creds);

  return { credibility: newCred, stage: newStage, locked: false };
}

/** Overlay the stored credibility onto a list of story-ish rows. Any row
 *  without an override is returned unchanged. The `pick` and `patch`
 *  callbacks let the same helper serve both News Hub (camelCase) and
 *  Live Circle (snake_case) without a second implementation. */
export function overlayCredibility<T>(
  rows: T[],
  pick: (row: T) => { id: string; credibility: number; stage: ConsensusStage },
  patch: (row: T, credibility: number, stage: ConsensusStage) => T,
): T[] {
  const m = readMap<CredMap>(CRED_KEY);
  if (Object.keys(m).length === 0) return rows;
  return rows.map((row) => {
    const { id } = pick(row);
    const override = m[id];
    if (!override) return row;
    return patch(row, override.credibility, override.stage);
  });
}
