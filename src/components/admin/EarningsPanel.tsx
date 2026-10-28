'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Loader2, IndianRupee, Eye, Wallet, Send, Trophy, TrendingUp } from 'lucide-react';
import { fetchEarnings, type EarningsSummary } from './adminApi';

function fmt(n: number): string {
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

export function EarningsPanel({ demo, localPreview }: { demo: boolean; localPreview: boolean }) {
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const useDemo = demo || localPreview;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEarnings({ demo: useDemo })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useDemo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-10 text-content-muted">
        <Loader2 size={16} className="mr-2 animate-spin" /> Loading earnings…
      </div>
    );
  }
  if (!data) {
    return (
      <p className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-6 text-center text-xs text-content-muted">
        No earnings data available.
      </p>
    );
  }

  const maxImp = Math.max(1, ...data.daily.map((d) => d.impressions));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KPI
          icon={IndianRupee}
          label="Gross revenue"
          value={fmt(data.grossRevenueInr)}
          accent="text-brand-emerald"
          sub={`CPM ₹${data.cpmInr.toFixed(2)}`}
        />
        <KPI
          icon={Eye}
          label="Ad impressions"
          value={data.totalImpressions.toLocaleString()}
          accent="text-brand-sky"
        />
        <KPI
          icon={Send}
          label="Payouts processed"
          value={fmt(data.payoutsProcessedInr)}
          accent="text-brand-amber"
          sub={`${fmt(data.payoutsQueuedInr)} queued`}
        />
        <KPI
          icon={Wallet}
          label="Wallet liability"
          value={fmt(data.outstandingWalletsInr)}
          accent="text-brand-rose"
          sub={`Net ${fmt(data.netMarginInr)}`}
        />
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-content-primary">7-day ad impressions</h3>
          <span className="flex items-center gap-1 text-[10px] text-content-muted">
            <TrendingUp size={11} /> daily
          </span>
        </div>
        <div className="flex h-32 items-end gap-1.5">
          {data.daily.map((d) => (
            <div
              key={d.date}
              className="group flex-1 cursor-help rounded-t bg-brand-sky/60 transition hover:bg-brand-sky"
              style={{ height: `${Math.max(4, (d.impressions / maxImp) * 100)}%` }}
              title={`${d.date}: ${d.impressions.toLocaleString()} imp · ${fmt(d.inr)}`}
            />
          ))}
        </div>
        <div className="mt-1 flex gap-1.5 text-[9px] text-content-muted">
          {data.daily.map((d) => (
            <div key={d.date} className="flex-1 text-center">
              {d.date.slice(5)}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy size={14} className="text-brand-amber" />
          <h3 className="text-sm font-bold text-content-primary">Top earners (wallet balance)</h3>
        </div>
        <ol className="space-y-1 text-[12px]">
          {data.topEarners.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-bg-primary"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-5 shrink-0 text-right font-mono text-[10px] text-content-muted">
                  {i + 1}.
                </span>
                {p.avatar_url ? (
                  <Image
                    src={p.avatar_url}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full object-cover"
                    unoptimized
                  />
                ) : null}
                <span className="truncate text-content-primary">
                  {p.full_name ?? `@${p.username}`}
                </span>
                <span className="text-[10px] text-content-muted">
                  trust {Math.round(p.trust_score)}
                </span>
              </span>
              <span className="font-mono font-semibold text-brand-emerald">
                {fmt(p.wallet_balance_inr ?? 0)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return useMemo(
    () => (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-3">
        <Icon size={13} className={accent} />
        <div className="mt-1 truncate text-xl font-bold text-content-primary">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-content-muted">{label}</div>
        {sub && <div className="mt-0.5 text-[10px] text-content-secondary">{sub}</div>}
      </div>
    ),
    [Icon, label, value, accent, sub],
  );
}
