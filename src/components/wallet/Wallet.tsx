'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Wallet as WalletIcon,
  ArrowDownToLine,
  Loader2,
  Receipt,
  TrendingUp,
  ScanLine,
  Pencil,
  Coins,
  Gift,
  ShoppingBag,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui/primitives';
import { formatINR, formatVPCoins, inrToVPCoins, vpCoinsToINR, VPCOINS_PER_INR } from '@/lib/utils';
import type { PayoutRequest, RedeemedVoucher, VoucherVendor } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';

// Minimum withdrawal is 1,000 VPcoins (= ₹100)
const MIN_INR = 100;
const MIN_VP = MIN_INR * VPCOINS_PER_INR; // 1,000 VP
const MIN_TRUST = 70;

const DEMO_PAYOUTS: Pick<PayoutRequest, 'id' | 'amount_inr' | 'bank_utr' | 'status' | 'created_at'>[] = [
  { id: 'd1', amount_inr: 200, bank_utr: 'AXISX0PY2231', status: 'processed', created_at: '2026-10-18T10:00:00Z' },
  { id: 'd2', amount_inr: 150, bank_utr: 'HDFCN0KK9922', status: 'processed', created_at: '2026-10-05T10:00:00Z' },
];

const DEMO_STREAMS = {
  affiliate_reviewer: 312,
  bounty_rewards: 250,
  milestone_grants: 150,
  consultation_fees: 87,
  sentinel_dividends: 176,
  sentinel_pool: 128.5,
  reversal: 0,
};

const STREAM_LABELS: Record<string, string> = {
  affiliate_reviewer: 'Affiliate reviewer share (20%)',
  bounty_rewards: 'Citizen verification bounties',
  milestone_grants: 'Telemetry milestone grants (6-mo / 1-yr)',
  consultation_fees: '"Ask an Owner" micro-consultations',
  sentinel_dividends: 'Daily Sentinel accuracy dividends (7-day streak)',
  sentinel_pool: 'Sentinel fact-check pool (10%)',
};

const STATUS_COLOR: Record<string, [string, string]> = {
  processed: ['var(--brand-emerald)', 'var(--brand-emerald-glow)'],
  processing: ['var(--brand-sky)', 'rgba(14,165,233,0.12)'],
  queued: ['var(--brand-amber)', 'rgba(245,158,11,0.12)'],
  reversed: ['var(--brand-rose)', 'rgba(244,63,94,0.12)'],
  failed: ['var(--brand-rose)', 'rgba(244,63,94,0.12)'],
};

const VOUCHER_DENOMINATIONS = [
  { inr: 100, vp: 1000 },
  { inr: 250, vp: 2500 },
  { inr: 500, vp: 5000 },
  { inr: 1000, vp: 10000 },
];

const INITIAL_DEMO_VOUCHERS: RedeemedVoucher[] = [
  {
    id: 'v-amz-1',
    vendor: 'amazon',
    amountInr: 250,
    vpCoinsSpent: 2500,
    code: 'AMZN-VP-8492-7104-E2X9',
    claimedAt: '2026-10-22T14:30:00Z',
    expiresAt: '2027-10-22T14:30:00Z',
    status: 'active',
  },
  {
    id: 'v-fk-1',
    vendor: 'flipkart',
    amountInr: 100,
    vpCoinsSpent: 1000,
    code: '6014 9912 3401 8847',
    pin: '492815',
    claimedAt: '2026-10-15T09:15:00Z',
    expiresAt: '2027-10-15T09:15:00Z',
    status: 'active',
  },
];

type RedeemTab = 'upi' | 'amazon' | 'flipkart';

export function Wallet({ onVerify }: { onVerify: () => void }) {
  const { demo, user, profile, setAuthOpen, refreshProfile, patchDemoProfile } = useSession();
  const { lang } = useLang();
  
  // Redeem state
  const [activeTab, setActiveTab] = useState<RedeemTab>('upi');
  const [vpAmount, setVpAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [payouts, setPayouts] = useState(demo ? DEMO_PAYOUTS : []);
  const [vouchers, setVouchers] = useState<RedeemedVoucher[]>(INITIAL_DEMO_VOUCHERS);
  const [streams, setStreams] = useState<Record<string, number>>(demo ? DEMO_STREAMS : {});
  const [editingUpi, setEditingUpi] = useState(false);
  const [upi, setUpi] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const loadLive = useCallback(async () => {
    if (demo || !user) return;
    const sb = getSupabaseBrowserClient();
    const [{ data: pr }, { data: ledger }] = await Promise.all([
      sb.from('payout_requests').select('id, amount_inr, bank_utr, status, created_at').order('created_at', { ascending: false }).limit(10),
      sb.from('wallet_ledger').select('reason, delta_inr').gt('delta_inr', 0),
    ]);
    setPayouts((pr as typeof DEMO_PAYOUTS) ?? []);
    const totals: Record<string, number> = {};
    for (const row of ledger ?? []) totals[row.reason] = (totals[row.reason] ?? 0) + Number(row.delta_inr);
    setStreams(totals);
  }, [demo, user]);

  useEffect(() => {
    loadLive();
  }, [loadLive]);

  // Realtime: payout status / UTR updates from the RazorpayX webhook.
  useEffect(() => {
    if (demo || !user) return;
    const sb = getSupabaseBrowserClient();
    const ch = sb
      .channel(`payouts:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests', filter: `user_id=eq.${user.id}` }, () => loadLive())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [demo, user, loadLive]);

  if (!demo && !user) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-content-secondary">Sign in to see your earnings and withdraw to UPI or Gift Cards.</p>
        <button onClick={() => setAuthOpen(true)} className="mt-3 text-sm font-semibold text-brand-emerald">
          Sign in
        </button>
      </Card>
    );
  }
  if (!profile) {
    return (
      <div className="flex justify-center py-16 text-content-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const balanceInr = Number(profile.wallet_balance_inr);
  const balanceVp = profile.wallet_balance_vpcoins ?? inrToVPCoins(balanceInr);
  const trust = Number(profile.trust_score);
  const requestedVp = Number(vpAmount);
  const requestedInr = vpCoinsToINR(requestedVp);
  const eligible = trust >= MIN_TRUST && Boolean(profile.upi_id);
  const canWithdrawUpi = eligible && requestedVp >= MIN_VP && requestedVp <= balanceVp;

  async function saveUpi() {
    const v = upi.trim();
    if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(v)) {
      setErrorMsg('That doesn’t look like a valid UPI ID (e.g. name@bank).');
      return;
    }
    if (demo) {
      patchDemoProfile({ upi_id: v });
    } else {
      const { error } = await getSupabaseBrowserClient().from('profiles').update({ upi_id: v }).eq('id', profile!.id);
      if (error) return setErrorMsg(error.message);
      await refreshProfile();
    }
    setEditingUpi(false);
    setErrorMsg(null);
  }

  // 1. Instant UPI Payout
  async function withdrawUpi() {
    if (!canWithdrawUpi) return;
    setBusy(true);
    setMsg(null);
    setErrorMsg(null);
    try {
      const idemKey = `wd_${Date.now()}_${crypto.randomUUID()}`;
      if (demo) {
        await new Promise((r) => setTimeout(r, 900));
        const newBalanceInr = Math.max(0, balanceInr - requestedInr);
        const newBalanceVp = Math.max(0, balanceVp - requestedVp);
        patchDemoProfile({
          wallet_balance_inr: newBalanceInr,
          wallet_balance_vpcoins: newBalanceVp,
        });
        setPayouts((p) => [
          { id: idemKey, amount_inr: requestedInr, bank_utr: `UPI${Math.floor(1000000000 + Math.random() * 9000000000)}`, status: 'processing', created_at: new Date().toISOString() },
          ...p,
        ]);
        setMsg(`Success: ${formatVPCoins(requestedVp)} (₹${requestedInr}) transferred to ${profile!.upi_id}.`);
      } else {
        const res = await apiFetch('/api/payouts/upi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_inr: requestedInr, idempotency_key: idemKey }),
        });
        const data = await res.json();
        if (!res.ok && res.status !== 202) throw new Error(data.error ?? 'Payout failed');
        setMsg(`Payout ${data.status}. ${data.utr ? 'UTR: ' + data.utr : 'UTR will appear when the bank settles.'}`);
        await Promise.all([refreshProfile(), loadLive()]);
      }
      setVpAmount('');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Payout failed');
    } finally {
      setBusy(false);
    }
  }

  // 2. Instant Amazon / Flipkart Voucher Redemption
  async function redeemVoucher(vendor: VoucherVendor, inr: number, vpCost: number) {
    if (balanceVp < vpCost) {
      setErrorMsg(`Insufficient VPcoins. You need ${formatVPCoins(vpCost)} to redeem ₹${inr} voucher.`);
      return;
    }
    setBusy(true);
    setMsg(null);
    setErrorMsg(null);

    try {
      await new Promise((r) => setTimeout(r, 700));

      const randHex = () => Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = vendor === 'amazon'
        ? `AMZN-VP-${randHex()}-${randHex()}-${randHex()}`
        : `6014 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
      const pin = vendor === 'flipkart' ? String(Math.floor(100000 + Math.random() * 900000)) : undefined;

      const newVoucher: RedeemedVoucher = {
        id: `v-${vendor}-${Date.now()}`,
        vendor,
        amountInr: inr,
        vpCoinsSpent: vpCost,
        code,
        pin,
        claimedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        status: 'active',
      };

      const newBalanceVp = balanceVp - vpCost;
      const newBalanceInr = vpCoinsToINR(newBalanceVp);

      if (demo) {
        patchDemoProfile({
          wallet_balance_inr: newBalanceInr,
          wallet_balance_vpcoins: newBalanceVp,
        });
      } else {
        const { error } = await getSupabaseBrowserClient()
          .from('profiles')
          .update({
            wallet_balance_inr: newBalanceInr,
            wallet_balance_vpcoins: newBalanceVp,
          })
          .eq('id', profile!.id);
        if (error) throw error;
        await refreshProfile();
      }

      setVouchers((prev) => [newVoucher, ...prev]);
      setMsg(`🎉 Congratulations! Your ₹${inr} ${vendor === 'amazon' ? 'Amazon Pay Gift Card' : 'Flipkart Voucher'} is ready.`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Voucher redemption failed');
    } finally {
      setBusy(false);
    }
  }

  function handleCopy(text: string, id: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2500);
    }
  }

  const isOwner = profile.badge === 'Verified Owner' || profile.tier !== 'public';

  return (
    <div className="space-y-4 stagger-children">
      {/* ── Balance Hero Card (Prominent VPcoins) ── */}
      <Card glow className="relative overflow-hidden p-5 orb-bg border-brand-amber/30">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-amber">
            <Coins size={16} className="text-brand-amber animate-pulse" />
            <span>Sentinel VPcoins Balance</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-pill bg-brand-amber/15 px-2.5 py-0.5 text-[11px] font-bold text-brand-amber border border-brand-amber/30">
            <span>Standard Rate: 10 VP = ₹1</span>
          </div>
        </div>

        {/* Primary VPcoin Value */}
        <div className="relative z-10 mt-2 flex flex-wrap items-baseline gap-3">
          <div className="font-mono text-4xl font-extrabold text-brand-amber" style={{ textShadow: '0 0 16px rgba(245,158,11,0.3)' }}>
            {formatVPCoins(balanceVp)}
          </div>
          <div className="font-mono text-lg font-semibold text-content-muted">
            ≈ {formatINR(balanceInr)}
          </div>
        </div>

        {/* Sentinel Badges & UPI Status */}
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
          <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
            {t('trustScore', lang)} {trust.toFixed(1)}%
          </Badge>
          <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">
            {profile.tier === 'sentinel_t1' ? '🛡️ Tier-1 Sentinel' : profile.badge}
          </Badge>

          {editingUpi ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                placeholder="name@bank"
                className="w-36 rounded-pill border border-[var(--border-strong)] bg-bg-primary px-2.5 py-1 text-xs text-content-primary focus:outline-none"
              />
              <button onClick={saveUpi} className="text-xs font-semibold text-brand-emerald press-effect">
                Save
              </button>
            </span>
          ) : (
            <button
              onClick={() => {
                setUpi(profile.upi_id ?? '');
                setEditingUpi(true);
              }}
              className="press-effect"
            >
              <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
                {profile.upi_id ? `UPI: ${profile.upi_id}` : 'Add UPI ID'} <Pencil size={11} className="ml-1" />
              </Badge>
            </button>
          )}
        </div>

        {/* Mini Tip Banner */}
        <div className="relative z-10 mt-3.5 flex items-center gap-2 rounded-button bg-bg-surface/80 p-2 text-[11px] text-content-secondary border border-[var(--border-subtle)]">
          <Sparkles size={14} className="text-brand-amber shrink-0" />
          <span>
            Earn ample VPcoins by solving <strong>Bounties</strong>, daily <strong>Sentinel Dividends</strong>, and weekly <strong>Leaderboard Rewards</strong>.
          </span>
        </div>
      </Card>

      {/* ── Redemption Central (UPI / Amazon / Flipkart) ── */}
      <Card className="p-4 border-[var(--border-subtle)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-content-primary">
            <ArrowDownToLine size={16} className="text-brand-emerald" /> Redeem VPcoins
          </h3>
          <span className="text-[11px] text-content-muted">Choose your preferred payout method</span>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-2 p-1 rounded-card bg-bg-primary border border-[var(--border-subtle)] mb-4">
          <button
            onClick={() => { setActiveTab('upi'); setMsg(null); setErrorMsg(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-button text-xs font-bold transition-all ${
              activeTab === 'upi'
                ? 'bg-brand-emerald text-[#04110b] shadow-sm'
                : 'text-content-muted hover:text-content-primary'
            }`}
          >
            <Zap size={13} />
            <span>UPI Cash</span>
          </button>
          <button
            onClick={() => { setActiveTab('amazon'); setMsg(null); setErrorMsg(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-button text-xs font-bold transition-all ${
              activeTab === 'amazon'
                ? 'bg-brand-amber text-[#04110b] shadow-sm'
                : 'text-content-muted hover:text-content-primary'
            }`}
          >
            <ShoppingBag size={13} />
            <span>Amazon Pay</span>
          </button>
          <button
            onClick={() => { setActiveTab('flipkart'); setMsg(null); setErrorMsg(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-button text-xs font-bold transition-all ${
              activeTab === 'flipkart'
                ? 'bg-brand-sky text-[#04110b] shadow-sm'
                : 'text-content-muted hover:text-content-primary'
            }`}
          >
            <Gift size={13} />
            <span>Flipkart Coupon</span>
          </button>
        </div>

        {/* Feedback alerts */}
        {msg && (
          <div className="mb-3 flex items-start gap-2 rounded-button bg-brand-emerald/15 border border-brand-emerald/30 p-2.5 text-xs text-brand-emerald">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{msg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mb-3 flex items-start gap-2 rounded-button bg-brand-rose/15 border border-brand-rose/30 p-2.5 text-xs text-brand-rose">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: Instant UPI Transfer */}
        {activeTab === 'upi' && (
          <div className="space-y-3">
            {trust < MIN_TRUST && (
              <div className="rounded-button bg-[rgba(245,158,11,0.12)] p-2.5 text-xs text-brand-amber">
                UPI withdrawals unlock at {MIN_TRUST}% trust. Your trust score is {trust.toFixed(1)}%.
              </div>
            )}
            {!profile.upi_id && (
              <div className="rounded-button bg-[rgba(14,165,233,0.12)] p-2.5 text-xs text-brand-sky">
                Add a UPI ID above to withdraw funds directly to your bank account.
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-content-secondary">
                Amount in VPcoins (10 VP = ₹1 · Min {MIN_VP.toLocaleString()} VP)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-brand-amber">
                    VP
                  </span>
                  <input
                    inputMode="numeric"
                    value={vpAmount}
                    onChange={(e) => setVpAmount(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder={`Min ${MIN_VP}`}
                    className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary py-2.5 pl-10 pr-24 text-sm text-content-primary focus:border-brand-emerald focus:outline-none font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-muted">
                    ≈ ₹{requestedInr > 0 ? requestedInr : 0}
                  </span>
                </div>
                <Button
                  onClick={withdrawUpi}
                  disabled={!canWithdrawUpi || busy}
                  className="bg-brand-emerald text-[#04110b] font-bold"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : 'Withdraw to UPI'}
                </Button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-content-muted mr-1">Presets:</span>
                {[1000, 2500, 5000].map((presetVp) => (
                  <button
                    key={presetVp}
                    onClick={() => setVpAmount(String(presetVp))}
                    className="rounded-pill bg-bg-elevated hover:bg-bg-primary border border-[var(--border-subtle)] px-2.5 py-0.5 text-[11px] font-mono text-content-secondary hover:text-content-primary transition-colors"
                  >
                    {presetVp.toLocaleString()} VP (₹{vpCoinsToINR(presetVp)})
                  </button>
                ))}
                <button
                  onClick={() => setVpAmount(String(balanceVp))}
                  className="rounded-pill bg-brand-amber/15 border border-brand-amber/30 px-2.5 py-0.5 text-[11px] font-mono text-brand-amber hover:bg-brand-amber/25 transition-colors"
                >
                  Max All ({balanceVp.toLocaleString()} VP)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Amazon Pay Gift Card */}
        {activeTab === 'amazon' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-content-secondary">
              <span>Instant Amazon India Gift Card voucher code. Redeem on amazon.in/addgiftcard.</span>
              <span className="font-mono text-brand-amber font-bold">10 VP = ₹1</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {VOUCHER_DENOMINATIONS.map((denom) => {
                const canAfford = balanceVp >= denom.vp;
                return (
                  <div
                    key={denom.inr}
                    className={`rounded-card border p-3 flex flex-col justify-between text-left transition-all ${
                      canAfford
                        ? 'border-brand-amber/40 bg-gradient-to-b from-brand-amber/10 to-bg-surface hover:border-brand-amber'
                        : 'border-[var(--border-subtle)] bg-bg-primary/50 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <ShoppingBag size={14} className="text-brand-amber" />
                        <span className="text-[10px] font-bold uppercase text-brand-amber">Amazon Pay</span>
                      </div>
                      <div className="mt-2 font-mono text-xl font-black text-content-primary">
                        ₹{denom.inr}
                      </div>
                      <div className="text-[11px] font-mono text-brand-amber mt-0.5">
                        {denom.vp.toLocaleString()} VPcoins
                      </div>
                    </div>

                    <button
                      onClick={() => redeemVoucher('amazon', denom.inr, denom.vp)}
                      disabled={!canAfford || busy}
                      className={`mt-3 w-full rounded-button py-1.5 px-2 text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        canAfford
                          ? 'bg-brand-amber text-[#04110b] hover:opacity-90 active:scale-95'
                          : 'bg-bg-elevated text-content-muted cursor-not-allowed'
                      }`}
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : 'Redeem'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Flipkart Coupon Voucher */}
        {activeTab === 'flipkart' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-content-secondary">
              <span>Instant Flipkart Gift Card number &amp; 6-digit PIN. Redeem on Flipkart checkout or gift card wallet.</span>
              <span className="font-mono text-brand-sky font-bold">10 VP = ₹1</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {VOUCHER_DENOMINATIONS.map((denom) => {
                const canAfford = balanceVp >= denom.vp;
                return (
                  <div
                    key={denom.inr}
                    className={`rounded-card border p-3 flex flex-col justify-between text-left transition-all ${
                      canAfford
                        ? 'border-brand-sky/40 bg-gradient-to-b from-brand-sky/10 to-bg-surface hover:border-brand-sky'
                        : 'border-[var(--border-subtle)] bg-bg-primary/50 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <Gift size={14} className="text-brand-sky" />
                        <span className="text-[10px] font-bold uppercase text-brand-sky">Flipkart</span>
                      </div>
                      <div className="mt-2 font-mono text-xl font-black text-content-primary">
                        ₹{denom.inr}
                      </div>
                      <div className="text-[11px] font-mono text-brand-sky mt-0.5">
                        {denom.vp.toLocaleString()} VPcoins
                      </div>
                    </div>

                    <button
                      onClick={() => redeemVoucher('flipkart', denom.inr, denom.vp)}
                      disabled={!canAfford || busy}
                      className={`mt-3 w-full rounded-button py-1.5 px-2 text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        canAfford
                          ? 'bg-brand-sky text-[#04110b] hover:opacity-90 active:scale-95'
                          : 'bg-bg-elevated text-content-muted cursor-not-allowed'
                      }`}
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : 'Redeem'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* ── Claimed Gift Vouchers Vault ── */}
      <Card className="p-4 border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-content-primary">
            <Gift size={15} className="text-brand-amber" /> My Claimed Gift Vouchers ({vouchers.length})
          </h3>
          <span className="text-[10px] text-content-muted font-mono">1-Year Validity · Active</span>
        </div>

        {vouchers.length === 0 ? (
          <p className="text-xs text-content-muted">No gift cards claimed yet. Redeem above using your VPcoins!</p>
        ) : (
          <div className="space-y-2.5">
            {vouchers.map((v) => {
              const isAmazon = v.vendor === 'amazon';
              const isCopied = copiedCodeId === v.id;
              return (
                <div
                  key={v.id}
                  className="rounded-card border border-[var(--border-subtle)] bg-bg-surface p-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          isAmazon
                            ? 'bg-brand-amber/20 text-brand-amber border border-brand-amber/40'
                            : 'bg-brand-sky/20 text-brand-sky border border-brand-sky/40'
                        }`}
                      >
                        {isAmazon ? 'Amazon Pay' : 'Flipkart Voucher'}
                      </span>
                      <span className="font-mono text-sm font-extrabold text-content-primary">
                        ₹{v.amountInr}
                      </span>
                      <span className="text-[10px] text-content-muted">
                        ({v.vpCoinsSpent.toLocaleString()} VP)
                      </span>
                    </div>

                    {/* Voucher Code Display */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="font-mono text-xs font-bold text-brand-emerald bg-bg-primary px-2.5 py-1 rounded border border-[var(--border-subtle)] tracking-wider">
                        {v.code}
                      </div>
                      {v.pin && (
                        <div className="font-mono text-xs font-semibold text-content-secondary bg-bg-primary px-2 py-1 rounded border border-[var(--border-subtle)]">
                          PIN: <span className="text-content-primary font-bold">{v.pin}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleCopy(v.pin ? `Card: ${v.code} PIN: ${v.pin}` : v.code, v.id)}
                      className={`text-xs px-3 py-1.5 flex items-center gap-1.5 font-bold ${
                        isCopied
                          ? 'bg-brand-emerald text-[#04110b]'
                          : 'bg-bg-elevated text-content-primary hover:bg-bg-primary border border-[var(--border-subtle)]'
                      }`}
                    >
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{isCopied ? 'Copied!' : 'Copy Code'}</span>
                    </Button>

                    <a
                      href={isAmazon ? 'https://www.amazon.in/addgiftcard' : 'https://www.flipkart.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-button bg-bg-elevated hover:bg-bg-primary border border-[var(--border-subtle)] p-1.5 text-content-muted hover:text-content-primary transition-colors"
                      title="Redeem at vendor site"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Earnings Breakdown (Denominated in VPcoins & INR) ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-content-primary">
            <TrendingUp size={15} className="text-brand-emerald" /> {t('earningsBreakdown', lang)}
          </h3>
          <span className="text-[11px] font-mono text-brand-amber font-semibold">10 VP = ₹1</span>
        </div>

        <div className="space-y-2.5 text-sm">
          {Object.entries(STREAM_LABELS).map(([k, label]) => {
            const inrVal = streams[k] ?? 0;
            const vpVal = inrToVPCoins(inrVal);
            return (
              <div key={k} className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 last:border-0 last:pb-0">
                <span className="text-content-secondary text-xs">{label}</span>
                <div className="text-right">
                  <span className="font-mono font-bold text-brand-amber text-xs">+{formatVPCoins(vpVal)}</span>
                  <span className="font-mono text-[10px] text-content-muted ml-1.5">({formatINR(inrVal)})</span>
                </div>
              </div>
            );
          })}
        </div>

        {!isOwner && (
          <button
            onClick={onVerify}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-button border border-dashed border-[var(--border-strong)] py-2.5 text-xs font-semibold text-content-secondary hover:text-content-primary"
          >
            <ScanLine size={14} /> Verify an RC or GST invoice to earn the 20% reviewer share
          </button>
        )}
      </Card>

      {/* ── UPI Withdrawal Receipts ── */}
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-content-primary">
          <Receipt size={15} /> {t('payoutHistory', lang)}
        </h3>
        {payouts.length === 0 && <p className="text-xs text-content-muted">No withdrawals yet.</p>}
        <div className="space-y-2 text-xs">
          {payouts.map((p) => {
            const [color, bg] = STATUS_COLOR[p.status] ?? STATUS_COLOR.queued;
            const inr = Number(p.amount_inr);
            const vp = inrToVPCoins(inr);
            return (
              <div key={p.id} className="flex items-center justify-between rounded-button bg-bg-primary px-3 py-2">
                <div>
                  <div className="font-medium text-content-primary flex items-center gap-1.5">
                    <span className="font-mono font-bold text-brand-emerald">{formatINR(inr)}</span>
                    <span className="font-mono text-[10px] text-brand-amber">({formatVPCoins(vp)})</span>
                  </div>
                  <div className="font-mono text-[10px] text-content-muted">{p.bank_utr ? `UTR ${p.bank_utr}` : 'UTR pending'}</div>
                </div>
                <div className="text-right">
                  <Badge color={color} bg={bg}>
                    {p.status}
                  </Badge>
                  <div className="mt-0.5 text-[10px] text-content-muted">
                    {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
