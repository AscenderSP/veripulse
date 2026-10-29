'use client';

import { useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Zap,
  Award,
  FileCheck,
  Share2,
  AtSign,
  ShieldCheck,
  Clock,
  TrendingUp,
  Flame,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { cn, timeAgo, formatVPCoins, inrToVPCoins } from '@/lib/utils';
import type { NewsArticle, ReporterDispatch } from '@/lib/types';

export function ReporterProfilePage({
  reporter,
  fromArticle,
  allArticles,
  onBack,
  onOpenArticle,
}: {
  reporter: ReporterDispatch;
  fromArticle?: NewsArticle;
  allArticles: NewsArticle[];
  onBack: () => void;
  onOpenArticle?: (article: NewsArticle, tab?: 'dispatches') => void;
}) {
  // Pull every article this reporter has filed on across the hub, so we can
  // show meaningful aggregates (total dispatches, avg match, cumulative
  // earnings, impact pool) rather than just the one dispatch we were
  // launched from.
  const bylines = useMemo(() => {
    const rows: Array<{ article: NewsArticle; dispatch: ReporterDispatch }> = [];
    for (const article of allArticles) {
      const all = [
        ...(article.leadReporter ? [article.leadReporter] : []),
        ...(article.contributors ?? []),
      ];
      const mine = all.find((d) => d.reporterId === reporter.reporterId);
      if (mine) rows.push({ article, dispatch: mine });
    }
    // most recent first
    return rows.sort(
      (a, b) =>
        new Date(b.dispatch.submittedAt).getTime() -
        new Date(a.dispatch.submittedAt).getTime(),
    );
  }, [allArticles, reporter.reporterId]);

  const stats = useMemo(() => {
    if (bylines.length === 0) {
      return {
        dispatches: 1,
        leadCount: reporter.status === 'lead' ? 1 : 0,
        avgMatch: reporter.matchScorePercent,
        totalEarningsInr: reporter.earningsInr,
        totalPoints: reporter.pointsAwarded,
      };
    }
    const leadCount = bylines.filter((b) => b.dispatch.status === 'lead').length;
    const avgMatch = Math.round(
      bylines.reduce((s, b) => s + b.dispatch.matchScorePercent, 0) / bylines.length,
    );
    const totalEarningsInr = bylines.reduce((s, b) => s + b.dispatch.earningsInr, 0);
    const totalPoints = bylines.reduce((s, b) => s + b.dispatch.pointsAwarded, 0);
    return {
      dispatches: bylines.length,
      leadCount,
      avgMatch,
      totalEarningsInr,
      totalPoints,
    };
  }, [bylines, reporter]);

  const credibilityTier =
    stats.avgMatch >= 90
      ? { label: 'Elite Correspondent', tone: 'emerald' as const }
      : stats.avgMatch >= 75
        ? { label: 'Trusted Reporter', tone: 'emerald' as const }
        : stats.avgMatch >= 60
          ? { label: 'Rising Contributor', tone: 'amber' as const }
          : { label: 'New Contributor', tone: 'amber' as const };

  const share = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      void navigator.clipboard?.writeText(
        `${reporter.reporterName} (@${reporter.reporterUsername}) on VeriPulse\n${url}`,
      );
    } catch {}
  };

  return (
    <div className="space-y-5 section-enter">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <button
          onClick={share}
          className="press-effect flex items-center gap-1 rounded-button border border-[var(--border-subtle)] glass px-2.5 py-1 text-xs text-content-secondary hover:text-content-primary"
        >
          <Share2 size={13} />
          <span>Share profile</span>
        </button>
      </div>

      {/* ── Hero: avatar + identity ── */}
      <Card className="relative overflow-hidden p-4 sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(120% 60% at 100% 0%, rgba(91,191,150,0.14), transparent 60%)',
          }}
        />
        <div className="relative flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-full border-2 border-brand-emerald/60 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reporter.reporterAvatar}
              alt={reporter.reporterName}
              className="h-full w-full object-cover"
            />
            <span className="absolute -right-0.5 -bottom-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-emerald text-[var(--bg-primary,theme(colors.white))]">
              <CheckCircle2 size={14} />
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg sm:text-xl font-extrabold text-content-primary">
                {reporter.reporterName}
              </h2>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-bold',
                  credibilityTier.tone === 'emerald'
                    ? 'border-brand-emerald/40 bg-[var(--brand-emerald-glow)] text-brand-emerald'
                    : 'border-brand-amber/40 bg-[var(--brand-amber-glow)] text-brand-amber',
                )}
              >
                <Award size={10} /> {credibilityTier.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-content-muted">
              <span className="flex items-center gap-1">
                <AtSign size={11} /> {reporter.reporterUsername}
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck size={11} className="text-brand-emerald" />
                {reporter.reporterBadge}
              </span>
              {reporter.pressIdNumber && (
                <span className="flex items-center gap-1 font-mono">
                  <FileCheck size={11} /> {reporter.pressIdNumber}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {reporter.location}
              </span>
            </div>

            <p className="text-[11px] leading-relaxed text-content-secondary">
              C2PA-signed submissions. Press-pass verified. Payouts settled from
              VeriPulse Impact Pool on each dispatch's share of the final 60-word
              consensus summary.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Key stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatTile
          icon={<FileCheck size={14} />}
          label="Dispatches"
          value={String(stats.dispatches)}
          sub={`${stats.leadCount} as lead`}
          tone="emerald"
        />
        <StatTile
          icon={<Zap size={14} />}
          label="Avg Match"
          value={`${stats.avgMatch}%`}
          sub="vs. consensus"
          tone={stats.avgMatch >= 75 ? 'emerald' : 'amber'}
        />
        <StatTile
          icon={<Flame size={14} />}
          label="Impact Points"
          value={stats.totalPoints.toLocaleString()}
          sub="career"
          tone="sky"
        />
        <StatTile
          icon={<TrendingUp size={14} />}
          label="Earned"
          value={formatVPCoins(inrToVPCoins(stats.totalEarningsInr))}
          sub="Impact Pool"
          tone="amber"
        />
      </div>

      {/* ── Current dispatch context ── */}
      {fromArticle && (
        <Card className="p-4 space-y-3 border border-brand-emerald/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-emerald">
              <Flame size={13} /> Filed on this story
            </div>
            <span
              className={cn(
                'rounded-pill px-2 py-0.5 font-mono text-[10px] font-bold',
                reporter.status === 'lead'
                  ? 'bg-[var(--brand-emerald-glow)] text-brand-emerald'
                  : 'bg-bg-elevated text-content-muted',
              )}
            >
              {reporter.status === 'lead' ? 'Lead reporter' : 'Corroborating'}
            </span>
          </div>

          <div className="text-sm font-bold text-content-primary leading-snug line-clamp-2">
            {fromArticle.titles.en}
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <StatMini label="Match" value={`${reporter.matchScorePercent}%`} />
            <StatMini label="Points" value={`+${reporter.pointsAwarded}`} />
            <StatMini
              label="Earned"
              value={formatVPCoins(inrToVPCoins(reporter.earningsInr))}
            />
          </div>

          <div className="rounded-card bg-bg-surface p-3 border border-[var(--border-subtle)] space-y-1">
            <div className="text-[10px] font-bold text-content-muted uppercase">
              Submitted draft
            </div>
            <p className="text-[11px] text-content-secondary leading-relaxed">
              {reporter.originalDraft}
            </p>
          </div>

          <div className="flex items-center justify-between text-[10px] text-content-muted">
            <span className="flex items-center gap-1" suppressHydrationWarning>
              <Clock size={10} /> {timeAgo(reporter.submittedAt)}
            </span>
            <span className="font-mono truncate">
              {reporter.c2paProofHash ?? 'c2pa:verified'}
            </span>
          </div>

          {onOpenArticle && (
            <button
              onClick={() => onOpenArticle(fromArticle, 'dispatches')}
              className="press-effect flex w-full items-center justify-center gap-1.5 rounded-button border border-brand-emerald/50 bg-[var(--brand-emerald-glow)] px-3 py-2 text-[11px] font-bold text-brand-emerald hover:brightness-110"
            >
              See all dispatches on this story <ExternalLink size={11} />
            </button>
          )}
        </Card>
      )}

      {/* ── Recent bylines ── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-content-primary">Recent bylines</h4>
            <p className="text-[11px] text-content-muted">
              Latest dispatches by {reporter.reporterName}
            </p>
          </div>
          <span className="font-mono text-[10px] text-content-muted">
            {bylines.length} total
          </span>
        </div>

        {bylines.length === 0 ? (
          <p className="rounded-card border border-dashed border-[var(--border-subtle)] p-4 text-center text-xs text-content-muted">
            No other dispatches yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {bylines.slice(0, 8).map(({ article, dispatch }) => (
              <li key={`${article.id}:${dispatch.id}`}>
                <button
                  type="button"
                  onClick={() => onOpenArticle?.(article)}
                  className="group block w-full rounded-card border border-[var(--border-subtle)] bg-bg-surface p-3 text-left transition-all hover:border-brand-emerald/50 hover:bg-bg-elevated active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-content-muted">
                        <span className="rounded-pill bg-bg-elevated px-1.5 py-0.5 font-bold text-content-secondary">
                          {article.categoryName}
                        </span>
                        <span
                          className={cn(
                            'rounded-pill px-1.5 py-0.5 font-mono font-bold',
                            dispatch.status === 'lead'
                              ? 'bg-[var(--brand-emerald-glow)] text-brand-emerald'
                              : 'bg-bg-elevated text-content-muted',
                          )}
                        >
                          {dispatch.status === 'lead' ? 'Lead' : 'Co'}
                        </span>
                        <span className="flex items-center gap-1" suppressHydrationWarning>
                          <Clock size={10} /> {timeAgo(dispatch.submittedAt)}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-content-primary line-clamp-2 group-hover:text-brand-emerald transition-colors">
                        {article.titles.en}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-content-muted">
                        <span className="font-mono font-bold text-brand-emerald">
                          {dispatch.matchScorePercent}% match
                        </span>
                        <span className="font-mono font-bold text-brand-amber">
                          {formatVPCoins(inrToVPCoins(dispatch.earningsInr))}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: 'emerald' | 'amber' | 'sky';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-brand-emerald'
      : tone === 'amber'
        ? 'text-brand-amber'
        : 'text-brand-sky';
  return (
    <Card className="p-3 space-y-1">
      <div className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide', toneClass)}>
        {icon} {label}
      </div>
      <div className="font-mono text-lg font-extrabold text-content-primary leading-none">
        {value}
      </div>
      {sub && <div className="text-[10px] text-content-muted">{sub}</div>}
    </Card>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-bg-surface border border-[var(--border-subtle)] p-2 text-center">
      <div className="text-[9px] font-bold uppercase tracking-wide text-content-muted">
        {label}
      </div>
      <div className="font-mono text-sm font-extrabold text-content-primary leading-tight">
        {value}
      </div>
    </div>
  );
}
