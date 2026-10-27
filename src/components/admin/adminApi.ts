'use client';

// Thin fetch layer the admin panels share. Each helper mirrors a real API
// route; when the caller passes `demo: true`, it short-circuits to the
// in-memory DEMO data so the dashboard works without a live Supabase.

import {
  DEMO_STORIES,
  DEMO_PRESET_PROFILES,
  DEMO_LEADERBOARD,
  DEMO_ADMIN_PROFILE,
} from '@/lib/demoData';
import type { Profile, Story } from '@/lib/types';

export type ModerationStatus = 'live' | 'taken_down';
export type UserFilter = 'all' | 'suspended' | 'journalists' | 'admins';

export interface AdminStats {
  pendingJournalists: number;
  totalProfiles: number;
  stories24h: number;
  suspendedUsers: number;
  takenDown: number;
  quarantined: number;
  activeAdmins: number;
}

export interface EarningsSummary {
  cpmInr: number;
  totalImpressions: number;
  grossRevenueInr: number;
  payoutsProcessedInr: number;
  payoutsQueuedInr: number;
  outstandingWalletsInr: number;
  netMarginInr: number;
  topEarners: Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url' | 'wallet_balance_inr' | 'trust_score'>[];
  daily: { date: string; impressions: number; inr: number }[];
}

export interface LeaderboardPayload {
  byTrust: Profile[];
  byVotes: Profile[];
  byEarnings: Profile[];
  recentBounties: { user_id: string; reward_inr?: number; created_at?: string }[];
}

// ── Demo seeds ──────────────────────────────────────────────────────────

const DEMO_SUSPENDED_SEED: Profile[] = [
  {
    ...DEMO_PRESET_PROFILES[1],
    id: 'demo-suspended-1',
    username: 'ragebait_rohit',
    full_name: 'Rohit S.',
    is_suspended: true,
    suspended_until: new Date(Date.now() + 5 * 86400_000).toISOString(),
    suspension_reason: 'Repeated hoax posts.',
    trust_score: 22,
  },
];

const DEMO_TAKEDOWN_SEED: Story[] = DEMO_STORIES.slice(0, 2).map((s, i) => ({
  ...s,
  id: `demo-td-${i}`,
  admin_taken_down: true,
  takedown_reason: i === 0 ? 'Doxxing a minor.' : 'Deepfake video — manipulated audio.',
  rollout_stage: 'quarantined' as const,
  taken_down_at: new Date(Date.now() - (i + 1) * 86400_000).toISOString(),
}));

function demoUsers(): Profile[] {
  return [
    ...DEMO_PRESET_PROFILES,
    ...DEMO_SUSPENDED_SEED,
    DEMO_ADMIN_PROFILE,
  ];
}

// ── Stats ───────────────────────────────────────────────────────────────

export async function fetchAdminStats(opts: { demo: boolean }): Promise<AdminStats> {
  if (opts.demo) {
    const users = demoUsers();
    return {
      pendingJournalists: 2,
      totalProfiles: users.length + 1243,
      stories24h: DEMO_STORIES.length + 84,
      suspendedUsers: DEMO_SUSPENDED_SEED.length,
      takenDown: DEMO_TAKEDOWN_SEED.length,
      quarantined: DEMO_TAKEDOWN_SEED.length,
      activeAdmins: users.filter((u) => u.is_admin).length,
    };
  }
  const res = await fetch('/api/admin/me', { credentials: 'include' });
  if (!res.ok) throw new Error(`stats ${res.status}`);
  const json = await res.json();
  return json.stats as AdminStats;
}

// ── Posts moderation ────────────────────────────────────────────────────

export async function fetchPosts(opts: {
  demo: boolean;
  status: ModerationStatus;
  q?: string;
}): Promise<Story[]> {
  if (opts.demo) {
    const pool = opts.status === 'taken_down' ? DEMO_TAKEDOWN_SEED : DEMO_STORIES;
    const q = opts.q?.trim().toLowerCase() ?? '';
    return q
      ? pool.filter((s) => s.titles.en.toLowerCase().includes(q))
      : pool;
  }
  const url = new URL('/api/admin/posts', typeof window !== 'undefined' ? window.location.origin : 'http://x');
  url.searchParams.set('status', opts.status);
  if (opts.q) url.searchParams.set('q', opts.q);
  const res = await fetch(url.pathname + url.search, { credentials: 'include' });
  if (!res.ok) throw new Error(`posts ${res.status}`);
  const json = await res.json();
  return (json.items ?? []) as Story[];
}

export async function moderatePost(opts: {
  demo: boolean;
  storyId: string;
  action: 'takedown' | 'restore';
  reason?: string;
}): Promise<void> {
  if (opts.demo) {
    await new Promise((r) => setTimeout(r, 300));
    return;
  }
  const res = await fetch('/api/admin/posts', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyId: opts.storyId, action: opts.action, reason: opts.reason }),
  });
  if (!res.ok) throw new Error(`moderatePost ${res.status}`);
}

// ── User mgmt ───────────────────────────────────────────────────────────

export async function fetchUsers(opts: {
  demo: boolean;
  filter: UserFilter;
  q?: string;
}): Promise<Profile[]> {
  if (opts.demo) {
    const base = demoUsers();
    const filtered =
      opts.filter === 'suspended'
        ? base.filter((u) => u.is_suspended)
        : opts.filter === 'journalists'
          ? base.filter((u) => u.is_journalist_verified)
          : opts.filter === 'admins'
            ? base.filter((u) => u.is_admin)
            : base;
    const q = opts.q?.trim().toLowerCase() ?? '';
    return q
      ? filtered.filter(
          (u) =>
            u.username.toLowerCase().includes(q) ||
            (u.full_name ?? '').toLowerCase().includes(q),
        )
      : filtered;
  }
  const url = new URL('/api/admin/users', typeof window !== 'undefined' ? window.location.origin : 'http://x');
  url.searchParams.set('filter', opts.filter);
  if (opts.q) url.searchParams.set('q', opts.q);
  const res = await fetch(url.pathname + url.search, { credentials: 'include' });
  if (!res.ok) throw new Error(`users ${res.status}`);
  const json = await res.json();
  return (json.items ?? []) as Profile[];
}

export type UserAction =
  | 'suspend'
  | 'unsuspend'
  | 'grant_admin'
  | 'revoke_admin'
  | 'revoke_journalist'
  | 'reset_trust';

export async function patchUser(opts: {
  demo: boolean;
  userId: string;
  action: UserAction;
  reason?: string;
  days?: number;
}): Promise<void> {
  if (opts.demo) {
    await new Promise((r) => setTimeout(r, 250));
    return;
  }
  const res = await fetch('/api/admin/users', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: opts.userId,
      action: opts.action,
      reason: opts.reason,
      days: opts.days,
    }),
  });
  if (!res.ok) throw new Error(`patchUser ${res.status}`);
}

// ── Earnings ────────────────────────────────────────────────────────────

export async function fetchEarnings(opts: { demo: boolean }): Promise<EarningsSummary> {
  if (opts.demo) {
    const totalImpressions = DEMO_STORIES.reduce((s, x) => s + (x.ad_impressions ?? 0), 0);
    const grossRevenueInr = +((totalImpressions / 1000) * 0.8).toFixed(2);
    const topEarners = DEMO_PRESET_PROFILES.map((p) => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      wallet_balance_inr: p.wallet_balance_inr,
      trust_score: p.trust_score,
    }));
    const daily: EarningsSummary['daily'] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const imp = Math.round(2500 + Math.random() * 4500);
      daily.push({
        date: d.toISOString().slice(0, 10),
        impressions: imp,
        inr: +((imp / 1000) * 0.8).toFixed(2),
      });
    }
    return {
      cpmInr: 0.8,
      totalImpressions,
      grossRevenueInr,
      payoutsProcessedInr: 4820,
      payoutsQueuedInr: 1340,
      outstandingWalletsInr: 9820,
      netMarginInr: +(grossRevenueInr - 4820 - 9820).toFixed(2),
      topEarners,
      daily,
    };
  }
  const res = await fetch('/api/admin/earnings', { credentials: 'include' });
  if (!res.ok) throw new Error(`earnings ${res.status}`);
  return (await res.json()) as EarningsSummary;
}

// ── Leaderboards ────────────────────────────────────────────────────────

export async function fetchLeaderboard(opts: {
  demo: boolean;
}): Promise<LeaderboardPayload> {
  if (opts.demo) {
    const byTrust = DEMO_PRESET_PROFILES.slice().sort((a, b) => b.trust_score - a.trust_score);
    const byVotes = DEMO_PRESET_PROFILES.slice().sort(
      (a, b) => (b.correct_votes ?? 0) - (a.correct_votes ?? 0),
    );
    const byEarnings = DEMO_PRESET_PROFILES.slice().sort(
      (a, b) => (b.wallet_balance_inr ?? 0) - (a.wallet_balance_inr ?? 0),
    );
    return {
      byTrust,
      byVotes,
      byEarnings,
      recentBounties: DEMO_LEADERBOARD.map((l) => ({
        user_id: l.username,
        reward_inr: Math.round(l.weeklyVpCoins / 10),
        created_at: new Date(Date.now() - 86400_000).toISOString(),
      })),
    };
  }
  const res = await fetch('/api/admin/leaderboard', { credentials: 'include' });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return (await res.json()) as LeaderboardPayload;
}
