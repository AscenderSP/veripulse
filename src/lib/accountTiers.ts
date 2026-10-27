// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — Account types & subscription plans
//  Defines who can do what: posting limits, review eligibility, pricing.
// ════════════════════════════════════════════════════════════════════════

import type { AccountType, SubscriptionTier } from './types';

export interface AccountTypeMeta {
  id: AccountType;
  name: string;
  subtitle: string;
  dailyPostLimit: number; // -1 = unlimited
  canVote: boolean;
  canEarn: boolean;
  canHuntBounties: boolean;
  canReviewProducts: boolean;
  needsVerification: boolean;
  priceInr: number; // 0 = free
  perks: string[];
  requiredSubscription: SubscriptionTier;
}

export const ACCOUNT_TYPES: Record<AccountType, AccountTypeMeta> = {
  reader: {
    id: 'reader',
    name: 'Reader',
    subtitle: 'Browse verified news, vote, earn points.',
    dailyPostLimit: 0,
    canVote: true,
    canEarn: true,
    canHuntBounties: true,
    canReviewProducts: true,
    needsVerification: false,
    priceInr: 0,
    requiredSubscription: 'free',
    perks: [
      'Vote on stories & earn VPcoins',
      'Participate in bounty hunts',
      'Review products you own (verified ownership)',
      'Follow trusted sentinels',
    ],
  },
  citizen_reporter: {
    id: 'citizen_reporter',
    name: 'Citizen Reporter',
    subtitle: 'Report what you witness — up to 3 posts/day.',
    dailyPostLimit: 3,
    canVote: true,
    canEarn: true,
    canHuntBounties: true,
    canReviewProducts: true,
    needsVerification: false,
    priceInr: 0,
    requiredSubscription: 'free',
    perks: [
      'Post up to 3 field reports per day',
      'Attach photos & geo-tagged media',
      'Vote, earn, hunt bounties',
      'Review verified-ownership products',
    ],
  },
  pro_reporter: {
    id: 'pro_reporter',
    name: 'Pro Reporter',
    subtitle: 'Non-journalist with higher post limits & priority review.',
    dailyPostLimit: 15,
    canVote: true,
    canEarn: true,
    canHuntBounties: true,
    canReviewProducts: true,
    needsVerification: false,
    priceInr: 99,
    requiredSubscription: 'pro',
    perks: [
      'Post up to 15 reports per day',
      'Priority Tier-1 Sentinel review',
      '2× bounty payout multiplier',
      'Early access to new verification tools',
      'All Reader & Citizen Reporter perks',
    ],
  },
  journalist: {
    id: 'journalist',
    name: 'Verified Journalist',
    subtitle: 'Press-credentialled reporter — unlimited, UPI payouts.',
    dailyPostLimit: -1,
    canVote: true,
    canEarn: true,
    canHuntBounties: true,
    canReviewProducts: true,
    needsVerification: true,
    priceInr: 0,
    requiredSubscription: 'press',
    perks: [
      'Unlimited reports with press-pass badge',
      'Named byline on your stories',
      'Direct UPI payouts for syndicated pieces',
      '3× bounty payout multiplier',
      'Admin + legal escalation channel',
    ],
  },
};

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  priceInr: number;
  periodLabel: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    priceInr: 0,
    periodLabel: 'forever',
    features: ['Read + vote', 'Up to 3 posts/day for Citizen Reporters', 'Earn VPcoins'],
  },
  {
    id: 'pro',
    name: 'Pro Reporter',
    priceInr: 99,
    periodLabel: '/month',
    features: ['15 posts/day', '2× bounty multiplier', 'Priority review'],
  },
  {
    id: 'press',
    name: 'Press',
    priceInr: 0,
    periodLabel: 'with verification',
    features: ['Unlimited posts', 'Byline + press badge', 'UPI payouts', '3× bounty multiplier'],
  },
];

export function accountTypeDefaults(type: AccountType) {
  const meta = ACCOUNT_TYPES[type];
  return {
    account_type: type,
    subscription_tier: meta.requiredSubscription,
    daily_post_limit: meta.dailyPostLimit,
    posts_today: 0,
  } as const;
}
