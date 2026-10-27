'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Map as MapIcon, List, RefreshCw } from 'lucide-react';
import type { Story, StoryTimelineNode, VoteAction } from '@/lib/types';
import { StoryCard, type VoteOutcome } from './StoryCard';
import { Composer } from './Composer';
import { AdSlot } from './AdSlot';
import { IncidentMap } from './IncidentMap';
import { DEMO_STORIES, DEMO_TIMELINE, isSupabaseConfigured } from '@/lib/demoData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api';
import { nextCredibility, nextStage, voteScalar, voteWeight } from '@/lib/consensus';
import { distanceKm } from '@/lib/utils';
import { useSession, useRequireAuth } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';
import { isNewsExpired } from '@/lib/referenceImages';
import type { Area } from '@/components/shell/AreaSwitcher';

const VOTE_ERRORS: Record<string, string> = {
  RING_RESTRICTED: 'This story is still in a review ring above your tier.',
  CANNOT_VOTE_OWN_STORY: "You can't vote on your own report.",
  AUTH_REQUIRED: 'Sign in to vote.',
};

// Global in-memory cache for instant 0ms tab switching
const feedScopeCache = new Map<string, Story[]>();

function getInitialScopedStories(scope: string, vault: boolean, lat: number | null, lng: number | null): Story[] {
  const cacheKey = `${vault ? 'vault' : scope}:${lat ?? ''}:${lng ?? ''}`;
  if (feedScopeCache.has(cacheKey) && feedScopeCache.get(cacheKey)!.length > 0) {
    return feedScopeCache.get(cacheKey)!;
  }
  return DEMO_STORIES.filter((s) => {
    if (!vault && isNewsExpired(s.created_at)) return false;
    return vault ? s.rollout_stage === 'quarantined' : s.rollout_stage !== 'quarantined';
  }).filter(
    (s) =>
      scope !== 'hyperlocal' ||
      lat === null ||
      (s.lat !== null && s.lng !== null && distanceKm(lat, lng!, s.lat, s.lng) <= 10),
  );
}

function StoryCardSkeleton() {
  return (
    <div className="rounded-card border border-[var(--border-subtle)] bg-bg-surface p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 rounded-full bg-bg-elevated" />
          <div className="h-4 w-24 rounded bg-bg-elevated" />
        </div>
        <div className="h-4 w-12 rounded bg-bg-elevated" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-bg-elevated" />
        <div className="h-3 w-full rounded bg-bg-elevated/70" />
        <div className="h-3 w-5/6 rounded bg-bg-elevated/70" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="h-6 w-28 rounded-full bg-bg-elevated" />
        <div className="h-8 w-20 rounded-button bg-bg-elevated" />
      </div>
    </div>
  );
}

export function Feed({ vault = false, area }: { vault?: boolean; area: Area }) {
  const { demo, profile } = useSession();
  const { lang } = useLang();
  const requireAuth = useRequireAuth();

  const scope = vault ? 'vault' : area.scope;
  const cacheKey = `${scope}:${area.lat ?? ''}:${area.lng ?? ''}`;

  // Initial render: immediately use cache or filtered demo stories (0ms delay)
  const [stories, setStories] = useState<Story[]>(() =>
    getInitialScopedStories(scope, vault, area.lat, area.lng),
  );
  const [loading, setLoading] = useState(() => !feedScopeCache.has(cacheKey) && stories.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'feed' | 'map'>('feed');
  const [highlightedStoryId, setHighlightedStoryId] = useState<string | null>(null);

  const handleSelectIncidentStory = useCallback((story: Story) => {
    setViewMode('feed');
    setHighlightedStoryId(story.id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`story-${story.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    window.setTimeout(() => setHighlightedStoryId(null), 2200);
  }, []);

  // demo-mode vote memory so switching votes reverses like the SQL does
  const demoVotes = useRef<Record<string, { vote: VoteAction; weight: number }>>({});

  const load = useCallback(async () => {
    // If we have no cached stories, show skeleton
    if (stories.length === 0) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    if (!isSupabaseConfigured()) {
      const inScope = DEMO_STORIES.filter((s) => {
        // Stories older than 12 hours expire from active feeds (unless vault)
        if (!vault && isNewsExpired(s.created_at)) return false;
        return vault ? s.rollout_stage === 'quarantined' : s.rollout_stage !== 'quarantined';
      }).filter(
        (s) =>
          scope !== 'hyperlocal' ||
          area.lat === null ||
          (s.lat !== null && s.lng !== null && distanceKm(area.lat, area.lng!, s.lat, s.lng) <= 10),
      );
      setStories(inScope);
      feedScopeCache.set(cacheKey, inScope);
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const { data } = await getSupabaseBrowserClient().rpc('get_feed', {
        p_scope: scope,
        p_lat: area.lat,
        p_lng: area.lng,
        p_radius_km: 10,
        p_limit: 50,
      });
      const active = ((data as Story[]) ?? []).filter((s) => vault || !isNewsExpired(s.created_at));
      setStories(active);
      feedScopeCache.set(cacheKey, active);
    } catch {
      // Retain existing cached stories on network hiccup
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [scope, vault, area.lat, area.lng, cacheKey, stories.length]);

  useEffect(() => {
    // On scope change, check cache first
    if (feedScopeCache.has(cacheKey)) {
      setStories(feedScopeCache.get(cacheKey)!);
      setLoading(false);
    }
    load();
  }, [scope, area.lat, area.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: live credibility / stage changes; new stories trigger a reload.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabaseBrowserClient();
    const channel = sb
      .channel(`feed:${scope}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stories' }, (payload) => {
        const s = payload.new as Story;
        setStories((list) => {
          const updated = list
            .map((x) => (x.id === s.id ? { ...x, ...s } : x))
            .filter((x) => (vault ? x.rollout_stage === 'quarantined' : x.rollout_stage !== 'quarantined'));
          feedScopeCache.set(cacheKey, updated);
          return updated;
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [scope, vault, load, cacheKey]);

  async function handleVote(story: Story, vote: VoteAction): Promise<VoteOutcome> {
    if (demo) return demoVote(story, vote);
    const res = await requireAuth(() =>
      apiFetch('/api/votes/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story_id: story.id, vote }),
      }),
    );
    if (!res || !res.ok) {
      const err = await res?.json().catch(() => ({}));
      const msg = VOTE_ERRORS[err?.error] ?? 'Vote rejected.';
      return { error: msg };
    }
    const data = await res.json();
    setStories((list) => {
      const updated = list.map((x) =>
        x.id === story.id
          ? { ...x, credibility_score: data.credibility, rollout_stage: data.stage }
          : x,
      );
      feedScopeCache.set(cacheKey, updated);
      return updated;
    });
    return { credibility: data.credibility, stage: data.stage };
  }

  function demoVote(story: Story, vote: VoteAction): VoteOutcome {
    const prev = demoVotes.current[story.id];
    if (prev?.vote === vote) return { credibility: story.credibility_score, stage: story.rollout_stage };

    const weight = voteWeight(profile?.trust_score ?? 80, null, profile?.is_ownership_verified ?? false);
    let cred = story.credibility_score;
    if (prev) cred -= 3.5 * voteScalar(prev.vote) * prev.weight;
    cred = nextCredibility(cred, vote, weight);
    const stage = nextStage(story.rollout_stage, cred);
    demoVotes.current[story.id] = { vote, weight };
    setStories((list) => {
      const updated = list.map((x) => (x.id === story.id ? { ...x, credibility_score: cred, rollout_stage: stage } : x));
      feedScopeCache.set(cacheKey, updated);
      return updated;
    });
    return { credibility: cred, stage };
  }

  async function loadTimeline(storyId: string): Promise<StoryTimelineNode[]> {
    if (!isSupabaseConfigured()) return DEMO_TIMELINE[storyId] ?? [];
    const sb = getSupabaseBrowserClient();
    sb.rpc('mark_story_read', { p_story_id: storyId }).then(() => undefined);
    const { data } = await sb.rpc('get_story_timeline', { p_story_id: storyId });
    return (data as StoryTimelineNode[]) ?? [];
  }

  return (
    <div className="space-y-4">
      {/* View Switcher: Feed Cards vs Incident Heatmap. Sticky right below
          the global top bar so the user can toggle without scrolling to
          the top; sits at a lower z-index than the top bar so it slides
          under it as the user scrolls. */}
      {!vault && (
        <div
          className="sticky z-20 -mx-4 flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-bg-primary px-4 py-2 backdrop-blur-md lg:!top-0"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}
        >
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setViewMode('feed')}
              className={`flex items-center gap-1.5 rounded-pill px-3 py-1 font-semibold transition-all ${
                viewMode === 'feed'
                  ? 'bg-brand-emerald text-[#04110b]'
                  : 'bg-bg-elevated text-content-muted hover:text-content-primary'
              }`}
            >
              <List size={13} /> {t('liveCircleFeed', lang)}
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 rounded-pill px-3 py-1 font-semibold transition-all ${
                viewMode === 'map'
                  ? 'bg-brand-emerald text-[#04110b]'
                  : 'bg-bg-elevated text-content-muted hover:text-content-primary'
              }`}
            >
              <MapIcon size={13} /> {t('incidentHeatmap', lang)}
            </button>
          </div>

          {isRefreshing && (
            <div className="flex items-center gap-1 text-[11px] text-content-muted font-mono animate-pulse">
              <RefreshCw size={11} className="animate-spin text-brand-emerald" />
              <span>Updating...</span>
            </div>
          )}
        </div>
      )}

      {viewMode === 'map' && !vault ? (
        <IncidentMap stories={stories} onSelectStory={handleSelectIncidentStory} />
      ) : (
        <>
          {!vault && <Composer onSubmitted={load} />}

          {loading ? (
            <div className="space-y-3">
              <StoryCardSkeleton />
              <StoryCardSkeleton />
            </div>
          ) : stories.length === 0 ? (
            <div className="rounded-card border border-dashed border-[var(--border-subtle)] py-16 text-center text-sm text-content-muted">
              {vault
                ? t('noQuarantined', lang)
                : scope === 'hyperlocal'
                  ? t('nothingNearby', lang)
                  : t('noStoriesYet', lang)}
            </div>
          ) : (
            stories.map((s, i) => (
              <div
                key={s.id}
                id={`story-${s.id}`}
                className={`space-y-4 scroll-mt-24 rounded-card transition-shadow duration-500 ${
                  highlightedStoryId === s.id ? 'ring-2 ring-brand-emerald/70 shadow-glow-emerald' : ''
                }`}
              >
                <StoryCard story={s} onVote={handleVote} loadTimeline={loadTimeline} />
                {/* AdSense fluid unit every 6th card (§4.2) */}
                {(i + 1) % 6 === 0 && <AdSlot />}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
