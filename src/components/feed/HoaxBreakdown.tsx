'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  ShieldAlert,
  ChevronDown,
  Info,
  Clock,
  Sparkles,
  Users,
} from 'lucide-react';
import { Card, Badge } from '@/components/ui/primitives';
import type { Story } from '@/lib/types';

export function HoaxBreakdown({ story }: { story: Story }) {
  const [expanded, setExpanded] = useState(false);

  // Only relevant for quarantined or low credibility stories
  if (story.rollout_stage !== 'quarantined' && story.credibility_score > 40) {
    return null;
  }

  // Generate explainability points based on Gemini scores & consensus
  const flaggedReasons: string[] = [];

  if (story.ai_probability_score >= 35) {
    flaggedReasons.push(
      `Synthetically generated text or altered media detected (${Math.round(story.ai_probability_score)}% AI score).`,
    );
  }
  if (story.credibility_score < 35) {
    flaggedReasons.push(
      `Consensus threshold crossed: 5+ high-trust Sentinels flagged this as fabricated or unsubstantiated.`,
    );
  }
  if (story.completeness_score < 50) {
    flaggedReasons.push(
      `Lack of key journalistic verification elements (named officials, primary sources, verifiable timestamp).`,
    );
  }
  if (flaggedReasons.length === 0) {
    flaggedReasons.push(
      `Under active investigation for misattribution or misleading contextual claims.`,
    );
  }

  return (
    <div className="mt-3 rounded-button border border-brand-rose/40 bg-brand-rose/5 p-3 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between font-bold text-brand-rose"
      >
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={14} /> Why was this flagged by consensus?
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-2.5 pt-2 border-t border-brand-rose/20 animate-fade-in text-content-secondary">
          {/* Detailed Points */}
          <ul className="space-y-1.5">
            {flaggedReasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                <span className="text-brand-rose font-bold">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          {/* AI vs Sentinel Metrics */}
          <div className="grid grid-cols-3 gap-2 rounded bg-bg-surface p-2 text-center text-[10px]">
            <div>
              <div className="text-content-muted">AI Probability</div>
              <div className="font-mono font-bold text-brand-amber">
                {Math.round(story.ai_probability_score)}%
              </div>
            </div>
            <div>
              <div className="text-content-muted">Credibility Score</div>
              <div className="font-mono font-bold text-brand-rose">
                {Math.round(story.credibility_score)}%
              </div>
            </div>
            <div>
              <div className="text-content-muted">Completeness</div>
              <div className="font-mono font-bold text-content-primary">
                {Math.round(story.completeness_score)}/100
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-content-muted pt-1">
            <Clock size={11} />
            <span>
              Quarantined for 72 hours. Author trust deducted (-2.5). Retractions broadcasted to voters.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
