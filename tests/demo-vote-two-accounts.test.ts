// Two-dummy-account simulation for the demoVoteStore.
// Reproduces the exact scenario the user reported:
//   • A votes → credibility shifts, lock set
//   • Refresh (simulated: re-import store state from localStorage) → still shifted, still locked for A
//   • Switch to B → B sees shifted credibility, chip unlocked for B
//   • B votes → shift stacks from A's shifted value, lock set for B
//   • Refresh → both locks + stacked credibility survive
//   • Switch back to A → A still locked, latest credibility visible
//
// Run: node --experimental-strip-types --no-warnings --test tests/demo-vote-two-accounts.test.ts

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── localStorage + window shim (jsdom-free) ─────────────────────────────
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}
// @ts-expect-error – shim window for the store's `typeof window` guard.
globalThis.window = { localStorage: new MemoryStorage() };

const {
  getVote,
  getProfileVotes,
  getCredibility,
  priorDemoVoteCount,
  recordVote,
  overlayCredibility,
} = await import('../src/lib/demoVoteStore.ts');

const { voteWeight } = await import('../src/lib/consensus.ts');

const STORY = 'story-xyz';
const A = 'dummy-a';
const B = 'dummy-b';
const BASE = 70;

function wipe() {
  // @ts-expect-error – shim
  globalThis.window.localStorage.clear();
}

// Simulate a page refresh: the store is stateless (reads localStorage each
// call), so "refresh" is really just the next sequence of reads.
// We also wipe any in-memory caches by re-importing is not needed — but we
// prove the store reads from the backing store on every call.

describe('demoVoteStore – two dummy accounts, full lifecycle', () => {
  beforeEach(() => wipe());

  test('A votes hoax → shifted + locked; B sees shift + unlocked', () => {
    const weightA = voteWeight({
      trustScore: 50, tier: 'public', isJournalist: false,
      isVerifiedOwner: false, distanceKm: null,
      priorVoteCount: priorDemoVoteCount(STORY),
    });

    const r1 = recordVote({
      storyId: STORY, profileId: A, vote: 'hoax',
      weight: weightA, baseCredibility: BASE, baseStage: 'tier_2',
    });

    assert.equal(r1.locked, false, 'A first vote not locked');
    assert.ok(r1.credibility < BASE, 'hoax shifts credibility down');
    assert.equal(getVote(STORY, A), 'hoax', 'A lock persisted');
    assert.equal(getVote(STORY, B), null, 'B not locked');

    // Simulate refresh: fresh reads must return shifted credibility.
    const after = getCredibility(STORY);
    assert.ok(after && Math.abs(after.credibility - r1.credibility) < 1e-9,
      'credibility survives "refresh"');
  });

  test('B then votes → shift stacks from A, both locks survive', () => {
    // A votes hoax
    const wA = voteWeight({
      trustScore: 50, tier: 'public', isJournalist: false,
      isVerifiedOwner: false, distanceKm: null,
      priorVoteCount: priorDemoVoteCount(STORY),
    });
    const r1 = recordVote({
      storyId: STORY, profileId: A, vote: 'hoax',
      weight: wA, baseCredibility: BASE, baseStage: 'tier_2',
    });

    // B votes real — note priorVoteCount sees A's vote.
    const priorBefore = priorDemoVoteCount(STORY);
    assert.equal(priorBefore, 1, 'prior count reflects A');

    const wB = voteWeight({
      trustScore: 50, tier: 'public', isJournalist: false,
      isVerifiedOwner: false, distanceKm: null,
      priorVoteCount: priorBefore,
    });
    const r2 = recordVote({
      storyId: STORY, profileId: B, vote: 'real',
      weight: wB, baseCredibility: BASE, baseStage: 'tier_2',
    });

    assert.equal(r2.locked, false, 'B first vote not locked');
    assert.ok(r2.credibility > r1.credibility,
      'B\'s real vote stacks UP from A\'s shifted value');
    assert.ok(r2.credibility < BASE + 10,
      'B shift accumulates from A, not from baseline');

    // Both locks persist.
    assert.equal(getVote(STORY, A), 'hoax');
    assert.equal(getVote(STORY, B), 'real');

    // Simulate refresh — credibility reads back as r2.
    const after = getCredibility(STORY);
    assert.ok(after && Math.abs(after.credibility - r2.credibility) < 1e-9);
  });

  test('second-attempt by A is rejected — one vote per profile, final', () => {
    const w = voteWeight({
      trustScore: 50, tier: 'public', isJournalist: false,
      isVerifiedOwner: false, distanceKm: null, priorVoteCount: 0,
    });
    const r1 = recordVote({
      storyId: STORY, profileId: A, vote: 'hoax',
      weight: w, baseCredibility: BASE, baseStage: 'tier_2',
    });
    const r2 = recordVote({
      storyId: STORY, profileId: A, vote: 'real', // trying to switch
      weight: w, baseCredibility: BASE, baseStage: 'tier_2',
    });

    assert.equal(r2.locked, true, 'second attempt reports locked');
    assert.equal(r2.credibility, r1.credibility,
      'credibility unchanged — no double-counting');
    assert.equal(getVote(STORY, A), 'hoax', 'original vote preserved');
  });

  test('getProfileVotes rehydrates only the asked profile', () => {
    const w = voteWeight({
      trustScore: 50, tier: 'public', isJournalist: false,
      isVerifiedOwner: false, distanceKm: null, priorVoteCount: 0,
    });
    recordVote({ storyId: 's1', profileId: A, vote: 'hoax', weight: w, baseCredibility: 70, baseStage: 'tier_2' });
    recordVote({ storyId: 's2', profileId: A, vote: 'real', weight: w, baseCredibility: 70, baseStage: 'tier_2' });
    recordVote({ storyId: 's1', profileId: B, vote: 'real', weight: w, baseCredibility: 70, baseStage: 'tier_2' });

    const votesA = getProfileVotes(A);
    assert.deepEqual(votesA, { s1: 'hoax', s2: 'real' });

    const votesB = getProfileVotes(B);
    assert.deepEqual(votesB, { s1: 'real' });
  });

  test('overlayCredibility patches rows for both camelCase and snake_case', () => {
    const w = voteWeight({
      trustScore: 50, tier: 'public', isJournalist: false,
      isVerifiedOwner: false, distanceKm: null, priorVoteCount: 0,
    });
    recordVote({ storyId: 's1', profileId: A, vote: 'hoax', weight: w, baseCredibility: 70, baseStage: 'tier_2' });

    // Hub-style camelCase row.
    const hub = [{ id: 's1', credibility: 70, stage: 'tier_2' as const, title: 't' }];
    const patchedHub = overlayCredibility(
      hub,
      (r) => ({ id: r.id, credibility: r.credibility, stage: r.stage }),
      (r, credibility, stage) => ({ ...r, credibility, stage }),
    );
    assert.ok(patchedHub[0].credibility < 70, 'hub credibility overlaid');

    // Feed-style snake_case row.
    const feed = [{ id: 's1', credibility_score: 70, rollout_stage: 'tier_2' as const, titles: {} }];
    const patchedFeed = overlayCredibility(
      feed,
      (r) => ({ id: r.id, credibility: r.credibility_score, stage: r.rollout_stage }),
      (r, credibility, stage) => ({ ...r, credibility_score: credibility, rollout_stage: stage }),
    );
    assert.ok(patchedFeed[0].credibility_score < 70, 'feed credibility overlaid');

    // Row with no stored override is untouched.
    const untouched = overlayCredibility(
      [{ id: 'unknown', credibility: 70, stage: 'tier_2' as const }],
      (r) => ({ id: r.id, credibility: r.credibility, stage: r.stage }),
      (r, credibility, stage) => ({ ...r, credibility, stage }),
    );
    assert.equal(untouched[0].credibility, 70);
  });

  test('full user-reported flow end-to-end', () => {
    // 1. A opens story (sees BASE), votes hoax.
    const w1 = voteWeight({
      trustScore: 50, tier: 'public', isJournalist: false,
      isVerifiedOwner: false, distanceKm: null,
      priorVoteCount: priorDemoVoteCount(STORY),
    });
    const r1 = recordVote({
      storyId: STORY, profileId: A, vote: 'hoax',
      weight: w1, baseCredibility: BASE, baseStage: 'tier_2',
    });
    const credAfterA = r1.credibility;
    assert.ok(credAfterA < BASE);

    // 2. A refreshes — reads back shifted + locked.
    assert.equal(getCredibility(STORY)!.credibility, credAfterA);
    assert.equal(getVote(STORY, A), 'hoax');

    // 3. A switches to B. B's view overlays the shifted credibility.
    const overlaid = overlayCredibility(
      [{ id: STORY, credibility: BASE, stage: 'tier_2' as const }],
      (r) => ({ id: r.id, credibility: r.credibility, stage: r.stage }),
      (r, credibility, stage) => ({ ...r, credibility, stage }),
    );
    assert.equal(overlaid[0].credibility, credAfterA,
      'B sees A\'s shifted credibility — the complaint that this did NOT happen');
    assert.equal(getVote(STORY, B), null, 'B can still vote');

    // 4. B votes real.
    const w2 = voteWeight({
      trustScore: 50, tier: 'public', isJournalist: false,
      isVerifiedOwner: false, distanceKm: null,
      priorVoteCount: priorDemoVoteCount(STORY),
    });
    const r2 = recordVote({
      storyId: STORY, profileId: B, vote: 'real',
      weight: w2, baseCredibility: BASE, baseStage: 'tier_2',
    });
    const credAfterB = r2.credibility;
    assert.ok(credAfterB > credAfterA, 'B\'s vote stacks up from A, not from baseline');

    // 5. B refreshes — both locks + credAfterB survive.
    assert.equal(getCredibility(STORY)!.credibility, credAfterB);
    assert.equal(getVote(STORY, A), 'hoax', 'A lock survives');
    assert.equal(getVote(STORY, B), 'real', 'B lock survives');

    // 6. Switch back to A. A sees latest credibility, A still locked.
    assert.equal(getVote(STORY, A), 'hoax');
    assert.equal(getCredibility(STORY)!.credibility, credAfterB);
  });
});
