'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Map as MapIcon,
  List,
  RefreshCw,
  Check,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Layers,
  MapPin,
  Globe2,
} from 'lucide-react';
import { useListboxKeys } from '@/hooks/useListboxKeys';
import type { Story, StoryTimelineNode, VoteAction } from '@/lib/types';
import { StoryCard, type VoteOutcome } from './StoryCard';
import { AdSlot } from './AdSlot';
import { IncidentMap } from './IncidentMap';
import { DEMO_STORIES, DEMO_TIMELINE, isSupabaseConfigured } from '@/lib/demoData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api';
import { nextCredibility, nextStage, voteScalar, voteWeight } from '@/lib/consensus';
import { cn, distanceKm } from '@/lib/utils';
import { useSession, useRequireAuth } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';
import { isNewsExpired } from '@/lib/referenceImages';
import type { Area } from '@/components/shell/AreaSwitcher';
import { GLOBAL_AREA } from '@/components/shell/AreaSwitcher';
import { getCurrentCoords } from '@/lib/nativeHardware';
import { onRefresh } from '@/lib/refreshBus';
import { SkeletonList, EmptyState } from '@/components/ui/Skeleton';

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

export function Feed({
  vault = false,
  area,
  onAreaChange,
}: {
  vault?: boolean;
  area: Area;
  onAreaChange?: (a: Area) => void;
}) {
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'hoaxes'>('all');
  // Location chip can be "global", "near_me" (= hyperlocal in the Area
  // state) or a specific location_name string.
  const [locationName, setLocationName] = useState<string | null>(null);
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

  // Pull-to-refresh in the mobile shell triggers a reload.
  useEffect(() => onRefresh('feed', load), [load]);

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

  // Distinct locations represented in the current fetch, ranked by
  // frequency. Powers the Location chip-dropdown.
  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stories) {
      const name = (s.location_name ?? '').trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [stories]);

  // Apply the status chip-dropdown filter. "Verified" = any story whose
  // consensus has resolved to the public rollout stage. "Hoaxes" =
  // quarantined (admin takedowns, consensus hoax).
  const statusCounts = useMemo(() => {
    const all = stories.length;
    const verified = stories.filter((s) => s.rollout_stage === 'public').length;
    const hoaxes = stories.filter(
      (s) => s.rollout_stage === 'quarantined' || s.admin_taken_down,
    ).length;
    return { all, verified, hoaxes };
  }, [stories]);

  const visibleStories = useMemo(() => {
    let list = stories;
    if (!vault && statusFilter === 'verified')
      list = list.filter((s) => s.rollout_stage === 'public');
    else if (!vault && statusFilter === 'hoaxes')
      list = list.filter((s) => s.rollout_stage === 'quarantined' || s.admin_taken_down);
    if (locationName) list = list.filter((s) => (s.location_name ?? '') === locationName);
    return list;
  }, [stories, statusFilter, locationName, vault]);

  const nearMe = area.scope === 'hyperlocal';
  async function pickNearMe() {
    const c = await getCurrentCoords();
    if (!c) return;
    setLocationName(null);
    onAreaChange?.({ scope: 'hyperlocal', lat: c.lat, lng: c.lng });
  }
  function pickGlobal() {
    setLocationName(null);
    onAreaChange?.(GLOBAL_AREA);
  }
  function pickLocation(name: string) {
    setLocationName(name);
    onAreaChange?.(GLOBAL_AREA);
  }

  return (
    <div className="space-y-4">
      {/* Chip filter bar: View (list / heatmap) + Status (All / Verified /
          Hoaxes). Matches the floating-pill chrome used in News Hub and
          Product Hub so every scope shares a visual pattern. */}
      {!vault && (
        <FeedChipBar
          viewMode={viewMode}
          setViewMode={setViewMode}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          counts={statusCounts}
          isRefreshing={isRefreshing}
          lang={lang}
          nearMe={nearMe}
          locationName={locationName}
          locationOptions={locationOptions}
          onPickGlobal={pickGlobal}
          onPickNearMe={pickNearMe}
          onPickLocation={pickLocation}
        />
      )}

      {viewMode === 'map' && !vault ? (
        <IncidentMap stories={visibleStories} onSelectStory={handleSelectIncidentStory} />
      ) : (
        <>
          {loading ? (
            <SkeletonList rows={3} rowHeight={160} />
          ) : visibleStories.length === 0 ? (
            <EmptyState
              title={
                vault
                  ? t('noQuarantined', lang)
                  : statusFilter === 'verified'
                    ? 'No verified reports in view'
                    : statusFilter === 'hoaxes'
                      ? 'No flagged hoaxes in view'
                      : scope === 'hyperlocal'
                        ? t('nothingNearby', lang)
                        : t('noStoriesYet', lang)
              }
              body="Pull to refresh, or widen the status filter."
            />
          ) : (
            visibleStories.map((s, i) => (
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

// ────────────────────────────────────────────────────────────────────────────
// Feed chip-bar — matches NewsHub / ProductHub floating-pill chrome.
// Left slot: Live Circle ↔ Incident Heatmap TOGGLE (two-state segmented).
// Chips (dropdowns): Status (All / Verified / Hoaxes), Location.
// ────────────────────────────────────────────────────────────────────────────

type FeedView = 'feed' | 'map';
type FeedStatus = 'all' | 'verified' | 'hoaxes';

function FeedChipBar({
  viewMode,
  setViewMode,
  statusFilter,
  setStatusFilter,
  counts,
  isRefreshing,
  lang,
  nearMe,
  locationName,
  locationOptions,
  onPickGlobal,
  onPickNearMe,
  onPickLocation,
}: {
  viewMode: FeedView;
  setViewMode: (v: FeedView) => void;
  statusFilter: FeedStatus;
  setStatusFilter: (s: FeedStatus) => void;
  counts: { all: number; verified: number; hoaxes: number };
  isRefreshing: boolean;
  lang: 'en' | 'bn' | 'hi';
  nearMe: boolean;
  locationName: string | null;
  locationOptions: { name: string; count: number }[];
  onPickGlobal: () => void;
  onPickNearMe: () => void | Promise<void>;
  onPickLocation: (name: string) => void;
}) {
  const [openMenu, setOpenMenu] = useState<null | 'status' | 'location'>(null);

  const statusLabel =
    statusFilter === 'verified'
      ? `Verified · ${counts.verified}`
      : statusFilter === 'hoaxes'
        ? `Hoaxes · ${counts.hoaxes}`
        : `All · ${counts.all}`;

  const locationChipLabel = locationName
    ? locationName
    : nearMe
      ? '10 km · Near me'
      : 'Global';

  return (
    <div
      className="sticky z-20 -mx-4 bg-bg-primary pb-2 pt-1 lg:!top-0"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}
    >
      <div className="mx-3 flex items-center gap-1.5 overflow-x-auto rounded-full border border-[var(--border-strong)] bg-bg-elevated/90 px-2.5 py-1.5 shadow-xl backdrop-blur-xl no-scrollbar">
        {/* Live Circle ↔ Incident Heatmap TOGGLE (segmented) */}
        <div className="flex shrink-0 items-center rounded-full border border-[var(--border-subtle)] bg-bg-surface p-0.5">
          <ToggleSeg
            active={viewMode === 'feed'}
            onClick={() => setViewMode('feed')}
            icon={<List size={13} />}
            label={t('liveCircleFeed', lang)}
          />
          <ToggleSeg
            active={viewMode === 'map'}
            onClick={() => setViewMode('map')}
            icon={<MapIcon size={13} />}
            label={t('incidentHeatmap', lang)}
          />
        </div>

        <FeedChip
          icon={<Layers size={13} />}
          label={statusLabel}
          active={statusFilter !== 'all'}
          open={openMenu === 'status'}
          onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
        />

        <FeedChip
          icon={nearMe ? <MapPin size={13} /> : <Globe2 size={13} />}
          label={locationChipLabel}
          active={nearMe || locationName !== null}
          open={openMenu === 'location'}
          onClick={() => setOpenMenu(openMenu === 'location' ? null : 'location')}
        />

        {isRefreshing && (
          <span className="ml-auto flex shrink-0 items-center gap-1 pr-2 text-[11px] font-mono text-content-muted">
            <RefreshCw size={11} className="animate-spin text-brand-emerald" />
            Updating
          </span>
        )}
      </div>

      {openMenu === 'status' && (
        <FeedDropdown onClose={() => setOpenMenu(null)}>
          <FeedRow
            icon={<Layers size={13} />}
            label={`All · ${counts.all}`}
            selected={statusFilter === 'all'}
            onClick={() => {
              setStatusFilter('all');
              setOpenMenu(null);
            }}
          />
          <FeedRow
            icon={<ShieldCheck size={13} />}
            label={`Verified · ${counts.verified}`}
            selected={statusFilter === 'verified'}
            onClick={() => {
              setStatusFilter('verified');
              setOpenMenu(null);
            }}
          />
          <FeedRow
            icon={<ShieldAlert size={13} />}
            label={`Hoaxes · ${counts.hoaxes}`}
            selected={statusFilter === 'hoaxes'}
            onClick={() => {
              setStatusFilter('hoaxes');
              setOpenMenu(null);
            }}
          />
        </FeedDropdown>
      )}

      {openMenu === 'location' && (
        <FeedDropdown onClose={() => setOpenMenu(null)}>
          <FeedRow
            icon={<Globe2 size={13} />}
            label="Global · All regions"
            selected={!nearMe && locationName === null}
            onClick={() => {
              onPickGlobal();
              setOpenMenu(null);
            }}
          />
          <FeedRow
            icon={<MapPin size={13} />}
            label="10 km · Near me"
            selected={nearMe && locationName === null}
            onClick={() => {
              void onPickNearMe();
              setOpenMenu(null);
            }}
          />
          {locationOptions.length > 0 && (
            <div className="mt-1 border-t border-[var(--border-subtle)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
              Specific locations
            </div>
          )}
          {locationOptions.map((loc) => (
            <FeedRow
              key={loc.name}
              icon={<MapPin size={13} />}
              label={`${loc.name} · ${loc.count}`}
              selected={locationName === loc.name}
              onClick={() => {
                onPickLocation(loc.name);
                setOpenMenu(null);
              }}
            />
          ))}
        </FeedDropdown>
      )}
    </div>
  );
}

function ToggleSeg({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all',
        active
          ? 'bg-brand-emerald text-[#04110b] shadow-sm'
          : 'text-content-secondary hover:text-content-primary',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function FeedChip({
  icon,
  label,
  active,
  open,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
        open
          ? 'border-brand-emerald/60 bg-brand-emerald/15 text-brand-emerald'
          : active
            ? 'border-brand-emerald/40 bg-brand-emerald/10 text-brand-emerald'
            : 'border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      <ChevronDown
        size={12}
        className={cn('shrink-0 transition-transform', open && 'rotate-180')}
      />
    </button>
  );
}

function FeedDropdown({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useListboxKeys({ open: true, containerRef: ref, onClose });
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div className="px-4 pb-3">
      <div
        ref={ref}
        role="listbox"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="animate-fade-in max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border-strong)] bg-bg-elevated p-1.5 shadow-2xl backdrop-blur-xl"
      >
        {children}
      </div>
    </div>
  );
}

function FeedRow({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="option"
      aria-selected={selected}
      tabIndex={0}
      data-listbox-option
      data-active={selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors',
        selected
          ? 'bg-brand-emerald/10 font-bold text-brand-emerald'
          : 'text-content-secondary hover:bg-bg-primary hover:text-content-primary',
      )}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {selected && <Check size={13} className="shrink-0 text-brand-emerald" />}
    </button>
  );
}
