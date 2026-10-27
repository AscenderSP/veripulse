'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trophy, Flame, CheckCircle2, CircleDollarSign } from 'lucide-react';
import type { Profile } from '@/lib/types';
import { fetchLeaderboard, type LeaderboardPayload } from './adminApi';

export function LeaderboardPanel({
  demo,
  localPreview,
}: {
  demo: boolean;
  localPreview: boolean;
}) {
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const useDemo = demo || localPreview;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard({ demo: useDemo })
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
        <Loader2 size={16} className="mr-2 animate-spin" /> Loading leaderboard…
      </div>
    );
  }
  if (!data) {
    return (
      <p className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-6 text-center text-xs text-content-muted">
        No leaderboard data.
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Column
        icon={Flame}
        accent="text-brand-rose"
        title="Highest trust"
        rows={data.byTrust.slice(0, 8)}
        valueOf={(p) => Math.round(p.trust_score).toString()}
      />
      <Column
        icon={CheckCircle2}
        accent="text-brand-emerald"
        title="Most correct votes"
        rows={data.byVotes.slice(0, 8)}
        valueOf={(p) => (p.correct_votes ?? 0).toString()}
      />
      <Column
        icon={CircleDollarSign}
        accent="text-brand-amber"
        title="Top VPcoin wallets"
        rows={data.byEarnings.slice(0, 8)}
        valueOf={(p) => `₹${p.wallet_balance_inr.toFixed(0)}`}
      />
    </div>
  );
}

function Column({
  icon: Icon,
  accent,
  title,
  rows,
  valueOf,
}: {
  icon: React.ElementType;
  accent: string;
  title: string;
  rows: Profile[];
  valueOf: (p: Profile) => string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} className={accent} />
        <h3 className="text-sm font-bold text-content-primary">{title}</h3>
      </div>
      <ol className="space-y-1">
        {rows.map((p, i) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-bg-primary"
          >
            <span className="flex items-center gap-2 truncate">
              <span className="w-5 shrink-0 text-right font-mono text-[10px] text-content-muted">
                {i + 1}.
              </span>
              {i === 0 && <Trophy size={11} className="shrink-0 text-brand-amber" />}
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              ) : null}
              <span className="truncate text-[12px] text-content-primary">
                {p.full_name ?? `@${p.username}`}
              </span>
            </span>
            <span className="font-mono text-[12px] font-semibold text-content-primary">
              {valueOf(p)}
            </span>
          </li>
        ))}
        {rows.length === 0 && (
          <p className="py-6 text-center text-xs text-content-muted">No data.</p>
        )}
      </ol>
    </div>
  );
}
