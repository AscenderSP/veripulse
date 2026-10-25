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
  ArrowLeft,
  ShieldCheck,
  Share2,
  Check,
  User,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_BOUNTIES } from '@/lib/demoData';
import { formatINR } from '@/lib/utils';
import { useLang } from '@/hooks/useLang';
import type { BountyQuest, BountyType } from '@/lib/types';

export function BountyQuests({ onClaimSuccess }: { onClaimSuccess?: (reward: number) => void }) {
  const { lang } = useLang();
  const [bounties, setBounties] = useState<BountyQuest[]>(DEMO_BOUNTIES);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'claimed'>('open');
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [selectedBounty, setSelectedBounty] = useState<BountyQuest | null>(null);
  const [claimingSuccessId, setClaimingSuccessId] = useState<string | null>(null);

  const filtered = bounties.filter((b) => {
    if (activeFilter === 'open') return b.status === 'open';
    if (activeFilter === 'claimed') return b.status === 'claimed' || b.status === 'completed';
    return true;
  });

  function handleCreateBounty(questData: {
    title: string;
    description: string;
    type: BountyType;
    rewardInr: number;
    location: string;
    proofRequired: string;
  }) {
    const quest: BountyQuest = {
      id: `b-${Date.now()}`,
      title: questData.title,
      description: questData.description,
      type: questData.type,
      rewardInr: questData.rewardInr,
      postedBy: 'You (Citizen)',
      location: questData.location,
      expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'open',
      proofRequired: questData.proofRequired || 'C2PA-verified camera photo or verified telemetry screenshot',
      createdAt: new Date().toISOString(),
    };

    setBounties([quest, ...bounties]);
    setShowCreatePage(false);
  }

  function handleCompleteClaim(bountyId: string, proof: string) {
    if (!proof.trim()) return;

    const b = bounties.find((x) => x.id === bountyId);
    if (!b) return;

    setBounties((prev) =>
      prev.map((item) =>
        item.id === bountyId
          ? { ...item, status: 'completed', claimedBy: 'you_verified' }
          : item,
      ),
    );

    setClaimingSuccessId(bountyId);
    onClaimSuccess?.(b.rewardInr);
  }

  // ── Full Page Intercepts (News Hub Pattern) ─────────────────────────────
  if (showCreatePage) {
    return (
      <CreateBountyPage
        onBack={() => setShowCreatePage(false)}
        onSubmit={handleCreateBounty}
        lang={lang}
      />
    );
  }

  if (selectedBounty) {
    const freshQuest = bounties.find((b) => b.id === selectedBounty.id) || selectedBounty;
    return (
      <BountyDrillDownPage
        quest={freshQuest}
        onBack={() => setSelectedBounty(null)}
        onClaim={(proof) => {
          handleCompleteClaim(freshQuest.id, proof);
        }}
        claimingSuccess={claimingSuccessId === freshQuest.id}
        lang={lang}
      />
    );
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
          onClick={() => setShowCreatePage(true)}
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

        <span className="text-[11px] text-content-muted hidden sm:inline">
          Showing {filtered.length} tasks
        </span>
      </div>

      {/* Bounty Cards List */}
      <div className="space-y-3">
        {filtered.map((quest) => (
          <Card
            key={quest.id}
            onClick={() => setSelectedBounty(quest)}
            className="group p-4 space-y-3 cursor-pointer hover:border-brand-emerald/40 hover:bg-bg-elevated/40 transition-all"
          >
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

                <h4 className="mt-1.5 text-sm font-bold text-content-primary leading-snug group-hover:text-brand-emerald transition-colors">
                  {quest.title}
                </h4>
              </div>

              <div className="font-mono text-lg font-black text-brand-emerald">
                +{formatINR(quest.rewardInr)}
              </div>
            </div>

            <p className="text-xs text-content-secondary leading-relaxed line-clamp-2">
              {quest.description}
            </p>

            {/* Proof requirement box */}
            <div className="rounded bg-bg-surface p-2 text-[11px] border border-[var(--border-subtle)] space-y-1">
              <div className="font-semibold text-content-muted flex items-center gap-1">
                <Camera size={12} className="text-brand-sky" /> Proof Required:
              </div>
              <div className="text-content-secondary truncate">{quest.proofRequired}</div>
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

              <div className="flex items-center gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBounty(quest);
                  }}
                  variant="outline"
                  className="px-2.5 py-1 text-xs"
                >
                  View Details
                </Button>
                {quest.status === 'open' && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBounty(quest);
                    }}
                    className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1 text-xs"
                  >
                    Claim (+₹{quest.rewardInr})
                  </Button>
                )}
                {quest.status === 'completed' && (
                  <span className="text-[11px] font-semibold text-brand-sky flex items-center gap-1">
                    <CheckCircle2 size={12} /> Claimed by @{quest.claimedBy}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Bounty Drill-Down Page (Full In-Page Experience) ─────────────────────
function BountyDrillDownPage({
  quest,
  onBack,
  onClaim,
  claimingSuccess,
  lang = 'en',
}: {
  quest: BountyQuest;
  onBack: () => void;
  onClaim: (proof: string) => void;
  claimingSuccess?: boolean;
  lang?: import('@/lib/types').Lang;
}) {
  const [proofText, setProofText] = useState('');
  const [submitted, setSubmitted] = useState(quest.status === 'completed' || Boolean(claimingSuccess));
  const [copied, setCopied] = useState(false);

  function handleSubmitProof(e: React.FormEvent) {
    e.preventDefault();
    if (!proofText.trim()) return;
    onClaim(proofText);
    setSubmitted(true);
  }

  function handleShare() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-5 section-enter">
      {/* ── Top Navigation Bar ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <button
          onClick={onBack}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} />
          <span>
            {lang === 'bn' ? 'বাউন্টিতে ফিরে যান' : lang === 'hi' ? 'बाउंटी पर वापस जाएं' : 'Back to Bounty Quests'}
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="press-effect flex items-center gap-1.5 rounded-pill border border-[var(--border-subtle)] bg-bg-surface px-3 py-1.5 text-xs font-semibold text-content-secondary hover:text-content-primary"
          >
            {copied ? <Check size={13} className="text-brand-emerald" /> : <Share2 size={13} />}
            <span>{copied ? 'Link Copied' : 'Share Quest'}</span>
          </button>
        </div>
      </div>

      {/* ── Quest Header Card ── */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
              ₹{quest.rewardInr} Instant UPI
            </Badge>
            <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
              {quest.type.replace('_', ' ').toUpperCase()}
            </Badge>
            {submitted || quest.status === 'completed' ? (
              <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
                <CheckCircle2 size={12} className="mr-1" /> Claim Verified
              </Badge>
            ) : (
              <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">
                <Clock size={12} className="mr-1" /> Open for Verification
              </Badge>
            )}
          </div>

          <div className="font-mono text-2xl font-black text-brand-emerald">
            +{formatINR(quest.rewardInr)}
          </div>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-content-primary leading-tight">
            {quest.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-content-muted">
            {quest.location && (
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-brand-emerald" /> {quest.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <User size={13} /> Posted by {quest.postedBy}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={13} /> Expires in 48 hours
            </span>
          </div>
        </div>

        <p className="text-sm text-content-secondary leading-relaxed bg-bg-surface p-4 rounded-button border border-[var(--border-subtle)]">
          {quest.description}
        </p>

        {/* Verification Requirements Specification */}
        <div className="rounded-button border border-brand-sky/20 bg-brand-sky/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-brand-sky">
            <Camera size={14} /> Verification Protocol & Proof Required
          </div>
          <p className="text-xs text-content-secondary leading-relaxed">
            {quest.proofRequired}
          </p>
          <div className="text-[11px] text-content-muted flex items-center gap-2">
            <ShieldCheck size={13} className="text-brand-emerald" />
            <span>VeriPulse cryptographic attestation and GPS timestamping verify authenticity before payout.</span>
          </div>
        </div>
      </Card>

      {/* ── Submission / Proof Section ── */}
      <Card className="p-5 sm:p-6 space-y-4">
        {submitted || quest.status === 'completed' ? (
          <div className="rounded-button border border-brand-emerald/40 bg-[var(--brand-emerald-glow)] p-5 text-center space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-brand-emerald" />
            <h3 className="text-base font-bold text-brand-emerald">
              Proof Submitted & Bounty Claimed!
            </h3>
            <p className="text-xs text-content-secondary max-w-md mx-auto">
              Your submission has been cryptographically recorded on the VeriPulse ledger. +₹{quest.rewardInr} has been credited to your citizen balance.
            </p>
            <div className="pt-2">
              <Button onClick={onBack} className="bg-brand-emerald text-[#04110b] font-bold text-xs px-4 py-2">
                <ArrowLeft size={14} className="mr-1.5" /> Return to Bounty Quests
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitProof} className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-content-primary flex items-center gap-2">
                <Send size={16} className="text-brand-emerald" /> Submit On-Ground Evidence
              </h3>
              <p className="text-xs text-content-muted mt-0.5">
                Provide observation notes, direct observation timestamps, photo URLs, or telemetry values.
              </p>
            </div>

            <textarea
              rows={4}
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              placeholder="e.g. Verified in person at 3:15 PM at Howrah Bridge. Traffic is flowing smoothly on both lanes. Attached C2PA image metadata hash: c2pa_sha256_90fe21..."
              className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-3 text-xs text-content-primary focus:border-brand-emerald focus:outline-none leading-relaxed"
              required
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-content-muted">
                ⚡ Reward ₹{quest.rewardInr} will be transferred directly to your wallet upon verification.
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" type="button" onClick={onBack} className="text-xs px-3 py-1.5">
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand-emerald text-[#04110b] font-bold text-xs px-4 py-2 flex items-center gap-1.5">
                  <Camera size={14} /> Submit Proof & Collect ₹{quest.rewardInr}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

// ── Create Bounty Page (Full In-Page Experience) ─────────────────────────
function CreateBountyPage({
  onBack,
  onSubmit,
  lang = 'en',
}: {
  onBack: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    type: BountyType;
    rewardInr: number;
    location: string;
    proofRequired: string;
  }) => void;
  lang?: import('@/lib/types').Lang;
}) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [reward, setReward] = useState(50);
  const [location, setLocation] = useState('Kolkata, WB');
  const [type, setType] = useState<BountyType>('news_verification');
  const [proofRequired, setProofRequired] = useState('C2PA-verified camera photo or verified telemetry screenshot');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !desc.trim()) return;
    onSubmit({
      title: title.trim(),
      description: desc.trim(),
      type,
      rewardInr: reward,
      location: location.trim(),
      proofRequired: proofRequired.trim(),
    });
  }

  const rewardPresets = [25, 50, 100, 200, 500];

  return (
    <div className="space-y-5 section-enter">
      {/* ── Top Navigation Bar ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <button
          onClick={onBack}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} />
          <span>
            {lang === 'bn' ? 'বাউন্টিতে ফিরে যান' : lang === 'hi' ? 'बाउंटी पर वापस जाएं' : 'Back to Bounty Quests'}
          </span>
        </button>

        <span className="text-xs font-semibold text-content-muted">
          New Community Task
        </span>
      </div>

      <Card className="p-5 sm:p-6 space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <Target size={20} className="text-brand-emerald" />
            <h1 className="text-xl font-bold text-content-primary">
              Post a Community Verification Bounty
            </h1>
          </div>
          <p className="text-xs text-content-muted mt-1 leading-relaxed">
            Need on-ground citizens, verified device owners, or local residents to confirm something? Fund a quick micro-bounty.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-content-secondary font-semibold">Bounty Question / Goal</label>
            <input
              type="text"
              required
              placeholder="e.g. Is the MG Road flyover repair finished and open to traffic?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="text-content-secondary font-semibold">Detailed Instructions for Reporters</label>
            <textarea
              rows={3}
              required
              placeholder="Explain exactly what you want the reporter to inspect, verify, or photograph..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-content-secondary font-semibold">Task Category</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as BountyType)}
                className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              >
                <option value="news_verification">News / Rumor Verification</option>
                <option value="road_condition">Road & Traffic Condition</option>
                <option value="product_telemetry">Product & Battery Telemetry</option>
                <option value="price_check">Local Market Price Check</option>
              </select>
            </div>

            <div>
              <label className="text-content-secondary font-semibold">Target Location</label>
              <input
                type="text"
                placeholder="e.g. MG Road, Kolkata, WB"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-content-secondary font-semibold">Proof & Evidence Required</label>
            <input
              type="text"
              placeholder="e.g. Real-time photo with location stamp or speedometer screenshot"
              value={proofRequired}
              onChange={(e) => setProofRequired(e.target.value)}
              className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="text-content-secondary font-semibold">Reward Amount (₹ INR)</label>
            <div className="mt-1.5 flex items-center gap-2">
              {rewardPresets.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setReward(amt)}
                  className={`rounded-pill px-3 py-1 font-mono text-xs font-bold transition-all ${
                    reward === amt
                      ? 'bg-brand-emerald text-[#04110b]'
                      : 'bg-bg-elevated text-content-muted hover:text-content-primary'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
              <input
                type="number"
                min="10"
                max="2000"
                value={reward}
                onChange={(e) => setReward(Number(e.target.value))}
                className="w-20 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-1.5 text-center font-mono text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-subtle)]">
            <Button variant="ghost" type="button" onClick={onBack} className="text-xs px-3 py-1.5">
              Cancel
            </Button>
            <Button type="submit" className="bg-brand-emerald text-[#04110b] font-bold text-xs px-4 py-2">
              Fund & Launch Bounty (₹{reward})
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
