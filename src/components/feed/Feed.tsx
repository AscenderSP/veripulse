'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Map, List } from 'lucide-react';
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

export function Feed({ vault = false, area }: { vault?: boolean; area: Area }) {
  const { demo, profile } = useSession();
  const { lang } = useLang();
  const requireAuth = useRequireAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'feed' | 'map'>('feed');
  // demo-mode vote memory so switching votes reverses like the SQL does
  const demoVotes = useRef<Record<string, { vote: VoteAction; weight: number }>>({});

  const scope = vault ? 'vault' : area.scope;

  const load = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
      return;
    }
    const { data } = await getSupabaseBrowserClient().rpc('get_feed', {
      p_scope: scope,
      p_lat: area.lat,
      p_lng: area.lng,
      p_radius_km: 10,
      p_limit: 50,
    });
    const active = ((data as Story[]) ?? []).filter((s) => vault || !isNewsExpired(s.created_at));
    setStories(active);
    setLoading(false);
  }, [scope, vault, area.lat, area.lng]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: live credibility / stage changes; new stories trigger a reload.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabaseBrowserClient();
    const channel = sb
      .channel(`feed:${scope}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stories' }, (payload) => {
        const s = payload.new as Story;
        setStories((list) =>
          list
            .map((x) => (x.id === s.id ? { ...x, ...s } : x))
            .filter((x) => (vault ? x.rollout_stage === 'quarantined' : x.rollout_stage !== 'quarantined')),
        );
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [scope, vault, load]);

  async function handleVote(story: Story, vote: VoteAction): Promise<VoteOutcome> {
    if (demo) return demoVote(story, vote);
    const res = await requireAuth(() =>
      apiFetch('/api/votes/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story_id: story.id, vote }),
      }),
    );
    if (!res) return { error: 'Sign in to vote.' };
    const data = await res.json();
    if (!res.ok) {
      const code = Object.keys(VOTE_ERRORS).find((c) => String(data.error).includes(c));
      return { error: code ? VOTE_ERRORS[code] : 'Vote failed.' };
    }
    return { credibility: Number(data.credibility), stage: data.stage };
  }

  function demoVote(story: Story, vote: VoteAction): VoteOutcome {
    const prev = demoVotes.current[story.id];
    if (prev?.vote === vote) return { credibility: story.credibility_score, stage: story.rollout_stage };
    const dist =
      profile?.home_lat != null && story.lat !== null && story.lng !== null
        ? distanceKm(profile.home_lat, profile.home_lng!, story.lat, story.lng)
        : null;
    const weight = voteWeight(profile?.trust_score ?? 50, dist, false);
    let cred = story.credibility_score;
    if (prev) cred -= 3.5 * voteScalar(prev.vote) * prev.weight;
    cred = nextCredibility(cred, vote, weight);
    const stage = nextStage(story.rollout_stage, cred);
    demoVotes.current[story.id] = { vote, weight };
    setStories((list) =>
      list.map((x) => (x.id === story.id ? { ...x, credibility_score: cred, rollout_stage: stage } : x)),
    );
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
      {/* View Switcher: Feed Cards vs Incident Heatmap */}
      {!vault && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1 text-xs">
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
              <Map size={13} /> {t('incidentHeatmap', lang)}
            </button>
          </div>
        </div>
      )}

      {viewMode === 'map' && !vault ? (
        <IncidentMap stories={stories} />
      ) : (
        <>
          {!vault && <Composer onSubmitted={load} />}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-content-muted">
              <Loader2 className="animate-spin" />
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
              <div key={s.id} className="space-y-4">
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
