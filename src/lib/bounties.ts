// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — Bounty Expiration & Lifespan Utilities
//  Enforces the 2-Hour hard expiration limit for community verification tasks.
// ════════════════════════════════════════════════════════════════════════

import type { BountyQuest } from './types';

export const BOUNTY_EXPIRY_HOURS = 2;
export const BOUNTY_EXPIRY_MS = BOUNTY_EXPIRY_HOURS * 60 * 60 * 1000; // 7,200,000 ms

/**
 * Checks whether a bounty quest has elapsed past its 2-hour window.
 */
export function isBountyExpired(b: BountyQuest): boolean {
  if (b.status === 'completed' || b.status === 'claimed') return false;
  if (b.status === 'expired') return true;
  const now = Date.now();
  const exp = new Date(b.expiresAt).getTime();
  const created = new Date(b.createdAt).getTime();
  return (!isNaN(exp) && now > exp) || (!isNaN(created) && now - created > BOUNTY_EXPIRY_MS);
}

/**
 * Formats user-friendly countdown time remaining within the 2-hour window.
 */
export function formatBountyTimeRemaining(b: BountyQuest): string {
  if (isBountyExpired(b)) return 'Expired';
  const now = Date.now();
  const exp = new Date(b.expiresAt).getTime();
  const diff = exp - now;
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remMins}m left` : `${remMins}m left`;
}
