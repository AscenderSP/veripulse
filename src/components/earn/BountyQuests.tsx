'use client';

import { useState } from 'react';
import {
  Target,
  IndianRupee,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  AlertCircle,
  Plus,
  Send,
  Sparkles,
  Flame,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_BOUNTIES } from '@/lib/demoData';
import { formatINR } from '@/lib/utils';
import type { BountyQuest, BountyType } from '@/lib/types';

export function BountyQuests({ onClaimSuccess }: { onClaimSuccess?: (reward: number) => void }) {
  const [bounties, setBounties] = useState<BountyQuest[]>(DEMO_BOUNTIES);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'claimed'>('open');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [claimProofModalId, setClaimProofModalId] = useState<string | null>(null);
  const [proofText, setProofText] = useState('');
  const [claimingSuccessId, setClaimingSuccessId] = useState<string | null>(null);

  // New bounty form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newReward, setNewReward] = useState(50);
  const [newLocation, setNewLocation] = useState('Kolkata, WB');
  const [newType, setNewType] = useState<BountyType>('news_verification');

  const filtered = bounties.filter((b) => {
    if (activeFilter === 'open') return b.status === 'open';
    if (activeFilter === 'claimed') return b.status === 'claimed' || b.status === 'completed';
    return true;
  });

  function handleCreateBounty(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const quest: BountyQuest = {
      id: `b-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      type: newType,
      rewardInr: newReward,
      postedBy: 'You (Citizen)',
      location: newLocation.trim(),
      expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'open',
      proofRequired: 'C2PA-verified camera photo or verified telemetry screenshot',
      createdAt: new Date().toISOString(),
    };

    setBounties([quest, ...bounties]);
    setShowCreateModal(false);
    setNewTitle('');
    setNewDesc('');
  }

  function handleCompleteClaim(bountyId: string) {
    if (!proofText.trim()) return;

    const b = bounties.find((x) => x.id === bountyId);
    if (!b) return;

    setBounties((prev) =>
      prev.map((item) =>
        item.id === bountyId
          ? { ...item, status: 'completed', claimedBy: 'you_verified' }
          : item,
      ),
    );

    setClaimProofModalId(null);
    setProofText('');
    setClaimingSuccessId(bountyId);
    onClaimSuccess?.(b.rewardInr);
  }

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
              Citizen Micro-Earnings
            </span>
            <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
              ₹ Instant UPI
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            Hyperlocal &quot;Verify This&quot; Bounty Quests
          </h3>
          <p className="text-xs text-content-muted">
            Earn real money by verifying rumors, snapping on-ground road condition photos, or recording real device telemetry.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1.5 text-xs flex items-center gap-1.5"
        >
          <Plus size={14} /> Post a Bounty Task
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveFilter('open')}
            className={`rounded-pill px-3 py-1 text-xs font-semibold ${
              activeFilter === 'open'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'bg-bg-elevated text-content-muted hover:text-content-primary'
            }`}
          >
            Available Tasks ({bounties.filter((b) => b.status === 'open').length})
          </button>
          <button
            onClick={() => setActiveFilter('claimed')}
            className={`rounded-pill px-3 py-1 text-xs font-semibold ${
              activeFilter === 'claimed'
                ? 'bg-brand-sky text-white'
                : 'bg-bg-elevated text-content-muted hover:text-content-primary'
            }`}
          >
            Completed / Claimed
          </button>
          <button
            onClick={() => setActiveFilter('all')}
            className={`rounded-pill px-3 py-1 text-xs font-semibold ${
              activeFilter === 'all'
                ? 'bg-bg-surface text-content-primary border border-[var(--border-strong)]'
                : 'bg-bg-elevated text-content-muted'
            }`}
          >
            All
          </button>
        </div>

        <div className="text-[11px] text-content-muted font-mono">
          Pool: <span className="text-brand-emerald font-bold">₹{bounties.reduce((s, b) => s + b.rewardInr, 0)}</span> available
        </div>
      </div>

      {/* Success notification */}
      {claimingSuccessId && (
        <div className="rounded-button bg-brand-emerald/15 border border-brand-emerald/40 p-3 text-xs text-brand-emerald flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 size={16} /> Proof submitted! Bounty reward credited directly to your VeriPulse wallet.
          </span>
          <button onClick={() => setClaimingSuccessId(null)} className="text-content-muted text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Bounty Quests List */}
      <div className="space-y-3">
        {filtered.map((quest) => (
          <Card key={quest.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
                    ₹{quest.rewardInr} Payout
                  </Badge>
                  <span className="text-[11px] font-semibold text-content-muted uppercase">
                    {quest.type.replace('_', ' ')}
                  </span>
                  {quest.status === 'completed' && (
                    <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
                      Completed
                    </Badge>
                  )}
                </div>

                <h4 className="mt-1.5 text-sm font-bold text-content-primary leading-snug">
                  {quest.title}
                </h4>
              </div>

              <div className="font-mono text-lg font-black text-brand-emerald">
                +{formatINR(quest.rewardInr)}
              </div>
            </div>

            <p className="text-xs text-content-secondary leading-relaxed">
              {quest.description}
            </p>

            {/* Proof requirement box */}
            <div className="rounded bg-bg-surface p-2 text-[11px] border border-[var(--border-subtle)] space-y-1">
              <div className="font-semibold text-content-muted flex items-center gap-1">
                <Camera size={12} className="text-brand-sky" /> Proof Required:
              </div>
              <div className="text-content-secondary">{quest.proofRequired}</div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-3 text-[11px] text-content-muted">
                {quest.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {quest.location}
                  </span>
                )}
                <span>Posted by {quest.postedBy}</span>
              </div>

              {quest.status === 'open' && (
                <Button
                  onClick={() => setClaimProofModalId(quest.id)}
                  className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1 text-xs"
                >
                  Claim & Submit Proof (+₹{quest.rewardInr})
                </Button>
              )}

              {quest.status === 'completed' && (
                <span className="text-[11px] font-semibold text-brand-sky flex items-center gap-1">
                  <CheckCircle2 size={12} /> Claimed by @{quest.claimedBy}
                </span>
              )}
            </div>

            {/* Proof submission drawer */}
            {claimProofModalId === quest.id && (
              <div className="mt-3 rounded border border-brand-emerald/40 bg-bg-elevated p-3 text-xs space-y-2 animate-slide-up">
                <div className="font-bold text-brand-emerald">
                  Submit Proof for &quot;{quest.title}&quot;
                </div>
                <textarea
                  rows={2}
                  value={proofText}
                  onChange={(e) => setProofText(e.target.value)}
                  placeholder="Paste observation notes, image URL, or describe C2PA photo timestamp..."
                  className="w-full rounded border border-[var(--border-subtle)] bg-bg-surface p-2 text-xs text-content-primary focus:outline-none"
                  required
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setClaimProofModalId(null)}
                    className="px-2.5 py-1 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleCompleteClaim(quest.id)}
                    className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1 text-xs"
                  >
                    Upload Proof & Collect ₹{quest.rewardInr}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Create Bounty Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-5 space-y-3 animate-slide-up">
            <h3 className="text-base font-bold text-content-primary flex items-center gap-2">
              <Target size={18} className="text-brand-emerald" /> Post a Community Bounty Task
            </h3>
            <p className="text-xs text-content-muted">
              Want on-ground locals or verified owners to confirm something for you? Fund a small bounty.
            </p>

            <form onSubmit={handleCreateBounty} className="space-y-3 text-xs">
              <div>
                <label className="text-content-muted font-medium">Bounty Question / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Is the Howrah Bridge road clear right now?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-content-muted font-medium">Description & Specifics</label>
                <textarea
                  rows={2}
                  placeholder="Explain exactly what you want the reporter to check..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-content-muted font-medium">Reward (₹ INR)</label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={newReward}
                    onChange={(e) => setNewReward(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-content-muted font-medium">Location</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="px-3 py-1.5 text-xs">
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1.5 text-xs">
                  Fund & Launch Bounty (₹{newReward})
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
