'use client';

import { useState } from 'react';
import {
  Battery,
  Activity,
  Wrench,
  Clock,
  IndianRupee,
  Star,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  ShieldCheck,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Card, Badge, Button, CustomSelect } from '@/components/ui/primitives';
import { DEMO_DECAY_CHECKINS } from '@/lib/demoData';
import { formatINR } from '@/lib/utils';
import type { DecayCheckIn } from '@/lib/types';

export function DecayIndex({
  productId,
  productName,
}: {
  productId: string;
  productName?: string;
}) {
  const [checkIns, setCheckIns] = useState<DecayCheckIn[]>(() => {
    return DEMO_DECAY_CHECKINS.filter((c) => c.productId === productId);
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [milestone, setMilestone] = useState<'3-month' | '6-month' | '1-year' | '2-year'>('6-month');
  const [batteryHealth, setBatteryHealth] = useState(90);
  const [performanceScore, setPerformanceScore] = useState(8);
  const [satisfaction, setSatisfaction] = useState(8);
  const [comment, setComment] = useState('');
  const [issues, setIssues] = useState('');
  const [repair, setRepair] = useState('');

  // Calculate reliability grade
  const avgSatisfaction = checkIns.length
    ? checkIns.reduce((sum, c) => sum + c.overallSatisfaction, 0) / checkIns.length
    : 8.5;

  const getGrade = (score: number) => {
    if (score >= 9.2) return { grade: 'A+', color: 'text-brand-emerald bg-brand-emerald/15' };
    if (score >= 8.4) return { grade: 'A', color: 'text-brand-emerald bg-brand-emerald/15' };
    if (score >= 7.5) return { grade: 'B+', color: 'text-brand-sky bg-brand-sky/15' };
    if (score >= 6.5) return { grade: 'B', color: 'text-brand-amber bg-brand-amber/15' };
    if (score >= 5.0) return { grade: 'C', color: 'text-brand-amber bg-brand-amber/15' };
    return { grade: 'D', color: 'text-brand-rose bg-brand-rose/15' };
  };

  const gradeInfo = getGrade(avgSatisfaction);

  function handleSubmitCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;

    const newCheckIn: DecayCheckIn = {
      id: `dc-${Date.now()}`,
      productId,
      ownerName: 'you_verified',
      milestone,
      batteryHealth,
      performanceScore,
      issuesReported: issues ? issues.split(',').map((s) => s.trim()) : [],
      repairHistory: repair.trim() || 'None',
      serviceCost: 0,
      overallSatisfaction: satisfaction,
      comment: comment.trim(),
      earnedAmount: milestone === '3-month' ? 50 : milestone === '6-month' ? 100 : 150,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setCheckIns([newCheckIn, ...checkIns]);
    setShowAddForm(false);
    setComment('');
    setIssues('');
    setRepair('');
  }

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
              Long-Term Reliability Radar
            </span>
            <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
              Verified Telemetry
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            6-Month & 1-Year Decay Index
          </h3>
          <p className="text-xs text-content-muted">
            Does performance stutter after 180 days? Real battery wear and repair history logged by verified owners.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-content-muted">Reliability Grade</div>
            <div className={`font-mono text-2xl font-black px-3 py-0.5 rounded-pill ${gradeInfo.color}`}>
              {gradeInfo.grade}
            </div>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 text-xs font-bold bg-brand-emerald text-[#04110b]"
          >
            <Plus size={14} /> Log Check-In (+₹100)
          </Button>
        </div>
      </div>

      {/* Add Check-in Form */}
      {showAddForm && (
        <Card className="p-4 border-brand-emerald/40 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-emerald flex items-center gap-1.5">
              <Sparkles size={14} /> Log Milestone Check-In & Claim Grant
            </h4>
            <span className="text-[11px] font-mono text-brand-amber font-semibold">Earn ₹50–₹150 UPI Grant</span>
          </div>

          <form onSubmit={handleSubmitCheckIn} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-content-muted font-medium">Milestone</label>
                <CustomSelect
                  value={milestone}
                  onChange={(val) => setMilestone(val as any)}
                  variant="card"
                  size="sm"
                  align="left"
                  className="mt-1 w-full"
                  buttonClassName="w-full justify-between"
                  options={[
                    { value: '3-month', label: '3-Month (₹50)' },
                    { value: '6-month', label: '6-Month (₹100)' },
                    { value: '1-year', label: '1-Year (₹150)' },
                    { value: '2-year', label: '2-Year (₹200)' },
                  ]}
                />
              </div>

              <div>
                <label className="text-content-muted font-medium">Battery Health (%)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={batteryHealth}
                  onChange={(e) => setBatteryHealth(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-content-muted font-medium">Performance (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={performanceScore}
                  onChange={(e) => setPerformanceScore(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-content-muted font-medium">Satisfaction (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={satisfaction}
                  onChange={(e) => setSatisfaction(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-content-muted font-medium">Issues encountered (comma-separated, or None)</label>
              <input
                type="text"
                placeholder="e.g. slight lag in camera app, battery drains faster"
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-content-muted font-medium">Repair or Service History</label>
              <input
                type="text"
                placeholder="e.g. Screen replaced under warranty, or None"
                value={repair}
                onChange={(e) => setRepair(e.target.value)}
                className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-content-muted font-medium">Detailed Long-Term Verdict</label>
              <textarea
                rows={2}
                placeholder="How has this device aged? Would you still recommend it after 6 months to 1 year?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1.5 text-xs">
                Submit & Claim Reward
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Timeline Check-Ins */}
      {checkIns.length === 0 ? (
        <Card className="p-6 text-center text-xs text-content-muted">
          No long-term check-ins logged for this product yet.
          <div className="mt-2 text-brand-emerald font-semibold">
            Are you a verified owner? Log your 3-month or 6-month check-in and earn up to ₹150!
          </div>
        </Card>
      ) : (
        <div className="relative pl-6 space-y-4 border-l-2 border-[var(--border-subtle)] ml-3">
          {checkIns.map((item) => {
            const isGoodBattery = item.batteryHealth ? item.batteryHealth >= 90 : true;
            const isMedBattery = item.batteryHealth ? item.batteryHealth >= 80 && item.batteryHealth < 90 : false;

            return (
              <div key={item.id} className="relative">
                {/* Timeline node icon */}
                <div className="absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-bg-elevated border border-[var(--border-strong)] text-brand-emerald">
                  <Clock size={12} />
                </div>

                <Card className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-content-primary capitalize">
                        {item.milestone} Milestone
                      </span>
                      <span className="text-[11px] text-content-muted">by @{item.ownerName}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.earnedAmount && (
                        <span className="inline-flex items-center gap-0.5 rounded-pill bg-brand-emerald/15 px-2 py-0.5 text-[10px] font-bold text-brand-emerald">
                          +₹{item.earnedAmount} Grant
                        </span>
                      )}
                      <span className="font-mono text-xs font-bold text-brand-amber">
                        ★ {item.overallSatisfaction.toFixed(1)} / 10
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Stats Row */}
                  <div className="flex flex-wrap items-center gap-3 rounded bg-bg-surface/60 p-2 text-[11px]">
                    {item.batteryHealth !== undefined && (
                      <div className="flex items-center gap-1.5 font-medium">
                        <Battery size={13} className={isGoodBattery ? 'text-brand-emerald' : isMedBattery ? 'text-brand-amber' : 'text-brand-rose'} />
                        <span>Battery Health:</span>
                        <span className={`font-mono font-bold ${isGoodBattery ? 'text-brand-emerald' : isMedBattery ? 'text-brand-amber' : 'text-brand-rose'}`}>
                          {item.batteryHealth}%
                        </span>
                      </div>
                    )}

                    {item.performanceScore && (
                      <div className="flex items-center gap-1.5 font-medium text-content-secondary">
                        <Activity size={13} className="text-brand-sky" />
                        <span>Performance:</span>
                        <span className="font-mono font-bold text-content-primary">
                          {item.performanceScore}/10
                        </span>
                      </div>
                    )}

                    {item.repairHistory && (
                      <div className="flex items-center gap-1.5 text-content-muted">
                        <Wrench size={12} />
                        <span>Repairs: {item.repairHistory}</span>
                      </div>
                    )}
                  </div>

                  {/* Issues reported if any */}
                  {item.issuesReported && item.issuesReported.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-brand-rose font-semibold flex items-center gap-0.5">
                        <AlertTriangle size={11} /> Issues:
                      </span>
                      {item.issuesReported.map((issue, idx) => (
                        <span key={idx} className="rounded bg-brand-rose/10 px-1.5 py-0.5 text-brand-rose">
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-content-secondary leading-relaxed">{item.comment}</p>
                  <div className="text-[10px] text-content-muted">Verified on {item.createdAt}</div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
