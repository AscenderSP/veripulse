'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  User,
  UserCheck,
  UserPlus,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  Trash2,
  Edit3,
  Share2,
  Copy,
  ExternalLink,
  MapPin,
  Calendar,
  Award,
  Wallet,
  Sparkles,
  Check,
  X,
  Search,
  RefreshCw,
  Send,
  Lock,
  ChevronRight,
  AtSign,
  Globe,
  Smartphone,
  ArrowLeft,
  Coins,
} from 'lucide-react';
import { Button, Card, CustomSelect } from '@/components/ui/primitives';
import { cn, formatINR, formatVPCoins, inrToVPCoins, timeAgo } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';
import { DEMO_PRESET_PROFILES, DEMO_NETWORK_USERS } from '@/lib/demoData';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import type { Profile, NetworkUser, SocialLinks, UserContact } from '@/lib/types';

interface ProfileViewProps {
  onVerifyDoc?: () => void;
  onNavigateToWallet?: () => void;
}

type ProfileTab = 'overview' | 'verify' | 'network' | 'social' | 'settings';

export function ProfileView({ onVerifyDoc, onNavigateToWallet }: ProfileViewProps) {
  const { lang } = useLang();
  const {
    profile,
    signOut,
    deleteAccount,
    signInPreset,
    signUp,
    signInWithOtpMock,
    updateProfile,
    verifyIdentity,
    followingIds,
    toggleFollow,
    contacts,
    inviteContact,
  } = useSession();

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [networkSubTab, setNetworkSubTab] = useState<'followers' | 'following' | 'suggested'>('followers');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [socialEditOpen, setSocialEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [switchAccountOpen, setSwitchAccountOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShare = () => {
    if (!profile) return;
    const shareUrl = `https://veripulse.in/u/${profile.username}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedLink(true);
        showToast('Profile link copied to clipboard!');
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  // If user is logged out, render the Sign Up / Login onboarding hub
  if (!profile) {
    return <LoggedOutHub onSignInPreset={signInPreset} onSignUp={signUp} onSignInOtp={signInWithOtpMock} />;
  }

  // ── Full Page Intercepts (News Hub Pattern) ─────────────────────────────
  if (editOpen) {
    return (
      <EditProfilePage
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSave={(patch) => {
          updateProfile(patch);
          setEditOpen(false);
          showToast('Profile updated successfully!');
        }}
        lang={lang}
      />
    );
  }

  if (socialEditOpen) {
    return (
      <EditSocialLinksPage
        links={profile.social_links ?? {}}
        onClose={() => setSocialEditOpen(false)}
        onSave={(socials) => {
          updateProfile({ social_links: socials });
          setSocialEditOpen(false);
          showToast('Social links updated!');
        }}
        lang={lang}
      />
    );
  }

  if (switchAccountOpen) {
    return (
      <SwitchAccountPage
        currentProfileId={profile.id}
        onClose={() => setSwitchAccountOpen(false)}
        onSelect={(preset) => {
          signInPreset(preset);
          setSwitchAccountOpen(false);
          showToast(`Switched account to @${preset.username}`);
        }}
        lang={lang}
      />
    );
  }

  if (deleteOpen) {
    return (
      <DeleteAccountPage
        username={profile.username}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteAccount();
          setDeleteOpen(false);
          showToast('Account permanently deleted.');
        }}
        lang={lang}
      />
    );
  }

  return (
    <div className="space-y-6 stagger-children">
      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-button bg-brand-emerald px-4 py-2.5 text-xs font-semibold text-[#04110b] shadow-lg toast-enter glass" style={{ background: 'var(--brand-emerald)', color: '#04110b' }}>
          <CheckCircle2 size={16} />
          {toastMessage}
        </div>
      )}

      {/* ── Top Header Profile Card ── */}
      <Card className="relative overflow-hidden p-5 orb-bg">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Avatar with Status Ring */}
          <div className="relative shrink-0">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-brand-emerald bg-bg-elevated">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name ?? profile.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-2xl font-bold text-brand-emerald">
                  {(profile.full_name ?? profile.username).slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            {profile.is_id_verified && (
              <span
                title="DigiLocker Identity Verified"
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-emerald text-[#04110b] shadow-md ring-2 ring-bg-surface"
              >
                <ShieldCheck size={14} />
              </span>
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-extrabold text-content-primary">
                    {profile.full_name ?? profile.username}
                  </h1>
                  {profile.badge && (
                    <span className="rounded-pill bg-[var(--brand-emerald-glow)] px-2.5 py-0.5 text-[10px] font-bold text-brand-emerald">
                      {profile.badge}
                    </span>
                  )}
                  {profile.tier === 'sentinel_t1' && (
                    <span className="rounded-pill bg-[rgba(245,158,11,0.15)] px-2.5 py-0.5 text-[10px] font-bold text-brand-amber">
                      Sentinel Prime
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-content-muted">
                  <span>@{profile.username}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {profile.city || 'India'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1" suppressHydrationWarning>
                    <Calendar size={12} /> Joined {timeAgo(profile.created_at)}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                  className="px-3 py-1.5 text-xs"
                >
                  <Edit3 size={13} className="mr-1" /> {t('editProfile', lang)}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="px-3 py-1.5 text-xs"
                >
                  {copiedLink ? <Check size={13} className="mr-1 text-brand-emerald" /> : <Share2 size={13} className="mr-1" />}
                  {copiedLink ? t('copied', lang) : t('shareProfile', lang)}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSwitchAccountOpen(true)}
                  title="Switch Demo User"
                  className="px-2.5 py-1.5 text-xs text-content-muted hover:text-content-primary"
                >
                  <RefreshCw size={13} className="mr-1" /> {lang === 'bn' ? 'ব্যবহারকারী পরিবর্তন' : lang === 'hi' ? 'यूज़र बदलें' : 'Switch'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={signOut}
                  title="Sign Out"
                  className="px-2.5 py-1.5 text-xs text-brand-rose hover:bg-[rgba(244,63,94,0.1)]"
                >
                  <LogOut size={13} className="mr-1" /> {t('signOut', lang)}
                </Button>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-xs text-content-secondary leading-relaxed max-w-2xl">
                {profile.bio}
              </p>
            )}

            {/* Quick Metrics & Follower Counts */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
              <button
                onClick={() => {
                  setActiveTab('network');
                  setNetworkSubTab('followers');
                }}
                className="group flex items-center gap-1.5 transition-colors"
              >
                <span className="font-mono font-bold text-content-primary group-hover:text-brand-emerald">
                  {profile.followers_count ?? 342}
                </span>
                <span className="text-content-muted group-hover:text-content-primary">{t('followers', lang)}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('network');
                  setNetworkSubTab('following');
                }}
                className="group flex items-center gap-1.5 transition-colors"
              >
                <span className="font-mono font-bold text-content-primary group-hover:text-brand-emerald">
                  {profile.following_count ?? followingIds.length}
                </span>
                <span className="text-content-muted group-hover:text-content-primary">{t('following', lang)}</span>
              </button>

              <div className="flex items-center gap-1.5 text-content-muted">
                <ShieldCheck size={13} className="text-brand-emerald" />
                <span>{t('trustScore', lang)}:</span>
                <span className="font-mono font-bold text-brand-emerald">{profile.trust_score.toFixed(1)}/100</span>
              </div>

              {profile.wallet_balance_inr !== undefined && (
                <div
                  onClick={onNavigateToWallet}
                  className="cursor-pointer flex items-center gap-1.5 text-content-muted hover:text-brand-amber transition-colors"
                >
                  <Coins size={13} className="text-brand-amber" />
                  <span>Sentinel VP:</span>
                  <span className="font-mono font-bold text-brand-amber">
                    {formatVPCoins(profile.wallet_balance_vpcoins ?? inrToVPCoins(profile.wallet_balance_inr))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-[var(--glass-border)] pb-2 text-xs no-scrollbar">
        <TabHeaderButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          icon={<Award size={14} />}
          label={t('tabOverview', lang)}
        />
        <TabHeaderButton
          active={activeTab === 'verify'}
          onClick={() => setActiveTab('verify')}
          icon={<ShieldCheck size={14} />}
          label={t('tabVerify', lang)}
          badge={profile.is_id_verified ? (lang === 'bn' ? 'যাচাইকৃত' : lang === 'hi' ? 'सत्यापित' : 'Verified') : (lang === 'bn' ? 'অপেক্ষমান' : lang === 'hi' ? 'लंबित' : 'Pending')}
        />
        <TabHeaderButton
          active={activeTab === 'network'}
          onClick={() => setActiveTab('network')}
          icon={<Users size={14} />}
          label={`${t('tabNetwork', lang)} (${profile.followers_count ?? 342})`}
        />
        <TabHeaderButton
          active={activeTab === 'social'}
          onClick={() => setActiveTab('social')}
          icon={<AtSign size={14} />}
          label={t('tabSocial', lang)}
        />
        <TabHeaderButton
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          icon={<Edit3 size={14} />}
          label={t('tabSettings', lang)}
        />
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'overview' && (
        <OverviewTab
          profile={profile}
          onVerifyDoc={onVerifyDoc}
          onNavigateToWallet={onNavigateToWallet}
          onOpenVerifyTab={() => setActiveTab('verify')}
        />
      )}

      {activeTab === 'verify' && (
        <VerificationCenterTab
          profile={profile}
          onVerifyDoc={onVerifyDoc}
          onVerifyIdentity={async (num, type) => {
            const res = await verifyIdentity(num, type);
            if (res.success) {
              showToast('Identity verified via DigiLocker! +5.0 Trust Points awarded.');
            }
          }}
        />
      )}

      {activeTab === 'network' && (
        <NetworkFollowersTab
          subTab={networkSubTab}
          setSubTab={setNetworkSubTab}
          followingIds={followingIds}
          onToggleFollow={toggleFollow}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}

      {activeTab === 'social' && (
        <ContactsAndSocialTab
          profile={profile}
          contacts={contacts}
          onInviteContact={(id) => {
            inviteContact(id);
            showToast('Referral invite sent! +₹25 credited to your wallet.');
          }}
          onToggleFollow={toggleFollow}
          followingIds={followingIds}
          onOpenSocialEdit={() => setSocialEditOpen(true)}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          profile={profile}
          onOpenEdit={() => setEditOpen(true)}
          onSignOut={signOut}
          onOpenDelete={() => setDeleteOpen(true)}
          onSwitchAccount={() => setSwitchAccountOpen(true)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components: Tabs
// ─────────────────────────────────────────────────────────────────────────────

function TabHeaderButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'press-effect flex shrink-0 items-center gap-1.5 rounded-button px-3 py-2 font-medium transition-all duration-300',
        active
          ? 'glass text-brand-emerald glow-emerald'
          : 'text-content-secondary hover:bg-glass-bg hover:text-content-primary',
      )}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span
          className={cn(
            'rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-bold',
            badge === 'Verified'
              ? 'bg-[var(--brand-emerald-glow)] text-brand-emerald'
              : 'bg-bg-primary text-content-muted',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/** 1. Overview & Trust Tab */
function OverviewTab({
  profile,
  onVerifyDoc,
  onNavigateToWallet,
  onOpenVerifyTab,
}: {
  profile: Profile;
  onVerifyDoc?: () => void;
  onNavigateToWallet?: () => void;
  onOpenVerifyTab: () => void;
}) {
  const voteRatio =
    profile.total_votes > 0
      ? Math.round((profile.correct_votes / profile.total_votes) * 100)
      : 100;

  return (
    <div className="space-y-4">
      {/* Trust & Accuracy Card */}
      <Card className="border-[var(--border-subtle)] bg-bg-surface p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-content-muted">
          Consensus Reliability & Trust Weights
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-card border border-[var(--border-subtle)] bg-bg-primary p-3">
            <div className="text-[10px] text-content-muted">Trust Score</div>
            <div className="mt-1 font-mono text-xl font-bold text-brand-emerald">
              {profile.trust_score.toFixed(1)}
              <span className="text-xs text-content-muted">/100</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full bg-brand-emerald"
                style={{ width: `${Math.min(100, profile.trust_score)}%` }}
              />
            </div>
          </div>

          <div className="rounded-card border border-[var(--border-subtle)] bg-bg-primary p-3">
            <div className="text-[10px] text-content-muted">Consensus Accuracy</div>
            <div className="mt-1 font-mono text-xl font-bold text-content-primary">
              {voteRatio}%
            </div>
            <div className="mt-1 text-[10px] text-content-muted">
              {profile.correct_votes} / {profile.total_votes} correct votes
            </div>
          </div>

          <div className="rounded-card border border-[var(--border-subtle)] bg-bg-primary p-3">
            <div className="text-[10px] text-content-muted">Vote Weight Multiplier</div>
            <div className="mt-1 font-mono text-xl font-bold text-brand-cyan">
              {profile.is_ownership_verified ? '3.0×' : '1.5×'}
            </div>
            <div className="mt-1 text-[10px] text-content-muted">
              {profile.is_ownership_verified ? 'Verified Owner weight' : 'Standard local weight'}
            </div>
          </div>

          <div className="rounded-card border border-[var(--border-subtle)] bg-bg-primary p-3">
            <div className="text-[10px] text-content-muted">
              Sentinel VP Balance
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-brand-amber">
              {formatVPCoins(profile.wallet_balance_vpcoins ?? inrToVPCoins(profile.wallet_balance_inr))}
            </div>
            <button
              onClick={onNavigateToWallet}
              className="mt-1.5 text-[10px] text-brand-emerald hover:underline block"
            >
              Redeem in Wallet →
            </button>
          </div>
        </div>
      </Card>

      {/* Verification Check Status Banner */}
      <Card className="border-[var(--border-subtle)] bg-bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-bold text-content-primary">Citizen Verification Status</h4>
            <p className="text-xs text-content-muted">
              Verified accounts gain higher vote consensus weighting and earn faster payouts.
            </p>
          </div>
          <Button
            variant="solid"
            onClick={onOpenVerifyTab}
            className="px-3 py-1.5 text-xs shrink-0"
          >
            Open Verification Center
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-button border border-[var(--border-subtle)] bg-bg-primary p-2.5 text-xs">
            {profile.is_id_verified ? (
              <CheckCircle2 size={16} className="text-brand-emerald shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-brand-amber shrink-0" />
            )}
            <div>
              <div className="font-semibold text-content-primary">DigiLocker Govt ID</div>
              <div className="text-[10px] text-content-muted">
                {profile.is_id_verified ? 'Zero-Knowledge Verified' : 'Aadhaar/PAN Pending'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-button border border-[var(--border-subtle)] bg-bg-primary p-2.5 text-xs">
            {profile.is_ownership_verified ? (
              <CheckCircle2 size={16} className="text-brand-emerald shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-brand-amber shrink-0" />
            )}
            <div>
              <div className="font-semibold text-content-primary">Vehicle RC / Invoice</div>
              <div className="text-[10px] text-content-muted">
                {profile.is_ownership_verified ? 'Vahan & GST Linked (3× weight)' : 'Unverified Owner'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-button border border-[var(--border-subtle)] bg-bg-primary p-2.5 text-xs">
            {profile.is_sentinel_verified ? (
              <CheckCircle2 size={16} className="text-brand-emerald shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-brand-amber shrink-0" />
            )}
            <div>
              <div className="font-semibold text-content-primary">Sentinel Desk Prime</div>
              <div className="text-[10px] text-content-muted">
                {profile.is_sentinel_verified ? 'Fact-checker certified' : 'Requires >80 Trust'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** 2. Verification Center Tab */
function VerificationCenterTab({
  profile,
  onVerifyDoc,
  onVerifyIdentity,
}: {
  profile: Profile;
  onVerifyDoc?: () => void;
  onVerifyIdentity: (num: string, type: 'aadhaar' | 'pan') => Promise<void>;
}) {
  const [idType, setIdType] = useState<'aadhaar' | 'pan'>('aadhaar');
  const [idInput, setIdInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [hashResult, setHashResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idInput.trim()) return;
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 900)); // simulated cryptographic proof
    await onVerifyIdentity(idInput, idType);
    setHashResult(`zk-proof-sha256:${Date.now().toString(16)}...c2pa`);
    setVerifying(false);
  };

  return (
    <div className="space-y-4">
      {/* DigiLocker Identity Module */}
      <Card className="border-[var(--border-subtle)] bg-bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand-emerald" />
              <h3 className="text-sm font-bold text-content-primary">
                DigiLocker Identity Verification (Govt ID)
              </h3>
            </div>
            <p className="mt-1 text-xs text-content-muted">
              We never store your raw Aadhaar or PAN. A one-way cryptographic hash validates your
              citizen status without revealing sensitive details.
            </p>
          </div>
          {profile.is_id_verified && (
            <span className="rounded-pill bg-[var(--brand-emerald-glow)] px-2.5 py-1 text-xs font-bold text-brand-emerald">
              ✓ Verified Citizen
            </span>
          )}
        </div>

        {profile.is_id_verified ? (
          <div className="mt-4 rounded-card border border-[rgba(16,185,129,0.2)] bg-[var(--brand-emerald-glow)] p-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-brand-emerald">
              <CheckCircle2 size={16} /> Zero-Knowledge Proof Active
            </div>
            <p className="mt-1 text-content-secondary">
              Your identity is verified. Your citizen reports carry high credibility on local civic feeds.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIdType('aadhaar')}
                className={cn(
                  'rounded-button px-3 py-1.5 text-xs font-semibold',
                  idType === 'aadhaar'
                    ? 'bg-brand-emerald text-[#04110b]'
                    : 'bg-bg-elevated text-content-secondary',
                )}
              >
                Aadhaar (12-digits)
              </button>
              <button
                type="button"
                onClick={() => setIdType('pan')}
                className={cn(
                  'rounded-button px-3 py-1.5 text-xs font-semibold',
                  idType === 'pan'
                    ? 'bg-brand-emerald text-[#04110b]'
                    : 'bg-bg-elevated text-content-secondary',
                )}
              >
                PAN Card (10-characters)
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                required
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                placeholder={idType === 'aadhaar' ? 'XXXX-XXXX-XXXX' : 'ABCDE1234F'}
                className="flex-1 rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              />
              <Button type="submit" disabled={verifying} className="px-4 py-2 text-xs">
                {verifying ? 'Hashing...' : 'Verify via DigiLocker'}
              </Button>
            </div>
            {hashResult && (
              <div className="rounded-button bg-bg-primary p-2 font-mono text-[10px] text-brand-emerald">
                {hashResult}
              </div>
            )}
          </form>
        )}
      </Card>

      {/* Vehicle RC & GST Invoices */}
      <Card className="border-[var(--border-subtle)] bg-bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Award size={18} className="text-brand-cyan" />
              <h3 className="text-sm font-bold text-content-primary">
                Product & Vehicle Ownership Verification
              </h3>
            </div>
            <p className="mt-1 text-xs text-content-muted">
              Upload your Vehicle RC or GST Tax Invoice. Verified owners get a 3× consensus vote multiplier
              and can answer queries in the Product Hub.
            </p>
          </div>
          {profile.is_ownership_verified && (
            <span className="rounded-pill bg-[var(--brand-emerald-glow)] px-2.5 py-1 text-xs font-bold text-brand-emerald">
              ✓ 3× Weight Active
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="solid"
            onClick={onVerifyDoc}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs"
          >
            <Sparkles size={14} /> Upload RC or Invoice
          </Button>
        </div>
      </Card>

      {/* Sentinel Certification */}
      <Card className="border-[var(--border-subtle)] bg-bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-brand-amber" />
              <h3 className="text-sm font-bold text-content-primary">Sentinel Fact-Checker License</h3>
            </div>
            <p className="mt-1 text-xs text-content-muted">
              Sentinels audit quarantine reports and examine AI synthetic probability.
              Requires a Trust Score &gt; 80 and at least 50 consensus votes.
            </p>
          </div>
          <span
            className={cn(
              'rounded-pill px-2.5 py-1 text-xs font-bold',
              profile.trust_score >= 80
                ? 'bg-[rgba(245,158,11,0.15)] text-brand-amber'
                : 'bg-bg-elevated text-content-muted',
            )}
          >
            {profile.trust_score >= 80 ? 'Eligible for Prime' : 'Score < 80'}
          </span>
        </div>
      </Card>
    </div>
  );
}

/** 3. Network & Followers Tab */
function NetworkFollowersTab({
  subTab,
  setSubTab,
  followingIds,
  onToggleFollow,
  searchQuery,
  setSearchQuery,
}: {
  subTab: 'followers' | 'following' | 'suggested';
  setSubTab: (t: 'followers' | 'following' | 'suggested') => void;
  followingIds: string[];
  onToggleFollow: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const users = DEMO_NETWORK_USERS.filter((u) => {
    if (subTab === 'following') return followingIds.includes(u.id);
    if (subTab === 'suggested') return !followingIds.includes(u.id);
    return true; // followers tab shows sample followers
  }).filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.city.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Sub-tabs & Search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('followers')}
            className={cn(
              'rounded-button px-3 py-1.5 text-xs font-semibold',
              subTab === 'followers'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'bg-bg-elevated text-content-secondary',
            )}
          >
            Followers
          </button>
          <button
            onClick={() => setSubTab('following')}
            className={cn(
              'rounded-button px-3 py-1.5 text-xs font-semibold',
              subTab === 'following'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'bg-bg-elevated text-content-secondary',
            )}
          >
            Following ({followingIds.length})
          </button>
          <button
            onClick={() => setSubTab('suggested')}
            className={cn(
              'rounded-button px-3 py-1.5 text-xs font-semibold',
              subTab === 'suggested'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'bg-bg-elevated text-content-secondary',
            )}
          >
            Discover Sentinels
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, handle, role..."
            className="w-full sm:w-60 rounded-button border border-[var(--border-subtle)] bg-bg-surface py-1.5 pl-8 pr-3 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
          />
        </div>
      </div>

      {/* Network List */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {users.map((user) => {
          const isFollowed = followingIds.includes(user.id);
          return (
            <Card
              key={user.id}
              className="flex flex-col justify-between border-[var(--border-subtle)] bg-bg-surface p-3.5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-content-primary">{user.name}</span>
                        {user.isVerified && (
                          <ShieldCheck size={12} className="text-brand-emerald" />
                        )}
                      </div>
                      <div className="text-[11px] text-content-muted">@{user.username}</div>
                    </div>
                  </div>

                  <Button
                    variant={isFollowed ? 'outline' : 'solid'}
                    onClick={() => onToggleFollow(user.id)}
                    className="px-3 py-1 text-xs"
                  >
                    {isFollowed ? (
                      <>
                        <UserCheck size={12} className="mr-1 text-brand-emerald" /> Following
                      </>
                    ) : (
                      <>
                        <UserPlus size={12} className="mr-1" /> Follow
                      </>
                    )}
                  </Button>
                </div>

                <p className="mt-2 text-xs text-content-secondary line-clamp-2">{user.bio}</p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[10px] text-content-muted">
                <span>{user.city}</span>
                <span className="flex items-center gap-1">
                  Trust: <span className="font-mono font-bold text-brand-emerald">{user.trustScore}</span>
                </span>
                {user.mutualFollowers ? (
                  <span>{user.mutualFollowers} mutual</span>
                ) : (
                  <span>{user.followersCount} followers</span>
                )}
              </div>
            </Card>
          );
        })}

        {users.length === 0 && (
          <div className="col-span-2 py-8 text-center text-xs text-content-muted">
            No citizens found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}

/** 4. Contacts & Social Media Tab */
function ContactsAndSocialTab({
  profile,
  contacts,
  onInviteContact,
  onToggleFollow,
  followingIds,
  onOpenSocialEdit,
}: {
  profile: Profile;
  contacts: UserContact[];
  onInviteContact: (id: string) => void;
  onToggleFollow: (id: string) => void;
  followingIds: string[];
  onOpenSocialEdit: () => void;
}) {
  const socials = profile.social_links ?? {};
  const hasSocials = Object.values(socials).some((v) => !!v);

  return (
    <div className="space-y-5">
      {/* Social Media Links Card */}
      <Card className="border-[var(--border-subtle)] bg-bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-content-primary">Connected Social Profiles</h3>
            <p className="text-xs text-content-muted">
              Display your public credentials to cross-verify truth across social feeds.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onOpenSocialEdit}
            className="px-3 py-1.5 text-xs"
          >
            <Edit3 size={13} className="mr-1" /> Edit Handles
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SocialLinkPill
            label="X / Twitter"
            value={socials.twitter}
            url={socials.twitter ? `https://x.com/${socials.twitter.replace('@', '')}` : undefined}
          />
          <SocialLinkPill
            label="Instagram"
            value={socials.instagram}
            url={socials.instagram ? `https://instagram.com/${socials.instagram.replace('@', '')}` : undefined}
          />
          <SocialLinkPill
            label="YouTube"
            value={socials.youtube}
            url={socials.youtube ? `https://youtube.com/${socials.youtube}` : undefined}
          />
          <SocialLinkPill
            label="LinkedIn"
            value={socials.linkedin}
            url={socials.linkedin ? `https://linkedin.com/${socials.linkedin}` : undefined}
          />
          <SocialLinkPill
            label="WhatsApp"
            value={socials.whatsapp}
          />
          <SocialLinkPill
            label="Website"
            value={socials.website}
            url={socials.website}
          />
        </div>

        {!hasSocials && (
          <p className="mt-3 text-xs text-content-muted italic">
            No social accounts linked yet. Click &quot;Edit Handles&quot; to link your Twitter/X, Instagram, or YouTube.
          </p>
        )}
      </Card>

      {/* Referral & Invite Banner */}
      <Card className="relative overflow-hidden border border-brand-emerald/30 bg-[var(--brand-emerald-glow)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-emerald">
              <Sparkles size={14} /> Earn ₹25 Per Verified Friend
            </div>
            <p className="text-xs text-content-secondary max-w-lg">
              When friends sign up using your referral code and verify their identity, you both receive
              ₹25 instant UPI wallet credits.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-button border border-brand-emerald/40 bg-bg-surface px-3 py-1.5 font-mono text-xs font-bold text-content-primary">
              VERI-{profile.username.toUpperCase().slice(0, 8)}
            </span>
            <Button
              variant="solid"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(`https://veripulse.in/join?ref=${profile.username}`);
                  alert('Referral link copied to clipboard!');
                }
              }}
              className="px-3 py-1.5 text-xs"
            >
              <Copy size={13} className="mr-1" /> Copy Link
            </Button>
          </div>
        </div>
      </Card>

      {/* Address Book / Contacts Sync */}
      <Card className="border-[var(--border-subtle)] bg-bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-content-primary">Address Book & Contacts</h3>
            <p className="text-xs text-content-muted">
              Connect with friends already on VeriPulse or invite them for referral bonuses.
            </p>
          </div>
          <span className="rounded-pill bg-bg-elevated px-2.5 py-1 text-[10px] font-mono text-content-muted">
            {contacts.length} Contacts Synced
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {contacts.map((c) => {
            const isFollowed = c.username ? followingIds.includes(c.id) : false;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-card border border-[var(--border-subtle)] bg-bg-primary p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 overflow-hidden rounded-full bg-bg-elevated">
                    {c.avatar ? (
                      <Image
                        src={c.avatar}
                        alt={c.name}
                        fill
                        sizes="36px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-mono text-xs font-bold text-content-muted">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-content-primary">{c.name}</span>
                      {c.isRegistered && (
                        <span className="rounded-pill bg-[var(--brand-emerald-glow)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-brand-emerald">
                          On VeriPulse
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-content-muted">
                      {c.username ? `@${c.username}` : c.phoneOrEmail}
                    </div>
                  </div>
                </div>

                <div>
                  {c.isRegistered ? (
                    <Button
                      variant={isFollowed ? 'outline' : 'solid'}
                      onClick={() => onToggleFollow(c.id)}
                      className="px-3 py-1 text-xs"
                    >
                      {isFollowed ? 'Following' : 'Follow'}
                    </Button>
                  ) : (
                    <Button
                      variant={c.isInvited ? 'outline' : 'solid'}
                      disabled={c.isInvited}
                      onClick={() => onInviteContact(c.id)}
                      className="px-3 py-1 text-xs"
                    >
                      {c.isInvited ? '✓ Invited' : 'Invite (+₹25)'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function SocialLinkPill({
  label,
  value,
  url,
}: {
  label: string;
  value?: string;
  url?: string;
}) {
  if (!value) {
    return (
      <div className="flex items-center justify-between rounded-card border border-dashed border-[var(--border-subtle)] bg-bg-primary/50 p-2.5 text-xs text-content-muted">
        <span>{label}</span>
        <span className="text-[10px]">Not set</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-card border border-[var(--border-subtle)] bg-bg-primary p-2.5 text-xs">
      <div className="truncate">
        <div className="text-[10px] text-content-muted">{label}</div>
        <div className="truncate font-semibold text-content-primary">{value}</div>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-emerald hover:text-content-primary"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
}

/** 5. Settings & Danger Zone Tab */
function SettingsTab({
  profile,
  onOpenEdit,
  onSignOut,
  onOpenDelete,
  onSwitchAccount,
}: {
  profile: Profile;
  onOpenEdit: () => void;
  onSignOut: () => void;
  onOpenDelete: () => void;
  onSwitchAccount: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Account Settings */}
      <Card className="border-[var(--border-subtle)] bg-bg-surface p-4 space-y-3">
        <h3 className="text-sm font-bold text-content-primary">Account Preferences</h3>

        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2.5 text-xs">
          <div>
            <div className="font-semibold text-content-primary">Profile Info</div>
            <div className="text-content-muted">Name, handle, bio, and city</div>
          </div>
          <Button variant="outline" onClick={onOpenEdit} className="px-3 py-1 text-xs">
            Edit
          </Button>
        </div>

        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2.5 text-xs">
          <div>
            <div className="font-semibold text-content-primary">Theme Appearance</div>
            <div className="text-content-muted">Toggle between dark obsidian and clean light mode</div>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2.5 text-xs">
          <div>
            <div className="font-semibold text-content-primary">UPI Payout Handle</div>
            <div className="text-content-muted font-mono">{profile.upi_id || 'Not set'}</div>
          </div>
          <Button variant="outline" onClick={onOpenEdit} className="px-3 py-1 text-xs">
            Update UPI
          </Button>
        </div>

        <div className="flex items-center justify-between py-2.5 text-xs">
          <div>
            <div className="font-semibold text-content-primary">Switch Demo Profile</div>
            <div className="text-content-muted">Toggle between test sentinel roles</div>
          </div>
          <Button variant="outline" onClick={onSwitchAccount} className="px-3 py-1 text-xs">
            Switch
          </Button>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30 bg-red-950/10 p-4 space-y-3">
        <div className="flex items-center gap-2 text-brand-rose">
          <AlertTriangle size={18} />
          <h3 className="text-sm font-bold">Danger Zone</h3>
        </div>
        <p className="text-xs text-content-muted">
          Logging out preserves your verified credentials for your next session. Deleting your account
          permanently wipes your identity hashes, wallet balance, and vote reputation.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onSignOut}
            className="px-3 py-1.5 text-xs text-content-primary hover:bg-bg-elevated"
          >
            <LogOut size={13} className="mr-1" /> Log Out
          </Button>
          <Button
            variant="danger"
            onClick={onOpenDelete}
            className="px-3 py-1.5 text-xs"
          >
            <Trash2 size={13} className="mr-1" /> Delete Account
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Logged Out Hub: Sign Up & Login Views
// ─────────────────────────────────────────────────────────────────────────────

function LoggedOutHub({
  onSignInPreset,
  onSignUp,
  onSignInOtp,
}: {
  onSignInPreset: (preset: Profile) => void;
  onSignUp: (input: {
    name: string;
    username: string;
    emailOrPhone: string;
    role?: string;
    bio?: string;
    city?: string;
  }) => Promise<{ error?: string }>;
  onSignInOtp: (id: string, code: string) => Promise<{ error?: string }>;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // Sign in state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign up state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [role, setRole] = useState('Citizen Sentinel');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) return;
    setOtpSent(true);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await onSignInOtp(loginIdentifier, otpCode);
    setBusy(false);
    if (res.error) setError(res.error);
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !emailOrPhone) return;
    setBusy(true);
    setError(null);
    const res = await onSignUp({
      name,
      username,
      emailOrPhone,
      role,
      city,
      bio,
    });
    setBusy(false);
    if (res.error) setError(res.error);
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 py-4">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-emerald text-[#04110b]">
          <ShieldCheck size={28} />
        </div>
        <h2 className="text-xl font-extrabold text-content-primary">Welcome to VeriPulse</h2>
        <p className="text-xs text-content-muted">
          Decentralized consensus verification for local ground truth & verified product telemetry.
        </p>
      </div>

      {/* Switcher Tab */}
      <div className="flex rounded-button border border-[var(--border-subtle)] bg-bg-surface p-1">
        <button
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={cn(
            'flex-1 rounded-button py-2 text-xs font-bold transition-colors',
            mode === 'login' ? 'bg-brand-emerald text-[#04110b]' : 'text-content-muted hover:text-content-primary',
          )}
        >
          Sign In
        </button>
        <button
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          className={cn(
            'flex-1 rounded-button py-2 text-xs font-bold transition-colors',
            mode === 'signup' ? 'bg-brand-emerald text-[#04110b]' : 'text-content-muted hover:text-content-primary',
          )}
        >
          Create New Account
        </button>
      </div>

      {error && (
        <div className="rounded-button bg-red-950/20 p-2.5 text-xs text-brand-rose">
          {error}
        </div>
      )}

      {/* ── Mode 1: Log In ── */}
      {mode === 'login' && (
        <div className="space-y-4">
          <Card className="border-[var(--border-subtle)] bg-bg-surface p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-content-muted">
              1-Click Demo Profiles
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_PRESET_PROFILES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSignInPreset(p)}
                  className="flex items-center gap-2.5 rounded-button border border-[var(--border-subtle)] bg-bg-primary p-2.5 text-left transition-colors hover:border-brand-emerald hover:bg-bg-elevated"
                >
                  <img
                    src={p.avatar_url}
                    alt={p.full_name ?? p.username}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1 truncate">
                    <div className="truncate text-xs font-bold text-content-primary">
                      {p.full_name}
                    </div>
                    <div className="truncate text-[10px] text-content-muted">
                      @{p.username} • {p.badge}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="relative my-2 flex items-center justify-center">
              <span className="w-full border-t border-[var(--border-subtle)]" />
              <span className="absolute bg-bg-surface px-3 text-[10px] text-content-muted uppercase">
                Or Sign In with Mobile / Email
              </span>
            </div>

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Enter phone (+91...) or email"
                  className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2.5 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
                />
                <Button type="submit" className="w-full py-2.5 text-xs">
                  Send OTP Code
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <p className="text-xs text-content-secondary">
                  Enter 6-digit code sent to <span className="font-bold text-content-primary">{loginIdentifier}</span> (Enter any 6 digits for demo):
                </p>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2.5 text-center font-mono text-base tracking-widest text-content-primary focus:border-brand-emerald focus:outline-none"
                />
                <Button type="submit" disabled={busy} className="w-full py-2.5 text-xs">
                  {busy ? 'Authenticating...' : 'Verify & Enter'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      )}

      {/* ── Mode 2: Create Account / Sign Up ── */}
      {mode === 'signup' && (
        <Card className="border-[var(--border-subtle)] bg-bg-surface p-5">
          <form onSubmit={handleSignUpSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-content-secondary">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sayantan Bhattacharya"
                className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-content-secondary">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="handle"
                  className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-content-secondary">City / Region</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Kolkata, WB"
                  className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-content-secondary">Email or Mobile Number</label>
              <input
                type="text"
                required
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                placeholder="you@domain.com or +91 98300..."
                className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-content-secondary">Primary Citizen Specialization</label>
              <CustomSelect
                value={role}
                onChange={setRole}
                variant="card"
                size="md"
                align="left"
                className="mt-1 w-full"
                buttonClassName="w-full justify-between"
                options={[
                  { value: 'Civic Sentinel & Field Reporter', label: 'Civic Sentinel & Field Reporter' },
                  { value: 'Gadget Specialist & Reviewer', label: 'Gadget Specialist & Reviewer' },
                  { value: 'EV / Auto Telemetry Contributor', label: 'EV / Auto Telemetry Contributor' },
                  { value: 'Fact-Checker & Media Auditor', label: 'Fact-Checker & Media Auditor' },
                  { value: 'Daily Commuter & Citizen', label: 'Daily Commuter & Citizen' },
                ]}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-content-secondary">Bio (Optional)</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief intro about your local area or tech interests..."
                className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              />
            </div>

            <div className="rounded-button bg-[var(--brand-emerald-glow)] p-2.5 text-[11px] text-content-secondary">
              🎁 New accounts receive a <span className="font-bold text-brand-emerald">₹50 welcome grant</span> credited to their in-app wallet.
            </div>

            <Button type="submit" disabled={busy} className="w-full py-2.5 text-xs font-bold">
              {busy ? 'Creating...' : 'Create Account & Claim ₹50 Grant'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-Page Views (Consistent with News Hub)
// ─────────────────────────────────────────────────────────────────────────────

function EditProfilePage({
  profile,
  onClose,
  onSave,
  lang = 'en',
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (patch: Partial<Profile>) => void;
  lang?: import('@/lib/types').Lang;
}) {
  const [name, setName] = useState(profile.full_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [upi, setUpi] = useState(profile.upi_id ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      full_name: name.trim(),
      bio: bio.trim(),
      city: city.trim(),
      upi_id: upi.trim() || null,
    });
  };

  return (
    <div className="space-y-5 section-enter">
      {/* ── Top Navigation Bar ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <button
          onClick={onClose}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} />
          <span>{lang === 'bn' ? 'প্রোফাইলে ফিরে যান' : lang === 'hi' ? 'प्रोफ़ाइल पर वापस जाएं' : 'Back to Profile'}</span>
        </button>
      </div>

      <Card className="p-5 sm:p-6 space-y-4 max-w-2xl">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Edit Profile</h2>
          <p className="text-xs text-content-muted mt-0.5">
            Update your public display identity, regional locality, and payout handle.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-content-secondary">Display Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-content-secondary">City / Region</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-content-secondary">Bio / Expertise</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none leading-relaxed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-content-secondary">UPI ID for Payouts</label>
            <input
              type="text"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              placeholder="e.g. name@okhdfc"
              className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-xs font-mono text-content-primary focus:border-brand-emerald focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-content-muted">Earnings and dividend grants will be credited to this VPA address.</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <Button variant="ghost" type="button" onClick={onClose} className="px-3 py-1.5 text-xs">
              Cancel
            </Button>
            <Button variant="solid" type="submit" className="px-4 py-1.5 text-xs">
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EditSocialLinksPage({
  links,
  onClose,
  onSave,
  lang = 'en',
}: {
  links: SocialLinks;
  onClose: () => void;
  onSave: (links: SocialLinks) => void;
  lang?: import('@/lib/types').Lang;
}) {
  const [twitter, setTwitter] = useState(links.twitter ?? '');
  const [instagram, setInstagram] = useState(links.instagram ?? '');
  const [youtube, setYoutube] = useState(links.youtube ?? '');
  const [linkedin, setLinkedin] = useState(links.linkedin ?? '');
  const [whatsapp, setWhatsapp] = useState(links.whatsapp ?? '');
  const [website, setWebsite] = useState(links.website ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      twitter: twitter.trim() || undefined,
      instagram: instagram.trim() || undefined,
      youtube: youtube.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      website: website.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5 section-enter">
      {/* ── Top Navigation Bar ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <button
          onClick={onClose}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} />
          <span>{lang === 'bn' ? 'প্রোফাইলে ফিরে যান' : lang === 'hi' ? 'प्रोफ़ाइल पर वापस जाएं' : 'Back to Profile'}</span>
        </button>
      </div>

      <Card className="p-5 sm:p-6 space-y-4 max-w-2xl">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Edit Social & Contact Links</h2>
          <p className="text-xs text-content-muted mt-0.5">
            Connect your presence across networks to build trusted cross-platform journalism verification.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-content-muted">X / Twitter Handle</label>
            <input
              type="text"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder="@handle"
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-content-muted">Instagram Handle</label>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@handle"
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-content-muted">YouTube Channel</label>
            <input
              type="text"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="@channel"
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-content-muted">LinkedIn Profile</label>
            <input
              type="text"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="in/username"
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-content-muted">WhatsApp / Phone Contact</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+91..."
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-content-muted">Website / Blog URL</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <Button variant="ghost" type="button" onClick={onClose} className="px-3 py-1.5 text-xs">
              Cancel
            </Button>
            <Button variant="solid" type="submit" className="px-4 py-1.5 text-xs">
              Save Links
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SwitchAccountPage({
  currentProfileId,
  onClose,
  onSelect,
  lang = 'en',
}: {
  currentProfileId: string;
  onClose: () => void;
  onSelect: (preset: Profile) => void;
  lang?: import('@/lib/types').Lang;
}) {
  return (
    <div className="space-y-5 section-enter">
      {/* ── Top Navigation Bar ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <button
          onClick={onClose}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} />
          <span>{lang === 'bn' ? 'প্রোফাইলে ফিরে যান' : lang === 'hi' ? 'प्रोफ़ाइल पर वापस जाएं' : 'Back to Profile'}</span>
        </button>
      </div>

      <Card className="p-5 sm:p-6 space-y-4 max-w-lg">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Switch Preset Account</h2>
          <p className="text-xs text-content-muted mt-0.5">
            Select any simulated citizen or investigative journalist persona to test permissions and features.
          </p>
        </div>

        <div className="space-y-2.5">
          {DEMO_PRESET_PROFILES.map((p) => {
            const isCurrent = p.id === currentProfileId;
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-button border p-3 text-left transition-all',
                  isCurrent
                    ? 'border-brand-emerald bg-[var(--brand-emerald-glow)] shadow-sm'
                    : 'border-[var(--border-subtle)] bg-bg-surface hover:bg-bg-elevated hover:border-[var(--border-strong)]',
                )}
              >
                <img
                  src={p.avatar_url}
                  alt={p.full_name ?? p.username}
                  className="h-11 w-11 rounded-full object-cover border border-[var(--border-subtle)]"
                />
                <div className="min-w-0 flex-1 truncate">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-bold text-content-primary">{p.full_name}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-brand-emerald bg-brand-emerald/10 px-2 py-0.5 rounded-pill">Active</span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-content-muted">
                    @{p.username} • Trust: {p.trust_score} • {p.badge ?? p.tier}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function DeleteAccountPage({
  username,
  onClose,
  onConfirm,
  lang = 'en',
}: {
  username: string;
  onClose: () => void;
  onConfirm: () => void;
  lang?: import('@/lib/types').Lang;
}) {
  const [confirmInput, setConfirmInput] = useState('');

  return (
    <div className="space-y-5 section-enter">
      {/* ── Top Navigation Bar ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <button
          onClick={onClose}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} />
          <span>{lang === 'bn' ? 'প্রোফাইলে ফিরে যান' : lang === 'hi' ? 'प्रोफ़ाइल पर वापस जाएं' : 'Back to Profile'}</span>
        </button>
      </div>

      <Card className="p-5 sm:p-6 space-y-4 max-w-lg border-brand-rose/40">
        <div className="flex items-center gap-2 text-brand-rose">
          <AlertTriangle size={22} />
          <h2 className="text-xl font-bold">Permanently Delete Account?</h2>
        </div>

        <p className="text-xs text-content-muted leading-relaxed">
          This action <span className="font-bold text-brand-rose">cannot be undone</span>. All your
          verified identity hashes, wallet balance, and vote reputation will be wiped from this client instance.
        </p>

        <div>
          <label className="text-[11px] text-content-secondary">
            Type <span className="font-mono font-bold text-brand-rose">DELETE</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="DELETE"
            className="mt-1.5 w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface px-3 py-2 text-xs font-mono text-content-primary focus:border-brand-rose focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
          <Button variant="ghost" onClick={onClose} className="px-3 py-1.5 text-xs">
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={confirmInput !== 'DELETE'}
            onClick={onConfirm}
            className="px-4 py-1.5 text-xs font-bold"
          >
            Delete Account
          </Button>
        </div>
      </Card>
    </div>
  );
}
