'use client';

import { useState } from 'react';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Star,
  Sparkles,
} from 'lucide-react';
import { Card, Badge } from '@/components/ui/primitives';
import { DEMO_BADGES } from '@/lib/demoData';
import type { ReputationBadge } from '@/lib/types';

export function BadgesView() {
  const [badges, setBadges] = useState<ReputationBadge[]>(DEMO_BADGES);

  const tierColors: Record<string, { border: string; bg: string; text: string }> = {
    platinum: { border: 'border-purple-500/50', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    gold: { border: 'border-brand-amber/50', bg: 'bg-brand-amber/10', text: 'text-brand-amber' },
    silver: { border: 'border-slate-400/50', bg: 'bg-slate-400/10', text: 'text-slate-300' },
    bronze: { border: 'border-amber-700/50', bg: 'bg-amber-700/10', text: 'text-amber-600' },
  };

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
              Credibility & Sentinel Status
            </span>
            <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">
              Reputation Engine
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            Citizen Reputation Badges
          </h3>
          <p className="text-xs text-content-muted">
            Badges give higher consensus vote weighting (up to 3×) and unlock exclusive high-reward bounty quests.
          </p>
        </div>
      </div>

      {/* Grid of Badges */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {badges.map((b) => {
          const isEarned = Boolean(b.earnedAt);
          const meta = tierColors[b.tier] ?? tierColors.bronze;

          return (
            <Card
              key={b.id}
              className={`p-4 flex items-start gap-3.5 ${
                isEarned ? `${meta.border} border` : 'opacity-70'
              }`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${
                  isEarned ? meta.bg : 'bg-bg-elevated'
                }`}
              >
                {b.icon}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-content-primary flex items-center gap-1.5">
                    {b.name}
                    {isEarned ? (
                      <CheckCircle2 size={13} className="text-brand-emerald" />
                    ) : (
                      <Lock size={12} className="text-content-muted" />
                    )}
                  </h4>
                  <span className={`text-[10px] font-bold uppercase ${meta.text}`}>
                    {b.tier}
                  </span>
                </div>

                <p className="text-xs text-content-secondary leading-snug">
                  {b.description}
                </p>

                {isEarned ? (
                  <div className="text-[10px] text-brand-emerald font-semibold pt-1">
                    Unlocked on {b.earnedAt}
                  </div>
                ) : (
                  <div className="pt-1 space-y-1">
                    <div className="flex justify-between text-[10px] text-content-muted">
                      <span>Requirement: {b.requirement}</span>
                      <span>{b.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
                      <div
                        className="h-full bg-brand-emerald rounded-full"
                        style={{ width: `${b.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
