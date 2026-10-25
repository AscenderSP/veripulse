'use client';

import { useEffect, useState } from 'react';
import {
  Trophy, Activity, Rss, TrendingUp, Target, Flame, Sparkles, ArrowRight,
  Bell, ExternalLink, Clock, Zap, ChevronRight, Newspaper, Star,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_LEADERBOARD, DEMO_BOUNTIES, DEMO_STORIES, DEMO_NEWS_ARTICLES, isSupabaseConfigured } from '@/lib/demoData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatINR, timeAgo } from '@/lib/utils';
import type { UserTier } from '@/lib/types';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';
import type { LiveNewsItem } from '@/app/api/news/live/route';

type Section = 'feed' | 'news' | 'vault' | 'compare' | 'earn' | 'scanner' | 'passport' | 'sentinel' | 'wallet' | 'profile' | 'compose';

interface Leader {
  username: string;
  trust: number;
  correct: number;
  tier: UserTier;
}

interface Stats {
  distributed_month_inr: number;
  stories_today: number;
  merged_today: number;
  last_crawl_at: string | null;
  last_crawl_ingested: number | null;
  last_crawl_merged: number | null;
  last_crawl_errors: number | null;
  last_crawl_sources: { name: string; ok: boolean }[] | null;
}

const DEMO_STATS: Stats = {
  distributed_month_inr: 184230,
  stories_today: 1284,
  merged_today: 37,
  last_crawl_at: new Date(Date.now() - 12 * 60000).toISOString(),
  last_crawl_ingested: 9,
  last_crawl_merged: 3,
  last_crawl_errors: 0,
  last_crawl_sources: [
    { name: 'Google News RSS', ok: true },
    { name: 'PTI wire', ok: true },
    { name: 'Reuters India', ok: true },
  ],
};

const CRAWL_INTERVAL_MIN = 30;

interface RightRailProps {
  onNavigate?: (section: Section) => void;
}

export function RightRail({ onNavigate }: RightRailProps) {
  const [leaders, setLeaders] = useState<Leader[]>(isSupabaseConfigured() ? [] : DEMO_LEADERBOARD);
  const [stats, setStats] = useState<Stats | null>(isSupabaseConfigured() ? null : DEMO_STATS);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabaseBrowserClient();
    const load = async () => {
      const [{ data: top }, { data: st }] = await Promise.all([
        sb
          .from('profiles')
          .select('username, trust_score, correct_votes, tier')
          .order('trust_score', { ascending: false })
          .order('correct_votes', { ascending: false })
          .limit(5),
        sb.rpc('platform_stats'),
      ]);
      setLeaders(
        (top ?? []).map((p) => ({
          username: p.username,
          trust: Number(p.trust_score),
          correct: p.correct_votes,
          tier: p.tier,
        })),
      );
      const row = Array.isArray(st) ? st[0] : st;
      if (row) setStats({ ...row, distributed_month_inr: Number(row.distributed_month_inr) });
    };
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-4 stagger-children">
      <LiveNotifications onNavigate={onNavigate} />
      <LiveNewsTicker />
      <ActiveBountiesWidget onNavigate={onNavigate} />
      <Leaderboard leaders={leaders} onNavigate={onNavigate} />
      <RevenueTicker total={stats?.distributed_month_inr ?? null} onNavigate={onNavigate} />
      <CrawlerMonitor stats={stats} />
    </div>
  );
}

/* ── Live Notifications ── */

interface NotificationItem {
  id: string;
  type: 'submission' | 'news' | 'review' | 'bounty';
  title: string;
  detail: string;
  time: string;
  section: Section;
  articleId?: string;
}

function buildNotifications(): NotificationItem[] {
  const items: NotificationItem[] = [];

  DEMO_STORIES.slice(0, 3).forEach((s) => {
    items.push({
      id: `notif-story-${s.id}`,
      type: 'submission',
      title: s.titles.en,
      detail: `${s.source} · ${s.location_name.split(',')[0]}`,
      time: s.created_at,
      section: 'feed',
      articleId: s.id,
    });
  });

  DEMO_NEWS_ARTICLES.slice(0, 3).forEach((a) => {
    items.push({
      id: `notif-news-${a.id}`,
      type: 'news',
      title: a.titles.en,
      detail: `${a.source} · ${a.credibilityScore}% credibility`,
      time: a.publishedAt,
      section: 'news',
      articleId: a.id,
    });
  });

  DEMO_BOUNTIES.filter((b) => b.status === 'open').slice(0, 2).forEach((b) => {
    items.push({
      id: `notif-bounty-${b.id}`,
      type: 'bounty',
      title: b.title,
      detail: `+₹${b.rewardInr} reward`,
      time: b.createdAt,
      section: 'earn',
      articleId: b.id,
    });
  });

  return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);
}

function LiveNotifications({ onNavigate }: { onNavigate?: (s: Section) => void }) {
  const { lang } = useLang();
  const [notifications] = useState<NotificationItem[]>(buildNotifications);

  const iconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'submission': return <Zap size={12} className="text-brand-amber" />;
      case 'news': return <Newspaper size={12} className="text-brand-sky" />;
      case 'review': return <Star size={12} className="text-brand-violet" />;
      case 'bounty': return <Target size={12} className="text-brand-emerald" />;
    }
  };

  const labelForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'submission': return 'New Report';
      case 'news': return 'Wire Update';
      case 'review': return 'Review';
      case 'bounty': return 'Bounty';
    }
  };

  return (
    <Card glow className="p-4 orb-bg">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider gradient-text">
            <Bell size={14} className="text-brand-amber" /> {t('liveNotifications', lang)}
          </h3>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-emerald opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-emerald" />
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => onNavigate?.(n.section)}
              className="press-effect w-full rounded-button glass p-2.5 text-left transition-all duration-200 hover:bg-bg-elevated/30 group"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{iconForType(n.type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-content-muted">{labelForType(n.type)}</span>
                    <span className="text-[9px] text-content-muted">· {timeAgo(n.time)}</span>
                  </div>
                  <span className="font-medium text-content-primary line-clamp-1 group-hover:text-brand-emerald transition-colors">{n.title}</span>
                  <span className="text-[10px] text-content-muted line-clamp-1">{n.detail}</span>
                </div>
                <ChevronRight size={12} className="shrink-0 mt-1 text-content-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ── Live News Ticker (external API) ── */

function LiveNewsTicker() {
  const [news, setNews] = useState<LiveNewsItem[]>([]);
  const [source, setSource] = useState<string>('');
  const { lang } = useLang();

  useEffect(() => {
    fetch('/api/news/live')
      .then((r) => r.json())
      .then((data) => {
        setNews(data.items?.slice(0, 5) ?? []);
        setSource(data.source ?? '');
      })
      .catch(() => {});
  }, []);

  if (news.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-primary">
          <Rss size={14} className="text-brand-rose" /> {t('liveWire', lang)}
        </h3>
        <span className="text-[9px] text-content-muted font-mono uppercase">{source === 'demo' ? 'curated' : 'live'}</span>
      </div>
      <div className="space-y-2 text-xs">
        {news.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="press-effect flex items-start gap-2.5 rounded-button p-2 transition-all duration-200 hover:bg-glass-bg group"
          >
            {item.image && (
              <img
                src={item.image}
                alt=""
                className="h-10 w-10 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <span className="font-medium text-content-primary line-clamp-2 group-hover:text-brand-sky transition-colors leading-snug">{item.title}</span>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-content-muted">
                <span className="truncate">{item.source}</span>
                <span>·</span>
                <Clock size={9} className="shrink-0" />
                <span>{timeAgo(item.publishedAt)}</span>
              </div>
            </div>
            <ExternalLink size={10} className="shrink-0 mt-1 text-content-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </Card>
  );
}

/* ── Active Bounties (clickable) ── */

function ActiveBountiesWidget({ onNavigate }: { onNavigate?: (s: Section) => void }) {
  const { lang } = useLang();
  const openBounties = DEMO_BOUNTIES.filter((b) => b.status === 'open').slice(0, 3);

  return (
    <Card glow className="p-4 orb-bg">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider gradient-text">
            <Target size={14} className="text-brand-emerald" /> {t('openBounties', lang)}
          </h3>
          <button
            onClick={() => onNavigate?.('earn')}
            className="text-[10px] font-semibold text-brand-emerald hover:text-brand-emerald/80 transition-colors flex items-center gap-0.5"
          >
            {t('viewAll', lang)} <ArrowRight size={10} />
          </button>
        </div>

        <div className="space-y-2 text-xs">
          {openBounties.map((b) => (
            <button
              key={b.id}
              onClick={() => onNavigate?.('earn')}
              className="press-effect w-full rounded-button glass p-2.5 space-y-1 transition-all duration-200 hover:bg-bg-elevated/30 text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-content-primary line-clamp-1 group-hover:text-brand-emerald transition-colors">{b.title}</span>
                <span className="font-mono font-black text-brand-emerald shrink-0 ml-1" style={{ textShadow: '0 0 8px var(--brand-emerald-glow)' }}>
                  +₹{b.rewardInr}
                </span>
              </div>
              <div className="text-[10px] text-content-muted flex items-center justify-between">
                <span>{b.location ? b.location.split(',')[0] : t('onlineCheck', lang)}</span>
                <span className="text-brand-sky font-semibold">{t('available', lang)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ── Leaderboard (clickable) ── */

function Leaderboard({ leaders, onNavigate }: { leaders: Leader[]; onNavigate?: (s: Section) => void }) {
  const { lang } = useLang();
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-content-primary">
          <Trophy size={15} className="text-brand-amber" style={{ filter: 'drop-shadow(0 0 4px var(--brand-amber))' }} /> {t('sentinelLeaderboard', lang)}
        </h3>
        <button
          onClick={() => onNavigate?.('sentinel')}
          className="text-[10px] font-semibold text-brand-sky hover:text-brand-sky/80 transition-colors flex items-center gap-0.5"
        >
          {t('viewAll', lang)} <ArrowRight size={10} />
        </button>
      </div>
      {leaders.length === 0 && <p className="text-xs text-content-muted">{t('noSentinels', lang)}</p>}
      <div className="space-y-2">
        {leaders.map((u, i) => (
          <button
            key={u.username}
            onClick={() => onNavigate?.('sentinel')}
            className="press-effect w-full flex items-center gap-3 rounded-button p-1.5 text-sm transition-all duration-200 hover:bg-glass-bg text-left group"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-center font-mono text-xs font-bold"
              style={{
                background: i === 0 ? 'var(--brand-amber)' : i === 1 ? 'var(--border-strong)' : i === 2 ? 'rgba(205,127,50,0.3)' : 'var(--glass-bg)',
                color: i < 2 ? '#04110b' : 'var(--text-secondary)',
              }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-content-primary group-hover:text-brand-amber transition-colors">@{u.username}</div>
              <div className="text-[10px] text-content-muted">{u.correct} {t('accurateChecks', lang)}</div>
            </div>
            <Badge
              color={u.tier === 'sentinel_t1' ? 'var(--brand-emerald)' : 'var(--brand-sky)'}
              bg={u.tier === 'sentinel_t1' ? 'var(--brand-emerald-glow)' : 'rgba(14,165,233,0.12)'}
            >
              {u.trust.toFixed(1)}%
            </Badge>
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ── Revenue Ticker (clickable) ── */

function RevenueTicker({ total, onNavigate }: { total: number | null; onNavigate?: (s: Section) => void }) {
  const { lang } = useLang();
  return (
    <Card className="p-4 orb-bg">
      <div className="relative z-10">
        <button
          onClick={() => onNavigate?.('wallet')}
          className="w-full text-left group"
        >
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-content-primary group-hover:text-brand-emerald transition-colors">
            <TrendingUp size={15} className="text-brand-emerald" /> {t('distributedThisMonth', lang)}
          </h3>
          <div className="font-mono text-2xl font-bold gradient-text stat-value">{total === null ? '—' : formatINR(total)}</div>
          <p className="mt-1 text-[11px] text-content-muted">{t('instantUpiPayouts', lang)}</p>
        </button>
        <div className="mt-3 space-y-1.5 text-[11px]">
          <Split label="Founder" pct={70} color="var(--brand-emerald)" />
          <Split label="Verified reviewers" pct={20} color="var(--brand-sky)" />
          <Split label="Sentinel pool" pct={10} color="var(--brand-violet)" />
        </div>
      </div>
    </Card>
  );
}

function Split({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-content-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-bg-elevated/50">
        <span
          className="block h-full rounded-pill transition-all duration-700 ease-spring-smooth"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="font-mono text-content-secondary">{pct}%</span>
    </div>
  );
}

/* ── Crawler Monitor ── */

function CrawlerMonitor({ stats }: { stats: Stats | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const last = stats?.last_crawl_at ? new Date(stats.last_crawl_at).getTime() : null;
  const healthy = last !== null && Date.now() - last < CRAWL_INTERVAL_MIN * 2 * 60000;
  const nextIn = last !== null ? Math.max(0, Math.round((last + CRAWL_INTERVAL_MIN * 60000 - Date.now()) / 60000)) : null;

  return (
    <Card className="p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-content-primary">
        <Rss size={15} className="text-brand-sky" style={{ filter: 'drop-shadow(0 0 4px var(--brand-sky))' }} /> Cold-Start Crawler
      </h3>
      <div className="flex items-center gap-2 text-xs text-content-secondary">
        <span className={`h-2 w-2 rounded-full ${healthy ? 'animate-pulse-dot bg-brand-emerald glow-emerald' : 'bg-brand-amber'}`} />
        <span suppressHydrationWarning>
          {!mounted
            ? 'Running · live feeds healthy'
            : last === null
              ? 'No runs recorded yet'
              : healthy
                ? `Running · last sweep ${timeAgo(stats!.last_crawl_at!)} ago${nextIn !== null ? ` · next in ${nextIn} min` : ''}`
                : `Stale · last sweep ${timeAgo(stats!.last_crawl_at!)} ago`}
        </span>
      </div>
      {stats?.last_crawl_sources && (
        <div className="mt-3 space-y-2 text-[11px] text-content-muted">
          {stats.last_crawl_sources.map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-button p-1.5 transition-colors hover:bg-glass-bg">
              <span>{s.name}</span>
              <span className={s.ok ? 'text-brand-emerald' : 'text-brand-rose'}>{s.ok ? '● live' : '○ down'}</span>
            </div>
          ))}
        </div>
      )}
      {stats && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-content-muted">
          <Activity size={12} /> {stats.stories_today.toLocaleString('en-IN')} new today ·{' '}
          {stats.merged_today} merged
        </div>
      )}
    </Card>
  );
}
