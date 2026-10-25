'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet as WalletIcon, ArrowDownToLine, Loader2, Receipt, TrendingUp, ScanLine, Pencil } from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui/primitives';
import { formatINR } from '@/lib/utils';
import type { PayoutRequest } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';

// Display copy only — the limits are enforced inside request_upi_payout.
const MIN = 100;
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

export function Wallet({ onVerify }: { onVerify: () => void }) {
  const { demo, user, profile, setAuthOpen, refreshProfile, patchDemoProfile } = useSession();
  const { lang } = useLang();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [payouts, setPayouts] = useState(demo ? DEMO_PAYOUTS : []);
  const [streams, setStreams] = useState<Record<string, number>>(demo ? DEMO_STREAMS : {});
  const [editingUpi, setEditingUpi] = useState(false);
  const [upi, setUpi] = useState('');

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
        <p className="text-sm text-content-secondary">Sign in to see your earnings and withdraw to UPI.</p>
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

  const balance = Number(profile.wallet_balance_inr);
  const trust = Number(profile.trust_score);
  const amt = Number(amount);
  const eligible = trust >= MIN_TRUST && Boolean(profile.upi_id);
  const canWithdraw = eligible && amt >= MIN && amt <= balance;

  async function saveUpi() {
    const v = upi.trim();
    if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(v)) {
      setMsg('That doesn’t look like a UPI ID (name@bank).');
      return;
    }
    if (demo) patchDemoProfile({ upi_id: v });
    else {
      const { error } = await getSupabaseBrowserClient().from('profiles').update({ upi_id: v }).eq('id', profile!.id);
      if (error) return setMsg(error.message);
      await refreshProfile();
    }
    setEditingUpi(false);
    setMsg(null);
  }

  async function withdraw() {
    setBusy(true);
    setMsg(null);
    try {
      const idemKey = `wd_${Date.now()}_${crypto.randomUUID()}`;
      if (demo) {
        await new Promise((r) => setTimeout(r, 1100));
        patchDemoProfile({ wallet_balance_inr: balance - amt });
        setPayouts((p) => [
          { id: idemKey, amount_inr: amt, bank_utr: null, status: 'processing', created_at: new Date().toISOString() },
          ...p,
        ]);
        setMsg(`Demo: ₹${amt} sent to ${profile!.upi_id}. UTR arrives on settlement.`);
      } else {
        const res = await apiFetch('/api/payouts/upi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_inr: amt, idempotency_key: idemKey }),
        });
        const data = await res.json();
        if (!res.ok && res.status !== 202) throw new Error(data.error ?? 'Payout failed');
        setMsg(`Payout ${data.status}. ${data.utr ? 'UTR: ' + data.utr : 'UTR will appear when the bank settles.'}`);
        await Promise.all([refreshProfile(), loadLive()]);
      }
      setAmount('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Payout failed');
    } finally {
      setBusy(false);
    }
  }

  const isOwner = profile.badge === 'Verified Owner' || profile.tier !== 'public';

  return (
    <div className="space-y-4 stagger-children">
      {/* balance */}
      <Card glow className="relative overflow-hidden p-5 orb-bg">
        <div className="relative z-10 flex items-center gap-2 text-xs font-medium text-content-muted">
          <WalletIcon size={14} /> {t('walletBalance', lang)}
        </div>
        <div className="relative z-10 mt-1 font-mono text-3xl font-bold gradient-text stat-value">{formatINR(balance)}</div>
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
          <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
            {t('trustScore', lang)} {trust.toFixed(1)}%
          </Badge>
          <Badge>{profile.badge}</Badge>
          {editingUpi ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                placeholder="name@bank"
                className="w-36 rounded-pill border border-[var(--border-strong)] bg-bg-primary px-2.5 py-1 text-xs text-content-primary focus:outline-none"
              />
              <button onClick={saveUpi} className="text-xs font-semibold text-brand-emerald">
                {lang === 'bn' ? 'সংরক্ষণ' : lang === 'hi' ? 'सहेजें' : 'Save'}
              </button>
            </span>
          ) : (
            <button
              onClick={() => {
                setUpi(profile.upi_id ?? '');
                setEditingUpi(true);
              }}
            >
              <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
                {profile.upi_id ? `UPI ${profile.upi_id}` : (lang === 'bn' ? 'ইউপিআই আইডি যোগ করুন' : lang === 'hi' ? 'यूपीआई आईडी जोड़ें' : 'Add UPI ID')} <Pencil size={11} />
              </Badge>
            </button>
          )}
        </div>
      </Card>

      {/* withdraw */}
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-content-primary">
          <ArrowDownToLine size={15} /> {t('instantWithdrawal', lang)}
        </h3>
        {trust < MIN_TRUST && (
          <div className="mb-3 rounded-button bg-[rgba(245,158,11,0.12)] p-2.5 text-xs text-brand-amber">
            {lang === 'bn' ? `উত্তোলন ${MIN_TRUST}% বিশ্বাসযোগ্যতায় খুলবে। আপনার স্কোর ${trust.toFixed(1)}%।` : lang === 'hi' ? `निकासी ${MIN_TRUST}% विश्वास पर अनलॉक होगी। आपका स्कोर ${trust.toFixed(1)}% है।` : `Payouts unlock at ${MIN_TRUST}% trust. You're at ${trust.toFixed(1)}%.`}
          </div>
        )}
        {!profile.upi_id && (
          <div className="mb-3 rounded-button bg-[rgba(14,165,233,0.12)] p-2.5 text-xs text-brand-sky">
            {lang === 'bn' ? 'টাকা তুলতে উপরে একটি ইউপিআই আইডি যুক্ত করুন।' : lang === 'hi' ? 'निकासी के लिए ऊपर एक यूपीआई आईडी जोड़ें।' : 'Add a UPI ID above to withdraw.'}
          </div>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted">₹</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder={`Min ${MIN}`}
              className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary py-2.5 pl-7 pr-3 text-sm text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>
          <Button onClick={withdraw} disabled={!canWithdraw || busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : t('withdrawUpi', lang)}
          </Button>
        </div>
        {msg && <p className="mt-2 text-xs text-content-secondary">{msg}</p>}
      </Card>

      {/* earnings breakdown */}
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-content-primary">
          <TrendingUp size={15} /> {t('earningsBreakdown', lang)}
        </h3>
        <div className="space-y-2.5 text-sm">
          {Object.entries(STREAM_LABELS).map(([k, label]) => (
            <Stream key={k} label={label} value={streams[k] ?? 0} />
          ))}
        </div>
        {!isOwner && (
          <button
            onClick={onVerify}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-button border border-dashed border-[var(--border-strong)] py-2.5 text-xs font-semibold text-content-secondary hover:text-content-primary"
          >
            <ScanLine size={14} /> {lang === 'bn' ? 'রিভিউয়ারের ২০% অংশ পেতে আরসি বা জিএসটি ইনভয়েস যাচাই করুন' : lang === 'hi' ? '20% समीक्षक हिस्सेदारी अर्जित करने के लिए आरसी या जीएसटी चालान सत्यापित करें' : 'Verify an RC or GST invoice to earn the 20% reviewer share'}
          </button>
        )}
      </Card>

      {/* receipts */}
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-content-primary">
          <Receipt size={15} /> {t('payoutHistory', lang)}
        </h3>
        {payouts.length === 0 && <p className="text-xs text-content-muted">No withdrawals yet.</p>}
        <div className="space-y-2 text-xs">
          {payouts.map((p) => {
            const [color, bg] = STATUS_COLOR[p.status] ?? STATUS_COLOR.queued;
            return (
              <div key={p.id} className="flex items-center justify-between rounded-button bg-bg-primary px-3 py-2">
                <div>
                  <div className="font-medium text-content-primary">{formatINR(Number(p.amount_inr))}</div>
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

function Stream({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 last:border-0 last:pb-0">
      <span className="text-content-secondary">{label}</span>
      <span className="font-mono font-semibold text-brand-emerald">{formatINR(value)}</span>
    </div>
  );
}
