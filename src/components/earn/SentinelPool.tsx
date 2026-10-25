'use client';

import { useState } from 'react';
import {
  Flame,
  Award,
  Calendar,
  TrendingUp,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_DIVIDENDS } from '@/lib/demoData';
import { formatINR } from '@/lib/utils';
import type { SentinelDividend } from '@/lib/types';

export function SentinelPool() {
  const [dividends, setDividends] = useState<SentinelDividend[]>(DEMO_DIVIDENDS);
  const currentStreak = 7;
  const streakMultiplier = 1.5;
  const todayPool = 2450;
  const yourEstShare = 82;

  const totalEarnedFromDividends = dividends.reduce((s, d) => s + d.yourShareInr, 0);

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
              Accuracy-Based Staking
            </span>
            <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">
              Daily Lottery / Pool
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            Daily Sentinel Dividend Pool
          </h3>
          <p className="text-xs text-content-muted">
            Spend 5-10 minutes each morning reviewing pending community reports. Accuracy builds streaks and pays out daily dividends.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-button bg-bg-elevated px-3 py-1.5 text-right">
            <div className="text-[10px] text-content-muted">Total Dividends Earned</div>
            <div className="font-mono text-sm font-bold text-brand-emerald">
              ₹{totalEarnedFromDividends} UPI
            </div>
          </div>
        </div>
      </div>

      {/* Streak Multiplier Card */}
      <Card className="p-4 border-brand-amber/30 bg-gradient-to-r from-bg-surface to-bg-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-amber/20 text-brand-amber">
              <Flame size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand-amber uppercase tracking-wider">
                Active Fact-Checking Streak
              </div>
              <div className="font-mono text-2xl font-black text-content-primary">
                {currentStreak} Days
                <span className="ml-2 text-xs font-normal text-content-muted">
                  ({streakMultiplier}× Dividend Multiplier)
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-button bg-bg-surface border border-[var(--border-subtle)] p-2.5 text-xs text-right">
            <div className="text-[10px] text-content-muted">Today&apos;s Estimated Share</div>
            <div className="font-mono text-lg font-bold text-brand-emerald">
              +{formatINR(yourEstShare)}
            </div>
          </div>
        </div>

        {/* Streak Milestones */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs border-t border-[var(--border-subtle)] pt-3">
          <div className="rounded bg-bg-surface p-1.5">
            <div className="text-[10px] text-content-muted">1-3 Days</div>
            <div className="font-mono font-bold text-content-primary">1.0×</div>
          </div>
          <div className="rounded bg-bg-surface p-1.5">
            <div className="text-[10px] text-content-muted">4-6 Days</div>
            <div className="font-mono font-bold text-content-primary">1.25×</div>
          </div>
          <div className="rounded bg-brand-amber/20 border border-brand-amber/40 p-1.5">
            <div className="text-[10px] text-brand-amber font-bold">7-13 Days (Current)</div>
            <div className="font-mono font-bold text-brand-amber">1.5×</div>
          </div>
          <div className="rounded bg-bg-surface p-1.5">
            <div className="text-[10px] text-content-muted">14+ Days</div>
            <div className="font-mono font-bold text-brand-emerald">2.0× Max</div>
          </div>
        </div>
      </Card>

      {/* Dividend History Table */}
      <Card className="p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
          7-Day Dividend Distribution History
        </h4>

        <div className="space-y-2">
          {dividends.map((div, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-button bg-bg-surface p-3 text-xs border border-[var(--border-subtle)]"
            >
              <div className="flex items-center gap-2.5">
                <Calendar size={14} className="text-content-muted" />
                <div>
                  <div className="font-medium text-content-primary">{div.date}</div>
                  <div className="text-[10px] text-content-muted">
                    {div.storiesReviewed} checks · {div.accuracy.toFixed(1)}% accuracy · {div.streakMultiplier}× multiplier
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono font-bold text-brand-emerald">
                  +{formatINR(div.yourShareInr)}
                </div>
                <div className="text-[10px] text-content-muted">
                  Pool: {formatINR(div.poolAmountInr)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
