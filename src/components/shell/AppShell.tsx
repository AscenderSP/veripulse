'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Radio,
  ShieldAlert,
  LayoutGrid,
  Gauge,
  Wallet as WalletIcon,
  Plus,
  X,
  LogIn,
  LogOut,
  Bell,
  ScanLine,
  Target,
  Award,
  ShieldCheck,
  Search,
  User,
  Newspaper,
  Sparkles,
  ArrowLeft,
  Coins,
} from 'lucide-react';
import { cn, formatINR, formatVPCoins, inrToVPCoins, timeAgo } from '@/lib/utils';
import { LangSwitch } from './LangSwitch';
import { ThemeToggle } from './ThemeToggle';
import { RightRail } from './RightRail';
import { AuthSheet } from './AuthSheet';
import { AreaSwitcher, GLOBAL_AREA, type Area } from './AreaSwitcher';
import { Feed } from '@/components/feed/Feed';
import { Composer } from '@/components/feed/Composer';
import { ProductMatrix } from '@/components/compare/ProductMatrix';
import { Wallet } from '@/components/wallet/Wallet';
import { VerifyDrawer } from '@/components/verify/VerifyDrawer';
import { Card } from '@/components/ui/primitives';
import { useSession } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { DEMO_LEADERBOARD, DEMO_STORIES, isSupabaseConfigured } from '@/lib/demoData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { showAnchoredBanner } from '@/lib/admob';
import { EarnHub } from '@/components/earn/EarnHub';
import { FactCheckScanner } from '@/components/feed/FactCheckScanner';
import { OwnershipPassportView } from '@/components/earn/OwnershipPassport';
import { ProfileView } from '@/components/profile/ProfileView';
import { NewsHub } from '@/components/news/NewsHub';
import { t, UI_STRINGS } from '@/lib/translations';

type Section = 'feed' | 'news' | 'vault' | 'compare' | 'earn' | 'scanner' | 'passport' | 'sentinel' | 'wallet' | 'profile' | 'compose';

const NAV: { id: Section; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'feed', label: 'Live Circle', icon: <Radio size={18} />, color: 'var(--brand-emerald)' },
  { id: 'news', label: 'News Hub', icon: <Newspaper size={18} />, color: 'var(--brand-sky)' },
  { id: 'compare', label: 'Product Hub', icon: <LayoutGrid size={18} />, color: 'var(--brand-violet)' },
  { id: 'earn', label: 'Bounties & Earn', icon: <Target size={18} />, color: 'var(--brand-amber)' },
  { id: 'scanner', label: 'WhatsApp Shield', icon: <ShieldCheck size={18} />, color: 'var(--brand-cyan)' },
  { id: 'passport', label: 'Resale Passport', icon: <Award size={18} />, color: 'var(--brand-amber)' },
  { id: 'vault', label: 'Quarantine Vault', icon: <ShieldAlert size={18} />, color: 'var(--brand-rose)' },
  { id: 'sentinel', label: 'Sentinel Desk', icon: <Gauge size={18} />, color: 'var(--brand-sky)' },
  { id: 'wallet', label: 'Wallet', icon: <WalletIcon size={18} />, color: 'var(--brand-emerald)' },
  { id: 'profile', label: 'Citizen Profile', icon: <User size={18} />, color: 'var(--brand-violet)' },
];

function useQuarantineCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setN(DEMO_STORIES.filter((s) => s.rollout_stage === 'quarantined').length);
      return;
    }
    getSupabaseBrowserClient()
      .from('stories')
      .select('id', { count: 'exact', head: true })
      .eq('rollout_stage', 'quarantined')
      .gte('updated_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .then(({ count }) => setN(count ?? 0));
  }, []);
  return n;
}

export function AppShell() {
  const [section, setSection] = useState<Section>('feed');
  const [prevSection, setPrevSection] = useState<Section>('feed');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [area, setArea] = useState<Area>(GLOBAL_AREA);
  const [sectionKey, setSectionKey] = useState(0);
  const vaultCount = useQuarantineCount();
  const { profile } = useSession();
  const { lang } = useLang();

  const switchSection = useCallback((s: Section) => {
    if (s === section) return;
    setPrevSection(section);
    setSection(s);
    setSectionKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [section]);

  useEffect(() => {
    showAnchoredBanner().catch(() => undefined);
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px]">
      {/* ── Left Sidebar (desktop) ── */}
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col px-4 py-5 lg:flex glass-heavy border-r-0" style={{ borderRight: '1px solid var(--glass-border)' }}>
        <Brand lang={lang} />
        <AreaSwitcher area={area} onChange={setArea} />
        <div className="mt-4 flex items-center justify-between gap-2">
          <LangSwitch />
          <ThemeToggle />
        </div>
        <nav className="mt-6 space-y-1 stagger-children">
          {NAV.map((n) => {
            const navKey = `nav_${n.id}` as keyof typeof UI_STRINGS;
            const localizedLabel = t(navKey, lang);
            return (
              <NavItem
                key={n.id}
                {...n}
                label={localizedLabel}
                active={section === n.id}
                onClick={() => switchSection(n.id)}
                badge={n.id === 'vault' ? vaultCount : undefined}
              />
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 pt-4">
          <button
            onClick={() => setVerifyOpen(true)}
            className="press-effect flex w-full items-center justify-center gap-2 rounded-button glass px-3 py-2.5 text-sm font-semibold text-content-primary hover:bg-bg-elevated/50 transition-all duration-200"
          >
            <ScanLine size={15} /> {t('verifyOwnership', lang)}
          </button>
          <AccountChip onOpenProfile={() => switchSection('profile')} lang={lang} />
        </div>
      </aside>

      {/* ── Center Column ── */}
      <main className="safe-top safe-bottom min-w-0 flex-1 px-4 py-4 lg:max-w-center lg:px-6 lg:pb-8">
        {/* Mobile top bar */}
        <div className="mb-4 flex items-center justify-between gap-2 lg:hidden">
          <Brand compact lang={lang} />
          <div className="flex items-center gap-1.5">
            {section === 'feed' && <AreaSwitcher area={area} onChange={setArea} compact />}
            <LangSwitch compact />
            <ThemeToggle compact />
            <AccountChip compact onOpenProfile={() => switchSection('profile')} lang={lang} />
          </div>
        </div>

        <SectionTitle section={section} lang={lang} />

        {/* Section content with fluid transition */}
        <div key={sectionKey} className="section-enter">
          {section === 'compose' && (
            <div className="space-y-4">
              <button
                onClick={() => switchSection(prevSection === 'compose' ? 'feed' : prevSection)}
                className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <Card className="p-4">
                <Composer autoCapture onSubmitted={() => switchSection(prevSection === 'compose' ? 'feed' : prevSection)} />
              </Card>
            </div>
          )}
          {section === 'feed' && <Feed area={area} />}
          {section === 'news' && <NewsHub />}
          {section === 'vault' && <Feed vault area={GLOBAL_AREA} />}
          {section === 'compare' && <ProductMatrix />}
          {section === 'earn' && <EarnHub onVerify={() => setVerifyOpen(true)} />}
          {section === 'scanner' && <FactCheckScanner />}
          {section === 'passport' && <OwnershipPassportView />}
          {section === 'wallet' && <Wallet onVerify={() => setVerifyOpen(true)} />}
          {section === 'sentinel' && <SentinelDesk onVerify={() => setVerifyOpen(true)} onNavigate={switchSection} />}
          {section === 'profile' && (
            <ProfileView
              onVerifyDoc={() => setVerifyOpen(true)}
              onNavigateToWallet={() => switchSection('wallet')}
            />
          )}
        </div>
      </main>

      {/* ── Right Column (desktop) ── */}
      <aside className="sticky top-0 hidden h-screen w-[340px] shrink-0 overflow-y-auto px-4 py-5 xl:block glass-heavy border-l-0" style={{ borderLeft: '1px solid var(--glass-border)' }}>
        <RightRail onNavigate={switchSection} />
      </aside>

      {/* ── Mobile Bottom Nav ── */}
      <MobileNav
        section={section}
        setSection={switchSection}
        onPost={() => switchSection('compose')}
        vaultCount={vaultCount}
        balance={profile?.wallet_balance_inr ?? null}
        lang={lang}
      />

      <VerifyDrawer open={verifyOpen} onClose={() => setVerifyOpen(false)} />
      <AuthSheet />
    </div>
  );
}

function AccountChip({
  compact = false,
  onOpenProfile,
  lang = 'en',
}: {
  compact?: boolean;
  onOpenProfile?: () => void;
  lang?: import('@/lib/types').Lang;
}) {
  const { profile, setAuthOpen } = useSession();

  if (!profile) {
    return (
      <button
        onClick={onOpenProfile || (() => setAuthOpen(true))}
        aria-label="Sign In or Register"
        className={cn(
          'press-effect flex items-center justify-center gap-1.5 rounded-button text-xs font-semibold text-brand-emerald transition-all duration-200',
          compact ? 'p-1.5 glass' : 'w-full px-3 py-2 glass glow-emerald',
        )}
      >
        <LogIn size={15} /> {!compact && t('signInRegister', lang)}
      </button>
    );
  }

  return (
    <button
      onClick={onOpenProfile}
      aria-label="Open profile"
      title="View Profile"
      className={cn(
        'group press-effect flex items-center gap-2 rounded-button text-xs transition-all duration-200',
        compact
          ? 'p-1.5 glass'
          : 'w-full justify-between glass px-3 py-2',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-brand-emerald/40 bg-bg-elevated">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-brand-emerald">
              {(profile.full_name ?? profile.username).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
        </div>
        {!compact && (
          <div className="truncate text-left">
            <div className="truncate text-xs font-bold text-content-primary group-hover:text-brand-emerald transition-colors">
              {profile.full_name ?? profile.username}
            </div>
            <div className="truncate text-[10px] text-content-muted">
              @{profile.username} • Trust: {profile.trust_score.toFixed(0)}
            </div>
          </div>
        )}
      </div>
      {!compact && <User size={14} className="text-content-muted group-hover:text-brand-emerald transition-colors" />}
    </button>
  );
}

function Brand({ compact = false, lang = 'en' }: { compact?: boolean; lang?: import('@/lib/types').Lang }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[12px] bg-brand-emerald text-[#04110b] glow-emerald">
        <Radio size={18} />
        <div className="absolute inset-0 rounded-[12px] ring-1 ring-inset ring-white/20" />
      </div>
      {!compact && (
        <div>
          <div className="text-[15px] font-extrabold tracking-tight gradient-text">VeriPulse</div>
          <div className="-mt-0.5 text-[10px] text-content-muted">{t('tagline', lang)}</div>
        </div>
      )}
      {compact && <span className="text-[15px] font-extrabold tracking-tight gradient-text">VeriPulse</span>}
    </div>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
  badge,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'nav-item flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium',
        active
          ? 'active text-content-primary'
          : 'text-content-secondary hover:bg-glass-bg hover:text-content-primary',
      )}
    >
      <span
        className="nav-icon transition-all duration-300"
        style={{ color: active ? color : undefined }}
      >
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className="rounded-pill bg-[rgba(251,113,133,0.15)] px-2 py-0.5 font-mono text-[10px] font-bold text-brand-rose animate-scale-in">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function SectionTitle({ section, lang = 'en' }: { section: Section; lang?: import('@/lib/types').Lang }) {
  const navKey = `nav_${section}` as keyof typeof UI_STRINGS;
  const subKey = `sub_${section}` as keyof typeof UI_STRINGS;
  const navItem = NAV.find(n => n.id === section);

  return (
    <div className="mb-5 hidden lg:block">
      <h1 className="text-xl font-extrabold tracking-tight gradient-text inline-block">{t(navKey, lang)}</h1>
      <p className="mt-0.5 text-sm text-content-muted">{t(subKey, lang)}</p>
    </div>
  );
}

function MobileNav({
  section,
  setSection,
  onPost,
  vaultCount,
  balance,
  lang = 'en',
}: {
  section: Section;
  setSection: (s: Section) => void;
  onPost: () => void;
  vaultCount: number;
  balance: number | null;
  lang?: import('@/lib/types').Lang;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around glass-heavy lg:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        borderTop: '1px solid var(--glass-border)',
        borderRadius: '20px 20px 0 0',
      }}
    >
      <TabButton active={section === 'feed'} onClick={() => setSection('feed')} icon={<Radio size={20} />} label={t('tab_circle', lang)} color="var(--brand-emerald)" pulse />
      <TabButton active={section === 'news'} onClick={() => setSection('news')} icon={<Newspaper size={20} />} label={t('tab_news', lang)} color="var(--brand-sky)" />
      <button
        onClick={onPost}
        aria-label="Post report"
        className="post-glow -mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-brand-emerald text-[#04110b] press-effect"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>
      <TabButton active={section === 'compare'} onClick={() => setSection('compare')} icon={<LayoutGrid size={20} />} label={t('tab_product', lang)} color="var(--brand-violet)" />
      <TabButton
        active={section === 'profile'}
        onClick={() => setSection('profile')}
        icon={<User size={20} />}
        label={t('tab_profile', lang)}
        color="var(--brand-violet)"
      />
    </nav>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  pulse,
  badge,
  color = 'var(--brand-emerald)',
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  pulse?: boolean;
  badge?: number;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'press-effect relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-all duration-300',
        active ? 'text-content-primary' : 'text-content-muted',
      )}
    >
      <span
        className="relative transition-all duration-300"
        style={{
          color: active ? color : undefined,
          filter: active ? `drop-shadow(0 0 8px ${color})` : undefined,
          transform: active ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        {icon}
        {pulse && <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brand-rose" />}
        {badge ? (
          <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand-rose px-1 text-[8px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </span>
      <span className={cn('font-mono transition-all duration-300', active && 'font-bold')}>{label}</span>
      {active && (
        <span
          className="absolute bottom-0 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full animate-scale-in"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
      )}
    </button>
  );
}

function SentinelDesk({ onVerify, onNavigate }: { onVerify: () => void; onNavigate?: (s: Section) => void }) {
  const { profile, notifications, demo, user, setAuthOpen } = useSession();
  const { lang } = useLang();
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (demo) {
      setRank(DEMO_LEADERBOARD.findIndex((u) => u.username === profile.username) + 1 || null);
      return;
    }
    getSupabaseBrowserClient()
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('trust_score', profile.trust_score)
      .then(({ count }) => setRank((count ?? 0) + 1));
  }, [demo, profile]);

  if (!demo && !user) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-content-secondary">Sign in to see your accuracy, rank and alerts.</p>
        <button onClick={() => setAuthOpen(true)} className="mt-3 text-sm font-semibold text-brand-emerald press-effect">
          Sign in
        </button>
      </Card>
    );
  }

  const accuracy =
    profile && profile.total_votes > 0 ? (profile.correct_votes / profile.total_votes) * 100 : null;
  const tierLabel = { sentinel_t1: 'Sentinel · Tier 1', validator_t2: 'Validator · Tier 2', public: 'Public' };

  return (
    <div className="space-y-4 stagger-children">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Trust score" value={profile ? `${Number(profile.trust_score).toFixed(1)}%` : '—'} accent="var(--brand-emerald)" />
        <StatCard label="Accuracy" value={accuracy !== null ? `${accuracy.toFixed(1)}%` : '—'} accent="var(--brand-sky)" />
        <StatCard label="Rank" value={rank ? `#${rank}` : '—'} accent="var(--brand-amber)" />
        <StatCard label="Sentinel Balance" value={profile ? formatVPCoins(profile.wallet_balance_vpcoins ?? inrToVPCoins(profile.wallet_balance_inr)) : '—'} accent="var(--brand-amber)" />
      </div>

      {/* Sentinel Rewards Banner */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 border-brand-amber/30 bg-gradient-to-r from-bg-surface to-bg-elevated">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-amber/20 text-brand-amber">
            <Coins size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold text-brand-amber uppercase tracking-wider">Weekly Sentinel Rewards</div>
            <div className="text-sm font-bold text-content-primary">
              {rank === 1 ? 'Rank #1 Reward: 50,000 VPcoins' : rank === 2 ? 'Rank #2 Reward: 30,000 VPcoins' : rank === 3 ? 'Rank #3 Reward: 15,000 VPcoins' : 'Weekly Prize Pool: 1,00,000 VPcoins'}
            </div>
            <div className="text-[11px] text-content-muted">Daily dividends pool active · Redeem in your VP Wallet</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate?.('earn')}
            className="press-effect rounded-button glass px-3 py-1.5 text-xs font-semibold text-content-primary hover:text-brand-amber"
          >
            Daily Pool →
          </button>
          <button
            onClick={() => onNavigate?.('wallet')}
            className="press-effect rounded-button bg-brand-amber text-[#04110b] px-3 py-1.5 text-xs font-bold"
          >
            Redeem VPcoins
          </button>
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold text-content-primary">{profile ? tierLabel[profile.tier] : '—'}</div>
          <div className="text-xs text-content-muted">
            {profile?.badge} · tiers recompute hourly (top 5% trust → Sentinel)
          </div>
        </div>
        <button onClick={onVerify} className="press-effect shrink-0 rounded-button glass px-3 py-2 text-xs font-semibold text-content-primary">
          Verify ownership
        </button>
      </Card>
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-content-primary">
          <Bell size={15} className="text-brand-amber" /> Alerts
        </h3>
        {notifications.length === 0 ? (
          <p className="text-xs text-content-muted">No retractions or payout alerts.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {notifications.map((n) => (
              <li key={n.id} className="flex justify-between gap-3 rounded-button glass px-3 py-2">
                <span className={n.kind === 'retraction' ? 'text-brand-rose' : 'text-content-secondary'}>{n.body[lang]}</span>
                <span className="shrink-0 text-content-muted" suppressHydrationWarning>{timeAgo(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="xl:hidden">
        <RightRail onNavigate={onNavigate as any} />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <Card className="p-4 press-effect">
      <div className="text-xs text-content-muted">{label}</div>
      <div className="mt-1 font-mono text-xl font-bold stat-value" style={{ color: accent }}>
        {value}
      </div>
    </Card>
  );
}
