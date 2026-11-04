/**
 * Consensus math — mirrored from cast_weighted_vote (SQL migration 0013).
 * The database is the source of truth; this copy powers optimistic UI and
 * the unit tests. Keep the two in lockstep. No imports, so tests can load
 * it directly under Node type-stripping.
 *
 * Model:  credibility[t+1] = clamp(5, 99, credibility[t] + K · vᵤ · Wᵤ)
 *   K   = 1.0 base coefficient
 *   vᵤ  = vote scalar — real:+1.0, hoax:-1.5, needs_context:-0.5
 *   Wᵤ  = voter impact weight (product of five multipliers below)
 *
 * Calibration anchor (hoax vote on a story at 80% AI baseline, stock trust
 * 50, no proximity/early/owner bonuses):
 *   journalist          → -3.00  (60% → 77%)
 *   senior sentinel     → -1.50  (80% → 78.5%)
 *   validator (mid)     → -1.28
 *   public contributor  → -1.00  (80% → 79%)
 */

export type ConsensusVote = 'real' | 'hoax' | 'needs_context';
export type ConsensusStage = 'tier_1' | 'tier_2' | 'public' | 'quarantined';
export type UserTier = 'sentinel_t1' | 'validator_t2' | 'public';

export const PROMOTE_AT = 80;
export const QUARANTINE_BELOW = 35;
export const GEO_RADIUS_KM = 10;
const K = 1.0;

export interface VoterContext {
  trustScore: number;        // 0..100
  tier: UserTier;
  isJournalist: boolean;     // is_journalist_verified
  isVerifiedOwner: boolean;  // ownership_verifications match on category
  distanceKm: number | null; // null when unknown (no story geom or no home)
  priorVoteCount: number;    // votes on this story before this one lands
}

export function voteScalar(v: ConsensusVote): number {
  return v === 'real' ? 1 : v === 'hoax' ? -1.5 : -0.5;
}

/** Role carries the headline impact spread (2.0 : 1.0 : 0.85 : 0.67). */
export function roleMultiplier(ctx: Pick<VoterContext, 'isJournalist' | 'tier'>): number {
  if (ctx.isJournalist) return 2.0;
  if (ctx.tier === 'sentinel_t1') return 1.0;
  if (ctx.tier === 'validator_t2') return 0.85;
  return 0.67;
}

/** Trust floors at 0.5 and caps at 1.5 so a brand-new account still counts
 *  and a hyper-trusted one can't single-handedly flip a story. */
export function trustMultiplier(trustScore: number): number {
  return Math.min(1.5, Math.max(0.5, trustScore / 50));
}

export function geoMultiplier(distanceKm: number | null): number {
  return distanceKm !== null && distanceKm <= GEO_RADIUS_KM ? 1.5 : 1.0;
}

/** Early votes shape the consensus curve more than late piling-on. */
export function earlyMultiplier(priorVoteCount: number): number {
  if (priorVoteCount < 5) return 1.5;
  if (priorVoteCount < 20) return 1.2;
  return 1.0;
}

export function ownerMultiplier(isVerifiedOwner: boolean): number {
  return isVerifiedOwner ? 2.0 : 1.0;
}

/** Wᵤ = M_role · M_trust · M_geo · M_early · M_owner */
export function voteWeight(ctx: VoterContext): number {
  return (
    roleMultiplier(ctx) *
    trustMultiplier(ctx.trustScore) *
    geoMultiplier(ctx.distanceKm) *
    earlyMultiplier(ctx.priorVoteCount) *
    ownerMultiplier(ctx.isVerifiedOwner)
  );
}

/** C⁽ᵗ⁺¹⁾ = clamp(5, 99, C⁽ᵗ⁾ + K · vᵤ · Wᵤ) */
export function nextCredibility(current: number, vote: ConsensusVote, weight: number): number {
  return Math.min(99, Math.max(5, current + K * voteScalar(vote) * weight));
}

export function nextStage(current: ConsensusStage, credibility: number): ConsensusStage {
  if (credibility >= PROMOTE_AT) return 'public';
  if (credibility < QUARANTINE_BELOW) return 'quarantined';
  if (current === 'tier_1') return 'tier_2';
  return current;
}
