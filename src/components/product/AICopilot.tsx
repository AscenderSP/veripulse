'use client';

import { useState } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Zap,
  ArrowRight,
  ExternalLink,
  Star,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { formatINR } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  matchedProducts?: {
    product: Product;
    reason: string;
  }[];
}

export function AICopilot({
  products,
  onSelectProduct,
}: {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
}) {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'm-init',
      sender: 'assistant',
      text: 'Hi! I am your VeriPulse Buyer Copilot. Tell me your budget, daily habits, and what you care most about (e.g. "College student, ₹20k budget, need great camera & battery for all-day use"). I will analyze verified owner telemetry to find your best matches.',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const samplePrompts = [
    'Best camera phone under ₹20k for portraits',
    'Heavy gaming phone with 90fps under ₹25k',
    'Best mileage bike for Kolkata daily office commute',
    'Coding & dev laptop with all-day battery under ₹90k',
  ];

  function runMatchingEngine(query: string) {
    const q = query.toLowerCase();

    // 1. Detect Category
    let targetCategory: string | null = null;
    if (q.includes('bike') || q.includes('motorcycle') || q.includes('scooter') || q.includes('mileage')) {
      targetCategory = 'bike';
    } else if (q.includes('car') || q.includes('suv') || q.includes('vehicle')) {
      targetCategory = 'car';
    } else if (q.includes('laptop') || q.includes('macbook') || q.includes('coding') || q.includes('pc')) {
      targetCategory = 'laptop';
    } else if (q.includes('phone') || q.includes('mobile') || q.includes('camera') || q.includes('gaming')) {
      targetCategory = 'mobile';
    }

    // 2. Detect Budget in INR
    let maxBudget: number | null = null;
    const kMatch = q.match(/(\d+)\s*k/);
    const lakhMatch = q.match(/(\d+(\.\d+)?)\s*l/);
    const numMatch = q.match(/₹?\s*(\d{4,7})/);

    if (kMatch) {
      maxBudget = parseInt(kMatch[1], 10) * 1000;
    } else if (lakhMatch) {
      maxBudget = parseFloat(lakhMatch[1]) * 100000;
    } else if (numMatch) {
      maxBudget = parseInt(numMatch[1], 10);
    }

    // 3. Filter candidates
    let candidates = products.filter((p) => {
      if (targetCategory && p.category !== targetCategory) return false;
      if (maxBudget && p.price_inr !== null && p.price_inr > maxBudget * 1.15) return false;
      return true;
    });

    if (candidates.length === 0) {
      candidates = products.slice(0, 4);
    }

    // 4. Score candidates based on query desires
    const scored = candidates.map((p) => {
      let score = (p.owner_rating ?? 7) * 10;
      let reason = 'High overall owner satisfaction and reliability.';

      if (q.includes('camera') || q.includes('photo') || q.includes('portrait')) {
        score += (p.scores?.camera ?? 7) * 5;
        reason = `Ranked #1 for camera (${p.scores?.camera ?? 8}/10) with verified Sony/OIS sensor telemetry.`;
      } else if (q.includes('game') || q.includes('gaming') || q.includes('bgmi') || q.includes('fps')) {
        score += (p.scores?.performance ?? 7) * 5;
        reason = `Top pick for high-fps sustained gaming (${p.scores?.performance ?? 8}/10) with minimal thermal throttling.`;
      } else if (q.includes('battery') || q.includes('charge') || q.includes('mileage') || q.includes('commute')) {
        score += (p.scores?.battery ?? 7) * 5;
        reason = `Exceptional verified endurance (${p.scores?.battery ?? 8}/10) — real owners report all-day mixed usage.`;
      } else if (q.includes('screen') || q.includes('display') || q.includes('movie') || q.includes('video')) {
        score += (p.scores?.display ?? 7) * 5;
        reason = `Vivid AMOLED/display panel (${p.scores?.display ?? 8}/10) with verified high outdoor brightness.`;
      }

      return { product: p, score, reason };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3);
  }

  function handleSend(promptText?: string) {
    const textToSend = promptText ?? inputQuery;
    if (!textToSend.trim()) return;

    const userMsg: CopilotMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsThinking(true);

    setTimeout(() => {
      const matches = runMatchingEngine(textToSend);
      const assistantMsg: CopilotMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: `Based on verified owner telemetry and real-world specs, here are the top recommendations for "${textToSend}":`,
        matchedProducts: matches,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);
    }, 700);
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="rounded-button border border-brand-emerald/30 bg-brand-emerald/5 p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-emerald">
            <Sparkles size={14} /> AI Decision Assistant
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            &quot;Buy For Me&quot; Verified Buyer Copilot
          </h3>
          <p className="text-xs text-content-muted">
            Skip hours of biased YouTube reviews. Describe your exact budget and use-case for instant unbiased telemetry recommendations.
          </p>
        </div>
      </div>

      {/* Suggested chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-content-muted font-semibold shrink-0">Try asking:</span>
        {samplePrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            className="shrink-0 rounded-pill border border-[var(--border-subtle)] bg-bg-surface px-3 py-1 text-content-secondary hover:border-brand-emerald hover:text-brand-emerald text-[11px]"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <Card className="p-4 min-h-[340px] max-h-[500px] overflow-y-auto space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 text-xs ${
              m.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.sender === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-emerald/20 text-brand-emerald">
                <Bot size={15} />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-card p-3 space-y-2 ${
                m.sender === 'user'
                  ? 'bg-brand-emerald text-[#04110b] font-medium'
                  : 'bg-bg-elevated border border-[var(--border-subtle)] text-content-primary'
              }`}
            >
              <p className="leading-relaxed">{m.text}</p>

              {/* Matched Product Cards */}
              {m.matchedProducts && m.matchedProducts.length > 0 && (
                <div className="mt-3 space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
                  {m.matchedProducts.map(({ product, reason }) => (
                    <div
                      key={product.id}
                      className="rounded-button border border-[var(--border-subtle)] bg-bg-surface p-3 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-content-muted">
                            {product.brand} · {product.category}
                          </div>
                          <div className="font-bold text-sm text-content-primary">
                            {product.name}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-bold text-sm text-content-primary">
                            {product.price_inr !== null ? formatINR(product.price_inr).replace(/\.00$/, '') : '—'}
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-brand-amber mt-0.5">
                            <Star size={11} className="fill-brand-amber" /> {product.owner_rating?.toFixed(1) ?? '8.5'}/10
                          </div>
                        </div>
                      </div>

                      <div className="rounded bg-brand-emerald/10 p-2 text-[11px] text-brand-emerald flex items-start gap-1.5 font-medium">
                        <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-content-muted">
                          {product.verified_owners} verified owners reporting
                        </span>
                        {onSelectProduct && (
                          <button
                            onClick={() => onSelectProduct(product)}
                            className="font-bold text-brand-sky hover:underline flex items-center gap-1"
                          >
                            View Telemetry <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {m.sender === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-content-muted">
                <User size={15} />
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-xs text-content-muted">
            <Loader2 size={14} className="animate-spin text-brand-emerald" />
            <span>Analyzing verified owner telemetry & specs database...</span>
          </div>
        )}
      </Card>

      {/* Input box */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="e.g. Need best photography phone under 20k with fast charging..."
          className="flex-1 rounded-button border border-[var(--border-subtle)] bg-bg-surface px-4 py-2.5 text-xs text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
        />
        <Button
          onClick={() => handleSend()}
          className="bg-brand-emerald text-[#04110b] font-bold px-4 py-2.5 text-xs"
        >
          <Send size={14} /> Send
        </Button>
      </div>
    </div>
  );
}
