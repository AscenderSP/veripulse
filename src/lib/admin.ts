// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — Admin identity + daily post-limit guard
//  Server-side only. Never import into client components.
// ════════════════════════════════════════════════════════════════════════

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { ACCOUNT_TYPES } from './accountTiers';
import type { AccountType, JournalistVerificationStatus, SubscriptionTier } from './types';

export interface AdminCheckResult {
  isAdmin: boolean;
  reason: 'profile_flag' | 'env_allowlist' | 'denied';
}

/**
 * Admin if either (a) the user's profile has is_admin = true, or (b) the
 * caller's email is in the ADMIN_EMAILS env list (comma-separated).
 */
export async function checkAdmin(
  supabase: SupabaseClient,
  user: User,
): Promise<AdminCheckResult> {
  const envList = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && envList.includes(user.email.toLowerCase())) {
    return { isAdmin: true, reason: 'env_allowlist' };
  }
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if ((data as { is_admin?: boolean } | null)?.is_admin) {
    return { isAdmin: true, reason: 'profile_flag' };
  }
  return { isAdmin: false, reason: 'denied' };
}

export interface PostLimitState {
  accountType: AccountType;
  subscription: SubscriptionTier;
  dailyLimit: number; // -1 unlimited, 0 forbidden, >0 per 24h
  postsLast24h: number;
  journalistStatus: JournalistVerificationStatus;
  remaining: number; // -1 unlimited
}

export interface PostLimitDecision {
  allowed: boolean;
  reason:
    | 'ok'
    | 'POST_FORBIDDEN'
    | 'DAILY_LIMIT_REACHED'
    | 'JOURNALIST_PENDING_LIMIT_REACHED'
    | 'SUBSCRIPTION_EXPIRED';
  state: PostLimitState;
}

/**
 * Reads the caller's account_type / subscription from profiles and counts
 * their stories in the last 24h. Returns allowed=false with a specific
 * reason when the next post would exceed the tier limit. A pending-journalist
 * is capped at the Citizen Reporter rate until approved.
 */
export async function checkPostLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<PostLimitDecision> {
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'account_type, subscription_tier, daily_post_limit, journalist_verification_status, subscription_expires_at',
    )
    .eq('id', userId)
    .single();

  const row = (profile ?? {}) as {
    account_type?: AccountType;
    subscription_tier?: SubscriptionTier;
    daily_post_limit?: number;
    journalist_verification_status?: JournalistVerificationStatus;
    subscription_expires_at?: string | null;
  };

  const accountType: AccountType = row.account_type ?? 'citizen_reporter';
  const meta = ACCOUNT_TYPES[accountType];
  const journalistStatus = row.journalist_verification_status ?? 'none';
  const subscription: SubscriptionTier = row.subscription_tier ?? meta.requiredSubscription;

  // Pro Reporter whose subscription lapsed falls back to Citizen limits.
  let effectiveLimit = row.daily_post_limit ?? meta.dailyPostLimit;
  const expired =
    accountType === 'pro_reporter' &&
    (!row.subscription_expires_at || new Date(row.subscription_expires_at).getTime() < Date.now());
  if (expired) effectiveLimit = ACCOUNT_TYPES.citizen_reporter.dailyPostLimit;

  // A pending journalist can still publish, but at the Citizen rate until an
  // admin approves — stops people from signing up as "journalist" to bypass
  // the free-tier cap.
  if (accountType === 'journalist' && journalistStatus !== 'approved') {
    effectiveLimit = ACCOUNT_TYPES.citizen_reporter.dailyPostLimit;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('stories')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId)
    .gte('created_at', since);

  const postsLast24h = count ?? 0;
  const remaining = effectiveLimit === -1 ? -1 : Math.max(0, effectiveLimit - postsLast24h);
  const state: PostLimitState = {
    accountType,
    subscription,
    dailyLimit: effectiveLimit,
    postsLast24h,
    journalistStatus,
    remaining,
  };

  if (effectiveLimit === 0) {
    return { allowed: false, reason: 'POST_FORBIDDEN', state };
  }
  if (effectiveLimit !== -1 && postsLast24h >= effectiveLimit) {
    return {
      allowed: false,
      reason:
        accountType === 'journalist' && journalistStatus !== 'approved'
          ? 'JOURNALIST_PENDING_LIMIT_REACHED'
          : expired
            ? 'SUBSCRIPTION_EXPIRED'
            : 'DAILY_LIMIT_REACHED',
      state,
    };
  }
  return { allowed: true, reason: 'ok', state };
}
