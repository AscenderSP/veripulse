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
} from 'lucide-react';
import type { Story, StoryStage, StoryTimelineNode, VoteAction } from '@/lib/types';
import { useLang } from '@/hooks/useLang';
import { Badge, CredMeter, Card } from '@/components/ui/primitives';
import { stageMeta, timeAgo, cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { triggerVoteHaptic, shareStory } from '@/lib/nativeHardware';
import { maybeShowInterstitial } from '@/lib/admob';
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

  return (
    <Card className="overflow-hidden animate-fade-in press-effect">
      {/* header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={meta.color} bg={meta.bg}>
            {stage === 'public' && <ShieldCheck size={13} />}
            {stage === 'quarantined' && <AlertTriangle size={13} />}
            {stage === 'public'
              ? t('publicVerified', lang)
              : stage === 'quarantined'
                ? t('quarantinedHoax', lang)
                : stage === 'tier_1'
                  ? t('ring1Review', lang)
                  : t('ring2Review', lang)}
          </Badge>
          <Badge>{story.category}</Badge>
          {story.c2pa_verified && (
            <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
              <Sparkles size={12} /> C2PA
            </Badge>
          )}
          {story.ai_probability_score >= 30 && (
            <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">
              <Bot size={12} /> AI {Math.round(story.ai_probability_score)}%
            </Badge>
          )}
        </div>
        <span className="shrink-0 text-xs text-content-muted" suppressHydrationWarning>{timeAgo(story.created_at)}</span>
      </div>

      {/* body */}
      <div className="px-4">
        <h3 className="text-[15px] font-bold leading-snug text-content-primary">
          {story.titles[lang]}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">
          {story.summaries[lang]}
        </p>
        <div className="mt-2 flex items-center justify-between gap-1.5 text-xs text-content-muted">
          <div className="flex items-center gap-1.5">
            <MapPin size={12} /> {story.location_name}
            <span aria-hidden>·</span>
            <span className="font-mono">{story.source === 'rss' ? t('wireSource', lang) : t('citizenSource', lang)}</span>
          </div>
          <AudioReadout text={story.summaries[lang]} lang={lang} />
        </div>
        <HoaxBreakdown story={story} />
      </div>

      {/* credibility */}
      <div className="px-4 pt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-content-muted">{t('credibility', lang)}</span>
          <span className="font-mono font-semibold" style={{ color: meta.color }}>
            {Math.round(cred)}%
          </span>
        </div>
        <CredMeter value={cred} />
      </div>

      {/* vote module */}
      <div className="grid grid-cols-3 gap-2 p-4 pt-3">
        <VoteButton
          active={voted === 'real'}
          onClick={() => handleVote('real')}
          icon={<CheckCircle2 size={16} />}
          label={t('verifyReal', lang)}
          activeColor="var(--brand-emerald)"
        />
        <VoteButton
          active={voted === 'needs_context'}
          onClick={() => handleVote('needs_context')}
          icon={<HelpCircle size={16} />}
          label={t('needsContext', lang)}
          activeColor="var(--brand-amber)"
        />
        <VoteButton
          active={voted === 'hoax'}
          onClick={() => handleVote('hoax')}
          icon={<AlertTriangle size={16} />}
          label={t('flagHoax', lang)}
          activeColor="var(--brand-rose)"
        />
      </div>

      {voteError && <p className="-mt-2 px-4 pb-3 text-xs text-brand-amber">{voteError}</p>}

      {/* footer: timeline + share */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2.5">
        <button
          onClick={toggleTimeline}
          className="flex items-center gap-1 text-xs font-medium text-content-secondary hover:text-content-primary"
        >
          {t('timeline', lang)}
          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-xs font-medium text-content-secondary hover:text-content-primary"
        >
          <Share2 size={14} /> {t('share', lang)}
        </button>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-[var(--border-subtle)] bg-bg-primary/40 px-4 py-3">
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
              nodes.map((n) => (
                <TimelineDot key={n.id} color="var(--brand-sky)">
                  <span className="text-content-primary">{n.update_text[lang]}</span>
                  <span className="ml-1 text-content-muted">· {timeAgo(n.created_at)} ago</span>
                </TimelineDot>
              ))
            )}
          </ol>
        </div>
      )}
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

function VoteButton({
  active,
  onClick,
  icon,
  label,
  activeColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-button border px-2 py-2.5 text-[11px] font-semibold transition-all',
        active
          ? 'border-transparent'
          : 'border-[var(--border-subtle)] text-content-secondary hover:border-[var(--border-strong)] hover:text-content-primary',
      )}
      style={active ? { color: activeColor, background: 'var(--bg-elevated)', borderColor: activeColor } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}
