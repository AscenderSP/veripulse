/**
 * §6.1 bridging-consensus math, mirrored from cast_weighted_vote in SQL.
 * The database is the source of truth; this copy powers demo mode and the
 * unit tests. Keep the two in lockstep. No imports, so tests can load it
 * directly under Node type-stripping.
 */

export type ConsensusVote = 'real' | 'hoax' | 'needs_context';
export type ConsensusStage = 'tier_1' | 'tier_2' | 'public' | 'quarantined';

export const PROMOTE_AT = 80;
export const QUARANTINE_BELOW = 35;
export const GEO_RADIUS_KM = 10;

export function voteScalar(v: ConsensusVote): number {
  return v === 'real' ? 1 : v === 'hoax' ? -1.5 : -0.5;
}

/** Wᵤ = (Tᵤ / 50) · M_geo · M_owner */
export function voteWeight(trust: number, distanceKm: number | null, isVerifiedOwner: boolean): number {
  const mGeo = distanceKm !== null && distanceKm <= GEO_RADIUS_KM ? 1.5 : 1;
  const mOwner = isVerifiedOwner ? 3 : 1;
  return (trust / 50) * mGeo * mOwner;
}

/** C⁽ᵗ⁺¹⁾ = clamp(5, 99, C⁽ᵗ⁾ + 3.5 · vᵤ · Wᵤ) */
export function nextCredibility(current: number, vote: ConsensusVote, weight: number): number {
  return Math.min(99, Math.max(5, current + 3.5 * voteScalar(vote) * weight));
}

export function nextStage(current: ConsensusStage, credibility: number): ConsensusStage {
  if (credibility >= PROMOTE_AT) return 'public';
  if (credibility < QUARANTINE_BELOW) return 'quarantined';
  if (current === 'tier_1') return 'tier_2';
  return current;
}
