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
  Coins,
  Trophy,
  History,
  Calendar,
  Award,
  ChevronRight,
  Timer,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_BOUNTIES, DEMO_BOUNTY_CYCLES } from '@/lib/demoData';
import { formatINR, formatVPCoins, inrToVPCoins, vpCoinsToINR } from '@/lib/utils';
import { recordMasterTransaction } from '@/lib/transactions';
import { useLang } from '@/hooks/useLang';
import type { BountyQuest, BountyType, BountyLeaderboardCycle } from '@/lib/types';

import {
  isBountyExpired,
  formatBountyTimeRemaining,
  BOUNTY_EXPIRY_MS,
  BOUNTY_EXPIRY_HOURS,
} from '@/lib/bounties';
export { isBountyExpired, formatBountyTimeRemaining, BOUNTY_EXPIRY_MS, BOUNTY_EXPIRY_HOURS };

export function BountyQuests({ onClaimSuccess }: { onClaimSuccess?: (reward: number) => void }) {
  const { lang } = useLang();
  const [bounties, setBounties] = useState<BountyQuest[]>(DEMO_BOUNTIES);
  const [subView, setSubView] = useState<'tasks' | 'leaderboard'>('tasks');
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'expired' | 'claimed'>('open');
  const [selectedCycleId, setSelectedCycleId] = useState<string>(DEMO_BOUNTY_CYCLES[0].cycleId);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [selectedBounty, setSelectedBounty] = useState<BountyQuest | null>(null);
  const [claimingSuccessId, setClaimingSuccessId] = useState<string | null>(null);

  const filtered = bounties.filter((b) => {
    const expired = isBountyExpired(b);
    if (activeFilter === 'open') return !expired && b.status === 'open';
    if (activeFilter === 'expired') return expired || b.status === 'expired';
    if (activeFilter === 'claimed') return b.status === 'claimed' || b.status === 'completed';
    return true;
  });

  const selectedCycle =
    DEMO_BOUNTY_CYCLES.find((c) => c.cycleId === selectedCycleId) || DEMO_BOUNTY_CYCLES[0];

  async function handleCreateBounty(questData: {
    title: string;
    description: string;
    type: BountyType;
    rewardInr: number;
    location: string;
    proofRequired: string;
  }) {
    const rewardVp = inrToVPCoins(questData.rewardInr);
    const quest: BountyQuest = {
      id: `b-${Date.now()}`,
      title: questData.title,
      description: questData.description,
      type: questData.type,
      rewardInr: questData.rewardInr,
      rewardVpCoins: rewardVp,
      postedBy: 'You (Citizen)',
      location: questData.location,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + BOUNTY_EXPIRY_MS).toISOString(), // Strictly 2 hours!
      status: 'open',
      proofRequired: questData.proofRequired || 'C2PA-verified camera photo or verified telemetry screenshot',
    };

    setBounties([quest, ...bounties]);
    setShowCreatePage(false);

    // Record escrow transaction in master DB
    await recordMasterTransaction({
      userId: 'user-citizen-me',
      type: 'bounty_creation',
      deltaInr: -questData.rewardInr,
      deltaVp: -rewardVp,
      description: `Bounty posted: ${questData.title} (2h verification window)`,
      referenceId: quest.id,
      metadata: { location: questData.location, type: questData.type },
    });
  }

  async function handleCompleteClaim(bountyId: string, proof: string) {
    if (!proof.trim()) return;

    const b = bounties.find((x) => x.id === bountyId);
    if (!b || isBountyExpired(b)) return;

    const rewardVp = b.rewardVpCoins ?? inrToVPCoins(b.rewardInr);

    setBounties((prev) =>
      prev.map((item) =>
        item.id === bountyId
          ? { ...item, status: 'completed', claimedBy: 'you_verified' }
          : item,
      ),
    );

    setClaimingSuccessId(bountyId);
    onClaimSuccess?.(b.rewardInr);

    // Record claim credit into Master DB
    await recordMasterTransaction({
      userId: 'user-citizen-me',
      type: 'bounty_reward',
      deltaInr: b.rewardInr,
      deltaVp: rewardVp,
      description: `Bounty reward: ${b.title}`,
      referenceId: b.id,
      metadata: { proofSnippet: proof.slice(0, 100) },
    });
  }

  // ── Full Page Intercepts ───────────────────────────────────────────────
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
      {/* ── Sub Navigation: Tasks vs Leaderboard ── */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSubView('tasks')}
            className={`flex items-center gap-1.5 rounded-button px-3.5 py-1.5 text-xs font-bold transition-all ${
              subView === 'tasks'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'bg-bg-surface text-content-secondary hover:text-content-primary'
            }`}
          >
            <Target size={14} /> Available Tasks (2h Window)
          </button>
          <button
            onClick={() => setSubView('leaderboard')}
            className={`flex items-center gap-1.5 rounded-button px-3.5 py-1.5 text-xs font-bold transition-all ${
              subView === 'leaderboard'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'bg-bg-surface text-content-secondary hover:text-content-primary'
            }`}
          >
            <Trophy size={14} /> Bounty Leaderboard (24h Live & Past)
          </button>
        </div>

        {subView === 'tasks' && (
          <Button
            onClick={() => setShowCreatePage(true)}
            className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1.5 text-xs flex items-center gap-1.5"
          >
            <Plus size={14} /> Post a Bounty Task
          </Button>
        )}
      </div>

      {/* ── SUBVIEW: LEADERBOARD & 24H PAST ARCHIVE ── */}
      {subView === 'leaderboard' ? (
        <BountyLeaderboardView
          cycles={DEMO_BOUNTY_CYCLES}
          selectedCycle={selectedCycle}
          onSelectCycleId={setSelectedCycleId}
        />
      ) : (
        /* ── SUBVIEW: BOUNTY TASKS ── */
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
                  Citizen Micro-Earnings
                </span>
                <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">
                  <Coins size={11} className="mr-1" /> 10 VP = ₹1
                </Badge>
                <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
                  <Clock size={11} className="mr-1" /> 2-Hour Expiration Rule
                </Badge>
              </div>
              <h3 className="mt-1 text-base font-extrabold text-content-primary">
                Hyperlocal &quot;Verify This&quot; Bounty Quests
              </h3>
              <p className="text-xs text-content-muted">
                Tasks expire in 2 hours to ensure fresh on-ground reporting. Verified claims credit real VPcoins directly to your unified master transaction DB.
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveFilter('open')}
                className={`rounded-pill px-3 py-1 text-xs font-semibold ${
                  activeFilter === 'open'
                    ? 'bg-brand-emerald text-[#04110b]'
                    : 'bg-bg-elevated text-content-muted hover:text-content-primary'
                }`}
              >
                Open Tasks ({bounties.filter((b) => !isBountyExpired(b) && b.status === 'open').length})
              </button>
              <button
                onClick={() => setActiveFilter('expired')}
                className={`rounded-pill px-3 py-1 text-xs font-semibold ${
                  activeFilter === 'expired'
                    ? 'bg-brand-rose text-white'
                    : 'bg-bg-elevated text-content-muted hover:text-content-primary'
                }`}
              >
                Expired ({bounties.filter((b) => isBountyExpired(b)).length})
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
                All ({bounties.length})
              </button>
            </div>

            <span className="text-[11px] text-content-muted">
              Showing {filtered.length} tasks
            </span>
          </div>

          {/* Bounty Cards List */}
          <div className="space-y-3">
            {filtered.map((quest) => {
              const rewardVp = quest.rewardVpCoins ?? inrToVPCoins(quest.rewardInr);
              const expired = isBountyExpired(quest);
              const timeRemaining = formatBountyTimeRemaining(quest);

              return (
                <Card
                  key={quest.id}
                  onClick={() => setSelectedBounty(quest)}
                  className={`group p-4 space-y-3 cursor-pointer transition-all ${
                    expired
                      ? 'opacity-70 bg-bg-surface/60 border-dashed border-[var(--border-subtle)]'
                      : 'hover:border-brand-emerald/40 hover:bg-bg-elevated/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">
                          +{formatVPCoins(rewardVp)}
                        </Badge>
                        <span className="text-[11px] font-semibold text-content-muted uppercase">
                          {quest.type.replace('_', ' ')}
                        </span>

                        {/* Status Badges */}
                        {quest.status === 'completed' ? (
                          <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
                            <CheckCircle2 size={11} className="mr-1" /> Completed
                          </Badge>
                        ) : expired ? (
                          <Badge color="var(--brand-rose)" bg="rgba(244,63,94,0.12)">
                            <AlertCircle size={11} className="mr-1" /> Expired (2h limit)
                          </Badge>
                        ) : (
                          <Badge color="var(--brand-emerald)" bg="rgba(16,185,129,0.12)">
                            <Timer size={11} className="mr-1 animate-pulse" /> {timeRemaining}
                          </Badge>
                        )}
                      </div>

                      <h4 className="mt-1.5 text-sm font-bold text-content-primary leading-snug group-hover:text-brand-emerald transition-colors">
                        {quest.title}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-base sm:text-lg font-black text-brand-amber">
                        +{formatVPCoins(rewardVp)}
                      </div>
                      <div className="font-mono text-[10px] text-content-muted">
                        ({formatINR(quest.rewardInr)})
                      </div>
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
                      {!expired && quest.status === 'open' && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBounty(quest);
                          }}
                          className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1 text-xs"
                        >
                          Claim (+{formatVPCoins(rewardVp)})
                        </Button>
                      )}
                      {expired && (
                        <span className="text-[11px] font-semibold text-brand-rose flex items-center gap-1">
                          <AlertCircle size={12} /> Expired
                        </span>
                      )}
                      {quest.status === 'completed' && (
                        <span className="text-[11px] font-semibold text-brand-sky flex items-center gap-1">
                          <CheckCircle2 size={12} /> Claimed by @{quest.claimedBy}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 24-Hour Bounty Leaderboard & Past Archive View ────────────────────────
function BountyLeaderboardView({
  cycles,
  selectedCycle,
  onSelectCycleId,
}: {
  cycles: BountyLeaderboardCycle[];
  selectedCycle: BountyLeaderboardCycle;
  onSelectCycleId: (id: string) => void;
}) {
  const isActive = selectedCycle.status === 'active';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Cycle Selector & 24h Archive Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-amber flex items-center gap-1">
              <Trophy size={13} /> Sentinel Leaderboard
            </span>
            <Badge
              color={isActive ? 'var(--brand-emerald)' : 'var(--brand-sky)'}
              bg={isActive ? 'rgba(16,185,129,0.12)' : 'rgba(14,165,233,0.12)'}
            >
              {isActive ? '🟢 Live 24-Hour Cycle' : '📜 Past Cycle Archive'}
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            {selectedCycle.cycleName}
          </h3>
          <p className="text-xs text-content-muted">
            {isActive
              ? 'Leaderboard resets every 24 hours. At cycle end, standings are archived into Past Leaderboards for permanent reference.'
              : `Archived standings for ${selectedCycle.cycleDate}. Stored in master DB for historical audit.`}
          </p>
        </div>

        {/* Cycle Switcher Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-muted font-medium flex items-center gap-1">
            <History size={13} /> Select Cycle:
          </span>
          <select
            value={selectedCycle.cycleId}
            onChange={(e) => onSelectCycleId(e.target.value)}
            className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated px-3 py-1.5 text-xs font-bold text-content-primary focus:border-brand-emerald focus:outline-none"
          >
            {cycles.map((c) => (
              <option key={c.cycleId} value={c.cycleId}>
                {c.status === 'active' ? '🟢 ' : '📜 '}
                {c.cycleName} ({c.cycleDate})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Cycle Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-bg-surface border-[var(--border-subtle)]">
          <span className="text-[10px] text-content-muted font-semibold uppercase">Cycle Status</span>
          <div className="mt-1 flex items-center gap-1.5 font-bold text-xs text-content-primary">
            {isActive ? (
              <>
                <Timer size={14} className="text-brand-emerald animate-pulse" />
                <span>Ends in ~15h</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} className="text-brand-sky" />
                <span>Sealed & Paid Out</span>
              </>
            )}
          </div>
        </Card>

        <Card className="p-3 bg-bg-surface border-[var(--border-subtle)]">
          <span className="text-[10px] text-content-muted font-semibold uppercase">Bounties Solved</span>
          <div className="mt-1 font-mono font-extrabold text-sm text-content-primary">
            {selectedCycle.totalBountiesCompleted} Verified
          </div>
        </Card>

        <Card className="p-3 bg-bg-surface border-[var(--border-subtle)]">
          <span className="text-[10px] text-content-muted font-semibold uppercase">Total VP Distributed</span>
          <div className="mt-1 font-mono font-extrabold text-sm text-brand-amber">
            {formatVPCoins(selectedCycle.totalVpDistributed)}
          </div>
        </Card>

        <Card className="p-3 bg-bg-surface border-[var(--border-subtle)]">
          <span className="text-[10px] text-content-muted font-semibold uppercase">INR Pool Equivalent</span>
          <div className="mt-1 font-mono font-extrabold text-sm text-brand-emerald">
            {formatINR(selectedCycle.totalInrDistributed)}
          </div>
        </Card>
      </div>

      {/* ── Podium Cards for Top 3 Hunters ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {selectedCycle.podiumWinners.map((winner) => {
          const isFirst = winner.rank === 1;
          const isSecond = winner.rank === 2;
          return (
            <Card
              key={winner.userId}
              className={`p-4 relative space-y-2.5 overflow-hidden border ${
                isFirst
                  ? 'border-brand-amber/50 bg-brand-amber/5'
                  : isSecond
                  ? 'border-brand-sky/40 bg-brand-sky/5'
                  : 'border-[var(--border-subtle)] bg-bg-surface'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-pill px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    isFirst
                      ? 'bg-brand-amber text-black'
                      : isSecond
                      ? 'bg-brand-sky text-white'
                      : 'bg-brand-emerald text-black'
                  }`}
                >
                  Rank #{winner.rank} {isFirst ? '🏆 Champion' : isSecond ? '🥈 Runner-Up' : '🥉 3rd Place'}
                </span>
                <span className="font-mono text-xs font-black text-brand-amber">
                  +{formatVPCoins(winner.vpCoinsEarned)}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={winner.avatarUrl}
                  alt={winner.displayName}
                  className="h-10 w-10 rounded-full object-cover border border-[var(--border-subtle)]"
                />
                <div>
                  <h4 className="text-xs font-bold text-content-primary leading-tight">
                    {winner.displayName}
                  </h4>
                  <span className="text-[10px] font-mono text-content-muted">@{winner.username}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] border-t border-[var(--border-subtle)] pt-2 text-content-muted">
                <span>{winner.bountiesCompleted} Bounties Solved</span>
                <span className="font-mono font-semibold text-brand-emerald">{winner.accuracyPercent}% Accuracy</span>
              </div>

              <div className="flex flex-wrap gap-1">
                {winner.proofBadges.map((badge, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-bg-surface border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] font-semibold text-content-secondary"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Standings Table ── */}
      <Card className="p-4 border-[var(--border-subtle)]">
        <h4 className="text-xs font-bold text-content-primary mb-3 flex items-center justify-between">
          <span>Complete Cycle Standings ({selectedCycle.rankings.length} Verifiers)</span>
          <span className="text-[10px] text-content-muted font-normal">
            Verified proof hashed in Master DB
          </span>
        </h4>

        <div className="space-y-2 text-xs">
          {selectedCycle.rankings.map((user) => (
            <div
              key={user.userId}
              className="flex items-center justify-between rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 transition-colors hover:bg-bg-elevated/40"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold w-6 text-center text-content-muted">
                  #{user.rank}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="h-8 w-8 rounded-full object-cover border border-[var(--border-subtle)]"
                />
                <div>
                  <div className="font-bold text-content-primary flex items-center gap-1.5">
                    <span>{user.displayName}</span>
                    <Badge color="var(--brand-emerald)" bg="rgba(16,185,129,0.12)">
                      {user.tier === 'sentinel_t1' ? 'Sentinel T1' : 'Validator T2'}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-content-muted">
                    @{user.username} · {user.bountiesCompleted} tasks completed
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono font-bold text-brand-amber">
                  +{formatVPCoins(user.vpCoinsEarned)}
                </div>
                <div className="font-mono text-[10px] text-content-muted">
                  ({formatINR(user.inrEarned)})
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Bounty Drill-Down Page ───────────────────────────────────────────────
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
  const expired = isBountyExpired(quest);
  const timeRemaining = formatBountyTimeRemaining(quest);
  const rewardVp = quest.rewardVpCoins ?? inrToVPCoins(quest.rewardInr);

  function handleSubmitProof(e: React.FormEvent) {
    e.preventDefault();
    if (!proofText.trim() || expired) return;
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
            <span>{copied ? 'Copied' : 'Share Quest'}</span>
          </button>
        </div>
      </div>

      {/* ── Expiration Alert Banner ── */}
      {expired && (
        <div className="rounded-card border border-brand-rose/40 bg-brand-rose/10 p-4 text-xs text-brand-rose flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm">Bounty Expired (2-Hour Lifespan Elapsed):</span>
            <p className="mt-1 text-content-secondary leading-relaxed">
              This verification quest was open for 2 hours and has now expired. To ensure real-time accuracy and protect on-ground freshness, expired tasks cannot accept submissions.
            </p>
          </div>
        </div>
      )}

      {/* ── Main Detail Card ── */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">
              +{formatVPCoins(rewardVp)}
            </Badge>
            <span className="text-xs font-semibold text-content-muted uppercase">
              {quest.type.replace('_', ' ')}
            </span>
            {quest.status === 'completed' ? (
              <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
                <CheckCircle2 size={11} className="mr-1" /> Completed
              </Badge>
            ) : expired ? (
              <Badge color="var(--brand-rose)" bg="rgba(244,63,94,0.12)">
                <AlertCircle size={11} className="mr-1" /> Expired (2h limit)
              </Badge>
            ) : (
              <Badge color="var(--brand-emerald)" bg="rgba(16,185,129,0.12)">
                <Clock size={11} className="mr-1" /> {timeRemaining}
              </Badge>
            )}
          </div>

          <div className="text-right">
            <span className="text-[10px] text-content-muted uppercase font-semibold">Reward Value</span>
            <div className="font-mono text-xl font-extrabold text-brand-amber">
              +{formatVPCoins(rewardVp)} <span className="text-xs text-content-muted">({formatINR(quest.rewardInr)})</span>
            </div>
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-extrabold text-content-primary leading-tight">
          {quest.title}
        </h2>

        <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
          {quest.description}
        </p>

        {/* Location & Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {quest.location && (
            <div className="flex items-center gap-2 text-xs text-content-muted bg-bg-surface p-2.5 rounded-button border border-[var(--border-subtle)]">
              <MapPin size={14} className="text-brand-emerald shrink-0" />
              <span>Location: <strong className="text-content-primary">{quest.location}</strong></span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-content-muted bg-bg-surface p-2.5 rounded-button border border-[var(--border-subtle)]">
            <Clock size={14} className="text-brand-sky shrink-0" />
            <span>2-Hour Lifespan: <strong className="text-content-primary">{expired ? 'Expired' : timeRemaining}</strong></span>
          </div>
        </div>

        {/* Proof Requirement Card */}
        <div className="rounded-card border border-[var(--border-strong)] bg-bg-surface p-4 space-y-2">
          <div className="text-xs font-bold text-content-primary flex items-center gap-1.5">
            <Camera size={14} className="text-brand-sky" /> Required Evidence & Verification Criteria
          </div>
          <p className="text-xs text-content-secondary leading-relaxed">
            {quest.proofRequired}
          </p>
          <div className="text-[11px] text-content-muted flex items-center gap-2 pt-1">
            <ShieldCheck size={13} className="text-brand-emerald" />
            <span>All claims are hashed and logged to the master transaction database.</span>
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
              Your submission has been cryptographically recorded on the VeriPulse master transaction database. +{formatVPCoins(rewardVp)} has been credited to your citizen wallet balance.
            </p>
            <div className="pt-2">
              <Button onClick={onBack} className="bg-brand-emerald text-[#04110b] font-bold text-xs px-4 py-2">
                <ArrowLeft size={14} className="mr-1.5" /> Return to Bounty Quests
              </Button>
            </div>
          </div>
        ) : expired ? (
          <div className="text-center py-6 text-content-muted text-xs space-y-2">
            <AlertCircle size={24} className="mx-auto text-brand-rose" />
            <p className="font-semibold text-content-primary">Submissions Closed</p>
            <p>This quest exceeded its 2-hour window and cannot be claimed.</p>
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
                ⚡ Reward +{formatVPCoins(rewardVp)} will be transferred directly to your VP master wallet upon submission.
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" type="button" onClick={onBack} className="text-xs px-3 py-1.5">
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand-emerald text-[#04110b] font-bold text-xs px-4 py-2 flex items-center gap-1.5">
                  <Camera size={14} /> Submit Proof & Collect +{formatVPCoins(rewardVp)}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

// ── Create Bounty Page ───────────────────────────────────────────────────
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

      <div className="rounded-card border border-brand-sky/30 bg-brand-sky/10 p-3.5 text-xs text-brand-sky flex items-center gap-2">
        <Clock size={15} className="shrink-0" />
        <span>
          <strong>2-Hour Expiration Rule:</strong> All community verification bounties remain active for exactly 2 hours to enforce rapid, real-time ground truth.
        </span>
      </div>

      <Card className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-content-primary">
              Post a Verification Bounty Quest
            </h3>
            <p className="text-xs text-content-muted">
              Fund a task to verify breaking news, road conditions, gadget performance, or service center wait times.
            </p>
          </div>

          {/* Quest Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-content-primary">Quest Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'news_verification', label: 'News Verification' },
                { id: 'product_telemetry', label: 'Product Telemetry' },
                { id: 'service_center', label: 'Service Center' },
                { id: 'price_check', label: 'Price Audit' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setType(opt.id as BountyType)}
                  className={`rounded-button p-2 text-xs font-bold transition-all border ${
                    type === opt.id
                      ? 'bg-brand-emerald text-[#04110b] border-brand-emerald'
                      : 'bg-bg-surface text-content-secondary border-[var(--border-subtle)] hover:bg-bg-elevated'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-content-primary">Task Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Is EM Bypass waterlogged near Ruby Hospital?"
              className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-content-primary">Detailed Instructions</label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Explain exactly what the citizen investigator needs to check on the ground..."
              className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none leading-relaxed"
              required
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-content-primary">Location / Landmark</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Park Street, Kolkata or Online (Device Telemetry)"
              className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          {/* Proof Required */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-content-primary">Proof Required</label>
            <input
              type="text"
              value={proofRequired}
              onChange={(e) => setProofRequired(e.target.value)}
              placeholder="e.g. C2PA-verified camera photo or verified telemetry screenshot"
              className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              required
            />
          </div>

          {/* Reward Amount in INR & VP */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-content-primary">Bounty Reward</label>
              <span className="font-mono text-xs font-bold text-brand-amber">
                +{formatVPCoins(inrToVPCoins(reward))} ({formatINR(reward)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {rewardPresets.map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setReward(amt)}
                  className={`rounded-button px-3 py-1.5 text-xs font-mono font-bold transition-all border ${
                    reward === amt
                      ? 'bg-brand-amber text-black border-brand-amber'
                      : 'bg-bg-surface text-content-secondary border-[var(--border-subtle)] hover:bg-bg-elevated'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <Button variant="ghost" type="button" onClick={onBack} className="text-xs px-3 py-1.5">
              Cancel
            </Button>
            <Button type="submit" className="bg-brand-emerald text-[#04110b] font-bold text-xs px-4 py-2">
              Lock Escrow & Post Bounty (₹{reward})
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
