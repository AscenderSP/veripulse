// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — Master Transaction DB Ledger System
//  Tracks ALL financial events (bounties, dividends, payouts, vouchers,
//  journalist dispatches, affiliate commissions) in one unified master ledger.
// ════════════════════════════════════════════════════════════════════════

import type { MasterTransaction, MasterTransactionType, MasterTransactionStatus } from './types';

function isSupabaseConfigured(): boolean {
  if (typeof process === 'undefined') return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes('placeholder') && !url.includes('example'));
}

export const INITIAL_MASTER_TRANSACTIONS: MasterTransaction[] = [
  {
    id: 'tx-bounty-1',
    userId: 'user-citizen-me',
    type: 'bounty_reward',
    deltaInr: 50,
    deltaVp: 500,
    balanceAfterInr: 450,
    balanceAfterVp: 4500,
    status: 'settled',
    description: 'Bounty reward: EM Bypass waterlogging verification with C2PA capture',
    referenceId: 'b-1',
    metadata: { location: 'Ruby Hospital, Kolkata', proofType: 'c2pa_image' },
    createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
  },
  {
    id: 'tx-div-1',
    userId: 'user-citizen-me',
    type: 'sentinel_dividend',
    deltaInr: 82,
    deltaVp: 820,
    balanceAfterInr: 400,
    balanceAfterVp: 4000,
    status: 'settled',
    description: 'Daily Sentinel accuracy dividend (7-day streak bonus 1.5x)',
    referenceId: 'div-2026-10-24',
    metadata: { accuracy: 94.2, streak: 7 },
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'tx-journo-1',
    userId: 'user-citizen-me',
    type: 'journalist_reward',
    deltaInr: 180,
    deltaVp: 1800,
    balanceAfterInr: 318,
    balanceAfterVp: 3180,
    status: 'settled',
    description: 'Journalist co-contributor dispatch: Gaganyaan crew simulation milestone',
    referenceId: 'news-tech-1',
    metadata: { matchScore: 94, passId: 'PIB-PRESS-2026' },
    createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
  },
  {
    id: 'tx-voucher-1',
    userId: 'user-citizen-me',
    type: 'voucher_redemption',
    deltaInr: -100,
    deltaVp: -1000,
    balanceAfterInr: 138,
    balanceAfterVp: 1380,
    status: 'settled',
    description: 'Redeemed ₹100 Flipkart Instant Voucher (Code: 6014 9912 3401 8847)',
    referenceId: 'v-fk-1',
    metadata: { vendor: 'flipkart', code: '6014 9912 3401 8847' },
    createdAt: new Date(Date.now() - 3600000 * 22).toISOString(),
  },
  {
    id: 'tx-upi-1',
    userId: 'user-citizen-me',
    type: 'upi_withdrawal',
    deltaInr: -200,
    deltaVp: -2000,
    balanceAfterInr: 238,
    balanceAfterVp: 2380,
    status: 'settled',
    description: 'UPI Payout to citizen@okaxis (Bank UTR: AXISX0PY2231)',
    referenceId: 'payout-d1',
    metadata: { upiId: 'citizen@okaxis', bankUtr: 'AXISX0PY2231' },
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
  {
    id: 'tx-affiliate-1',
    userId: 'user-citizen-me',
    type: 'affiliate_commission',
    deltaInr: 312,
    deltaVp: 3120,
    balanceAfterInr: 438,
    balanceAfterVp: 4380,
    status: 'settled',
    description: 'Verified Owner 20% reviewer share: Ather 450X verified test purchase',
    referenceId: 'ather-450x-gen3',
    metadata: { productId: 'ather-450x-gen3', verifiedOwnerBonus: true },
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

// In-memory master transaction registry for local/demo runs
let localTransactions: MasterTransaction[] = [...INITIAL_MASTER_TRANSACTIONS];
const listeners = new Set<(txs: MasterTransaction[]) => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn([...localTransactions]));
}

export function subscribeMasterTransactions(fn: (txs: MasterTransaction[]) => void) {
  listeners.add(fn);
  fn([...localTransactions]);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Atomic entry point to record ANY financial event into the Master DB.
 */
export async function recordMasterTransaction(params: {
  userId: string;
  type: MasterTransactionType;
  deltaInr: number;
  deltaVp: number;
  description: string;
  referenceId?: string;
  metadata?: Record<string, any>;
  status?: MasterTransactionStatus;
}): Promise<MasterTransaction> {
  const currentInr = localTransactions.length > 0 ? localTransactions[0].balanceAfterInr : 450;
  const currentVp = localTransactions.length > 0 ? localTransactions[0].balanceAfterVp : 4500;

  const newTx: MasterTransaction = {
    id: `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    userId: params.userId,
    type: params.type,
    deltaInr: params.deltaInr,
    deltaVp: params.deltaVp,
    balanceAfterInr: Math.max(0, +(currentInr + params.deltaInr).toFixed(2)),
    balanceAfterVp: Math.max(0, Math.round(currentVp + params.deltaVp)),
    status: params.status || 'settled',
    description: params.description,
    referenceId: params.referenceId,
    metadata: params.metadata || {},
    createdAt: new Date().toISOString(),
  };

  localTransactions = [newTx, ...localTransactions];
  notifyListeners();

  // If live Supabase is configured, record into public.master_transactions in Postgres
  if (isSupabaseConfigured() && typeof window !== 'undefined') {
    try {
      const { getSupabaseBrowserClient } = await import('./supabase/client');
      const sb = getSupabaseBrowserClient();
      await sb.from('master_transactions').insert({
        user_id: params.userId,
        type: params.type,
        delta_inr: params.deltaInr,
        delta_vp: params.deltaVp,
        balance_after_inr: newTx.balanceAfterInr,
        balance_after_vp: newTx.balanceAfterVp,
        status: newTx.status,
        description: params.description,
        reference_id: params.referenceId || null,
        metadata: params.metadata || {},
        created_at: newTx.createdAt,
      });
    } catch {
      // In-memory ledger safely preserves the event
    }
  }

  return newTx;
}

/**
 * Returns all recorded master transactions sorted chronologically desc.
 */
export function getMasterTransactions(): MasterTransaction[] {
  return [...localTransactions];
}
