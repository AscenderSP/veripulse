'use client';

import { MapPin, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import type { Story } from '@/lib/types';
import { useLang } from '@/hooks/useLang';

export function IncidentMap({
  stories,
  onSelectStory,
}: {
  stories: Story[];
  onSelectStory?: (story: Story) => void;
}) {
  const { lang } = useLang();

  // Status + Location filtering is applied upstream by the Feed chip bar
  // (All / Verified / Hoaxes toggle and the Location dropdown with every
  // distinct `location_name`), so this component just renders the active
  // incidents list for whatever the caller sends in.
  return (
    <Card className="p-4 space-y-4 overflow-hidden">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-content-muted">
          <span>Active Local Feeds ({stories.length})</span>
        </div>

        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {stories.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectStory?.(s)}
              className="group block w-full text-left rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs transition-all hover:border-brand-emerald/60 hover:bg-bg-elevated active:scale-[0.99] cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-content-muted">
                  <MapPin size={11} /> {s.location_name}
                </span>
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    s.credibility_score >= 70
                      ? 'bg-brand-emerald/15 text-brand-emerald'
                      : s.rollout_stage === 'quarantined'
                      ? 'bg-brand-rose/15 text-brand-rose'
                      : 'bg-brand-amber/15 text-brand-amber'
                  }`}
                >
                  {Math.round(s.credibility_score)}% Credibility
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-content-primary line-clamp-1">{s.titles[lang]}</div>
                  <p className="text-[11px] text-content-secondary line-clamp-1">{s.summaries[lang]}</p>
                </div>
                <ChevronRight
                  size={14}
                  className="shrink-0 self-center text-content-muted transition-all group-hover:text-brand-emerald group-hover:translate-x-0.5"
                />
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
