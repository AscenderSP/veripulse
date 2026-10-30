'use client';

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  MapPin,
  ChevronDown,
  Share2,
  Bot,
  Sparkles,
  Loader2,
  Clock,
  UserRound,
  Tag,
} from 'lucide-react';
import type { Story, StoryStage, StoryTimelineNode, VoteAction } from '@/lib/types';
import { useLang } from '@/hooks/useLang';
import { Badge, CredMeter, Card } from '@/components/ui/primitives';
import { stageMeta, timeAgo, cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { triggerVoteHaptic, shareStory } from '@/lib/nativeHardware';
import { maybeShowInterstitial } from '@/lib/admob';
import { getReferenceImage, isStockImage } from '@/lib/referenceImages';
import { useRelatedImage } from '@/hooks/useRelatedImage';
import { AudioReadout } from './AudioReadout';
import { HoaxBreakdown } from './HoaxBreakdown';

export type VoteOutcome = { credibility: number; stage: StoryStage } | { error: string };

export function StoryCard({
  story,
  onVote,
  loadTimeline,
}: {
  story: Story;
  onVote: (story: Story, v: VoteAction) => Promise<VoteOutcome>;
  loadTimeline: (storyId: string) => Promise<StoryTimelineNode[]>;
}) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState<VoteAction | null>(null);
  const [cred, setCred] = useState(story.credibility_score);
  const [stage, setStage] = useState<StoryStage>(story.rollout_stage);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<StoryTimelineNode[] | null>(null);
  const meta = stageMeta(stage);

  // The DB function substitutes a category stock URL into media_url when no
  // real photo was attached, so nullness alone isn't enough; detect stock IDs.
  const hasOwnImage = Boolean(story.media_url) && !isStockImage(story.media_url);
  const relatedImage = useRelatedImage(story.titles[lang] ?? story.titles.en, !hasOwnImage);

  // Realtime pushes arrive as new props.
  useEffect(() => {
    setCred(story.credibility_score);
    setStage(story.rollout_stage);
  }, [story.credibility_score, story.rollout_stage]);

  async function handleVote(v: VoteAction) {
    setVoteError(null);
    await triggerVoteHaptic();
    const out = await onVote(story, v);
    if ('error' in out) {
      setVoteError(out.error);
      return;
    }
    setVoted(v);
    setCred(out.credibility);
    setStage(out.stage);
  }

  async function toggleTimeline() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    // A timeline expansion is a "detailed inspection" (§4.3 interstitial cadence).
    maybeShowInterstitial().catch(() => undefined);
    if (nodes === null) setNodes(await loadTimeline(story.id));
  }

  async function handleShare() {
    await shareStory({
      title: story.titles[lang],
      text: story.summaries[lang].slice(0, 120),
      url: `${typeof location !== 'undefined' ? location.origin : ''}/story/${story.id}`,
    });
  }

  const imageUrl = hasOwnImage
    ? story.media_url!
    : relatedImage ?? story.media_url ?? getReferenceImage(story.category);
  const sourceLabel = story.source === 'rss' ? t('wireSource', lang) : t('citizenSource', lang);
  const reporterLabel =
    story.source === 'rss'
      ? 'Wire bureau'
      : story.author_id
        ? `@${story.author_id.slice(0, 10)}`
        : t('citizenSource', lang);

  return (
    <Card className="overflow-hidden animate-fade-in press-effect">
      {/* ── Compact header: thumbnail + title + meta + tags ── */}
      <div className="flex gap-3 p-3">
        {/* Thumbnail (small by default, clicking expands) */}
        <button
          type="button"
          onClick={toggleTimeline}
          aria-expanded={open}
          aria-label={open ? 'Collapse story' : 'Expand story'}
          className="press-effect relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-sunken sm:h-24 sm:w-24 cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={story.titles[lang]}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {story.c2pa_verified && (
            <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
              <ShieldCheck size={9} className="text-brand-emerald" /> C2PA
            </span>
          )}
        </button>

        {/* Right: title + meta */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-[14px] font-bold leading-snug text-content-primary line-clamp-2">
            {story.titles[lang]}
          </h3>

          {/* Meta row: time · reporter · location · source */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-content-muted">
            <span className="flex items-center gap-0.5" suppressHydrationWarning>
              <Clock size={10} /> {timeAgo(story.created_at)}
            </span>
            <span className="flex items-center gap-0.5">
              <UserRound size={10} /> {reporterLabel}
            </span>
            <span className="flex items-center gap-0.5">
              <MapPin size={10} /> {story.location_name}
            </span>
            <span className="font-mono text-[10px]">{sourceLabel}</span>
          </div>

          {/* Tags row: stage + category + C2PA + AI */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge color={meta.color} bg={meta.bg}>
              {stage === 'public' && <ShieldCheck size={11} />}
              {stage === 'quarantined' && <AlertTriangle size={11} />}
              {stage === 'public'
                ? t('publicVerified', lang)
                : stage === 'quarantined'
                  ? t('quarantinedHoax', lang)
                  : stage === 'tier_1'
                    ? t('ring1Review', lang)
                    : t('ring2Review', lang)}
            </Badge>
            <Badge>
              <Tag size={10} /> {story.category}
            </Badge>
            {story.ai_probability_score >= 30 && (
              <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">
                <Bot size={10} /> AI {Math.round(story.ai_probability_score)}%
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded view: full image + summary + hoax + audio ── */}
      {open && (
        <div className="animate-fade-in px-4">
          <div className="relative mb-3 h-48 overflow-hidden rounded-xl bg-surface-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={story.titles[lang]}
              className="h-full w-full object-cover transition duration-300 hover:scale-105"
              loading="lazy"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              {story.c2pa_verified ? (
                <>
                  <ShieldCheck size={11} className="text-brand-emerald" />
                  <span>C2PA Verified</span>
                </>
              ) : hasOwnImage ? (
                <span>Eyewitness Media</span>
              ) : (
                <>
                  <Sparkles size={11} className="text-brand-amber" />
                  <span>Reference Image</span>
                </>
              )}
            </div>
            {!hasOwnImage && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-left text-[9px] leading-tight text-white/80">
                Illustrative — not from scene
              </div>
            )}
          </div>

          <p className="text-sm leading-relaxed text-content-secondary">
            {story.summaries[lang]}
          </p>

          <div className="mt-2 flex items-center justify-end">
            <AudioReadout text={story.summaries[lang]} lang={lang} />
          </div>

          <HoaxBreakdown story={story} />
        </div>
      )}

      {/* credibility + vote module — single consolidated row.
          Mobile wraps the meter + % above the 3 vote chips so each half
          has breathing room; on sm+ everything sits on one line:
            [cred meter] [%]  [Verify Real] [Needs Context] [Flag Hoax] */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-2 sm:flex-nowrap sm:gap-3"
        aria-label={t('credibility', lang)}
      >
        <div className="flex min-w-[12rem] flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            <CredMeter value={cred} />
          </div>
          <span
            className="shrink-0 font-mono text-[11px] font-semibold tabular-nums"
            style={{ color: meta.color }}
          >
            {Math.round(cred)}%
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <VoteButton
            active={voted === 'real'}
            onClick={() => handleVote('real')}
            icon={<CheckCircle2 size={14} />}
            label={t('verifyReal', lang)}
            tone="emerald"
          />
          <VoteButton
            active={voted === 'needs_context'}
            onClick={() => handleVote('needs_context')}
            icon={<HelpCircle size={14} />}
            label={t('needsContext', lang)}
            tone="amber"
          />
          <VoteButton
            active={voted === 'hoax'}
            onClick={() => handleVote('hoax')}
            icon={<AlertTriangle size={14} />}
            label={t('flagHoax', lang)}
            tone="rose"
          />
        </div>
      </div>

      {voteError && <p className="-mt-2 px-4 pb-3 text-xs text-brand-amber">{voteError}</p>}

      {/* Expanded timeline — only when the card is open. */}
      {open && (
        <div className="animate-fade-in border-t border-[var(--border-subtle)] bg-bg-primary/40 px-4 py-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-content-muted">
            {t('timeline', lang)}
          </div>
          <ol className="relative ml-1 space-y-3 border-l border-[var(--border-strong)] pl-4 text-xs text-content-secondary">
            <TimelineDot color="var(--brand-emerald)">
              {t('primaryReport', lang)} · {timeAgo(story.created_at)} · {t('completeness', lang)}{' '}
              {Math.round(story.completeness_score)}/100
            </TimelineDot>
            {nodes === null ? (
              <li className="flex items-center gap-2 text-content-muted">
                <Loader2 size={12} className="animate-spin" /> {t('loadingUpdates', lang)}
              </li>
            ) : nodes.length === 0 ? (
              <li className="text-content-muted">{t('noCorroborating', lang)}</li>
            ) : (
              nodes.map((n) => {
                const text = typeof n.update_text === 'object' && n.update_text !== null
                  ? (n.update_text[lang] || (n.update_text as any).summary || (n.update_text as any).headline || (n.update_text as any).en || JSON.stringify(n.update_text))
                  : String(n.update_text);
                return (
                  <TimelineDot key={n.id} color="var(--brand-sky)">
                    <span className="text-content-primary">{text}</span>
                    <span className="ml-1 text-content-muted">· {timeAgo(n.created_at)}</span>
                  </TimelineDot>
                );
              })
            )}
          </ol>
        </div>
      )}

      {/* footer: show-more + share */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2.5">
        <button
          onClick={toggleTimeline}
          className="press-effect flex items-center gap-1 text-xs font-semibold text-content-secondary hover:text-content-primary"
          aria-expanded={open}
        >
          {open ? 'Show less' : 'Show more'}
          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
        <button
          onClick={handleShare}
          className="press-effect flex items-center gap-1 text-xs font-semibold text-content-secondary hover:text-content-primary"
        >
          <Share2 size={14} /> {t('share', lang)}
        </button>
      </div>
    </Card>
  );
}

function TimelineDot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li>
      <span className="absolute -left-[5px] mt-1 h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </li>
  );
}

/** Vote chip. The tone drives the whole look so each verdict reads at a
    glance:
      · emerald → Verify Real
      · amber   → Needs Context
      · rose    → Flag Hoax
    Idle state: tinted liquid glass (tone-coloured border + 10 % tone
    glass bg + muted tone text). Active state: solid tone fill. Keeps
    the three choices visually distinct even before the user hovers. */
type VoteTone = 'emerald' | 'amber' | 'rose';
const TONE: Record<
  VoteTone,
  { color: string; idleBg: string; idleBorder: string; idleText: string }
> = {
  emerald: {
    color: 'var(--brand-emerald)',
    idleBg: 'rgba(91, 191, 150, 0.1)',
    idleBorder: 'rgba(91, 191, 150, 0.35)',
    idleText: 'var(--brand-emerald)',
  },
  amber: {
    color: 'var(--brand-amber)',
    idleBg: 'rgba(227, 176, 92, 0.1)',
    idleBorder: 'rgba(227, 176, 92, 0.35)',
    idleText: 'var(--brand-amber)',
  },
  rose: {
    color: 'var(--brand-rose)',
    idleBg: 'rgba(229, 129, 144, 0.1)',
    idleBorder: 'rgba(229, 129, 144, 0.35)',
    idleText: 'var(--brand-rose)',
  },
};

function VoteButton({
  active,
  onClick,
  icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: VoteTone;
}) {
  const t = TONE[tone];
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'press-effect flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition-all backdrop-blur-md',
        active ? 'shadow-sm' : 'hover:brightness-110',
      )}
      style={
        active
          ? {
              background: t.color,
              borderColor: t.color,
              color: '#0b0e14',
            }
          : {
              background: t.idleBg,
              borderColor: t.idleBorder,
              color: t.idleText,
            }
      }
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
