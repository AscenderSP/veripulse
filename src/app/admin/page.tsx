'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Loader2,
  LogIn,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Newspaper,
  FileText,
  Users as UsersIcon,
  IndianRupee,
  Trophy,
  Pause,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/primitives';
import { AuthSheet } from '@/components/shell/AuthSheet';
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PROFILE } from '@/lib/demoData';
import { fetchAdminStats, type AdminStats } from '@/components/admin/adminApi';
import { JournalistsPanel } from '@/components/admin/JournalistsPanel';
import { PostsPanel } from '@/components/admin/PostsPanel';
import { UsersPanel } from '@/components/admin/UsersPanel';
import { EarningsPanel } from '@/components/admin/EarningsPanel';
import { LeaderboardPanel } from '@/components/admin/LeaderboardPanel';

type AdminTab = 'overview' | 'posts' | 'users' | 'journalists' | 'earnings' | 'leaderboard';

const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'posts', label: 'Posts', icon: FileText },
  { id: 'users', label: 'Users', icon: UsersIcon },
  { id: 'journalists', label: 'Journalists', icon: Newspaper },
  { id: 'earnings', label: 'Earnings', icon: IndianRupee },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
];

export default function AdminPage() {
  const { demo, profile, user, setAuthOpen, signInPreset, signOut } = useSession();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');

  const localPreview = !demo && !user && Boolean(profile?.is_admin);
  const effectiveDemo = demo || localPreview;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (demo) {
        if (cancelled) return;
        setIsAdmin(Boolean(profile?.is_admin));
        setChecking(false);
        if (profile?.is_admin) {
          try {
            setStats(await fetchAdminStats({ demo: true }));
          } catch {
            /* ignore */
          }
        }
        return;
      }
      if (!user) {
        if (!cancelled) {
          setIsAdmin(Boolean(profile?.is_admin));
          if (profile?.is_admin) {
            try {
              setStats(await fetchAdminStats({ demo: true }));
            } catch {
              /* ignore */
            }
          }
          setChecking(false);
        }
        return;
      }
      try {
        const res = await fetch('/api/admin/me', { credentials: 'include' });
        if (!cancelled) {
          if (res.ok) {
            const json = await res.json();
            setIsAdmin(json.isAdmin);
            setStats(json.stats);
          } else {
            setIsAdmin(false);
          }
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
          setChecking(false);
        }
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [demo, user, profile?.is_admin]);

  const signedIn = demo ? Boolean(profile) : Boolean(user) || localPreview;

  if (checking) {
    return (
      <AdminFrame>
        <div className="flex items-center justify-center py-16 text-content-muted">
          <Loader2 size={18} className="mr-2 animate-spin" /> Checking admin access…
        </div>
      </AdminFrame>
    );
  }

  if (!signedIn) {
    return (
      <AdminFrame>
        <Gate
          icon={LogIn}
          title="Sign in required"
          body="The admin console is only for VeriPulse operations staff. Sign in with your admin account."
          action={
            <div className="flex flex-col items-center gap-2">
              <Button onClick={() => setAuthOpen(true)}>Open sign-in</Button>
              <button
                onClick={() => signInPreset(DEMO_ADMIN_PROFILE)}
                className="press-effect rounded-button border border-[var(--border-strong)] bg-bg-primary px-3 py-2 text-[11px] font-semibold text-content-primary"
              >
                Sign in as dummy admin (local preview)
              </button>
            </div>
          }
        />
        <DemoAdminCredentialsCard />
      </AdminFrame>
    );
  }

  if (!isAdmin) {
    return (
      <AdminFrame>
        <Gate
          icon={AlertTriangle}
          title="Not authorized"
          body={
            demo
              ? `You’re signed in as @${profile?.username ?? 'guest'}, which isn’t an admin account. Sign out and use the dummy admin credentials below.`
              : 'Your account isn’t on the admin allowlist. Set is_admin on your profile or add your email to ADMIN_EMAILS.'
          }
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await signOut();
                  signInPreset(DEMO_ADMIN_PROFILE);
                }}
                className="press-effect rounded-button bg-brand-emerald px-3 py-2 text-xs font-semibold text-white"
              >
                Switch to dummy admin
              </button>
              <Link
                href="/"
                className="press-effect rounded-button border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-content-primary"
              >
                Back to app
              </Link>
            </div>
          }
        />
        <DemoAdminCredentialsCard />
      </AdminFrame>
    );
  }

  return (
    <AdminFrame>
      {localPreview && (
        <div className="mb-4 rounded-xl border border-brand-amber/40 bg-brand-amber/10 p-3 text-[11px] text-content-secondary">
          <p className="text-xs font-semibold text-content-primary">Local admin preview</p>
          Signed in as the dummy admin — Supabase has no matching user, so writes are local-only
          (nothing persists to the live DB). For real ops, create a Supabase user and set{' '}
          <span className="font-mono">profiles.is_admin = true</span> or add their email to{' '}
          <span className="font-mono">ADMIN_EMAILS</span>.
        </div>
      )}

      <TabBar tab={tab} onChange={setTab} />

      {tab === 'overview' && <OverviewPanel stats={stats} onJumpTo={setTab} />}
      {tab === 'posts' && <PostsPanel demo={demo} localPreview={localPreview} />}
      {tab === 'users' && (
        <UsersPanel demo={demo} localPreview={localPreview} selfId={profile?.id ?? null} />
      )}
      {tab === 'journalists' && (
        <JournalistsPanel
          demo={demo}
          localPreview={localPreview}
          onDecision={async () => {
            try {
              setStats(await fetchAdminStats({ demo: effectiveDemo }));
            } catch {
              /* ignore */
            }
          }}
        />
      )}
      {tab === 'earnings' && <EarningsPanel demo={demo} localPreview={localPreview} />}
      {tab === 'leaderboard' && <LeaderboardPanel demo={demo} localPreview={localPreview} />}
    </AdminFrame>
  );
}

function TabBar({ tab, onChange }: { tab: AdminTab; onChange: (t: AdminTab) => void }) {
  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1">
      <div className="inline-flex gap-1 rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-1 text-[12px]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 py-1.5 font-semibold transition ${
              tab === id
                ? 'bg-bg-primary text-content-primary'
                : 'text-content-muted hover:text-content-primary'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewPanel({
  stats,
  onJumpTo,
}: {
  stats: AdminStats | null;
  onJumpTo: (t: AdminTab) => void;
}) {
  const items: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    accent: string;
    tab?: AdminTab;
  }[] = [
    {
      icon: Newspaper,
      label: 'Pending reviews',
      value: stats?.pendingJournalists ?? '—',
      accent: 'text-brand-amber',
      tab: 'journalists',
    },
    {
      icon: UsersIcon,
      label: 'Total profiles',
      value: stats?.totalProfiles ?? '—',
      accent: 'text-brand-sky',
      tab: 'users',
    },
    {
      icon: FileText,
      label: 'Stories (24h)',
      value: stats?.stories24h ?? '—',
      accent: 'text-brand-emerald',
      tab: 'posts',
    },
    {
      icon: Pause,
      label: 'Suspended',
      value: stats?.suspendedUsers ?? '—',
      accent: 'text-brand-rose',
      tab: 'users',
    },
    {
      icon: AlertTriangle,
      label: 'Taken down',
      value: stats?.takenDown ?? '—',
      accent: 'text-brand-rose',
      tab: 'posts',
    },
    {
      icon: Shield,
      label: 'Active admins',
      value: stats?.activeAdmins ?? '—',
      accent: 'text-brand-emerald',
      tab: 'users',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => it.tab && onJumpTo(it.tab)}
            className="press-effect rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-3 text-left transition hover:border-[var(--border-strong)]"
          >
            <it.icon size={14} className={it.accent} />
            <div className="mt-1 text-xl font-bold text-content-primary">{it.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-content-muted">
              {it.label}
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-4 text-[11px] text-content-secondary">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-content-primary">
          <CheckCircle2 size={13} className="text-brand-emerald" /> Admin actions available
        </h3>
        <ul className="grid gap-1 sm:grid-cols-2">
          <li>· Take down a story (flags & quarantines it from feeds)</li>
          <li>· Restore a taken-down story</li>
          <li>· Suspend a user for N days with a reason</li>
          <li>· Lift a suspension</li>
          <li>· Approve / reject journalist credentials</li>
          <li>· Revoke journalist status</li>
          <li>· Grant / revoke admin access</li>
          <li>· Reset a user’s trust score</li>
        </ul>
      </div>
    </div>
  );
}

function AdminFrame({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useSession();
  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-bg-primary/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              aria-label="Back"
              className="press-effect flex h-7 w-7 items-center justify-center rounded-full glass text-content-muted hover:text-content-primary"
            >
              <ArrowLeft size={14} />
            </Link>
            <ShieldCheck size={18} className="text-brand-emerald" />
            <h1 className="truncate text-sm font-bold text-content-primary">VeriPulse Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-brand-emerald/15 px-2 py-0.5 text-[10px] font-semibold text-brand-emerald sm:inline">
              Ops console
            </span>
            {profile?.is_admin && (
              <button
                onClick={() => void signOut()}
                className="press-effect rounded-button border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-semibold text-content-secondary hover:border-brand-rose/60 hover:text-brand-rose"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 pb-16">{children}</main>
      <AuthSheet />
    </div>
  );
}

function DemoAdminCredentialsCard() {
  return (
    <div className="mx-auto mt-4 max-w-md rounded-xl border border-brand-amber/40 bg-brand-amber/10 p-4 text-[11px] text-content-secondary">
      <p className="text-xs font-bold text-content-primary">Dummy admin credentials</p>
      <p className="mt-1">
        Use this magic email on Sign in → Email magic link. It short-circuits Supabase and signs you
        in locally as the dummy admin.
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
        <dt className="text-content-muted">Email</dt>
        <dd className="text-content-primary">{DEMO_ADMIN_EMAIL}</dd>
        <dt className="text-content-muted">Username</dt>
        <dd className="text-content-primary">@{DEMO_ADMIN_PROFILE.username}</dd>
      </dl>
      <p className="mt-2 text-[10px] text-content-muted">
        For <strong>real ops</strong>, create a Supabase user and set{' '}
        <span className="font-mono">profiles.is_admin = true</span>, or add their email to the{' '}
        <span className="font-mono">ADMIN_EMAILS</span> env list.
      </p>
    </div>
  );
}

function Gate({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-6 text-center">
      <Icon size={28} className="mx-auto text-brand-amber" />
      <h2 className="mt-2 text-base font-bold text-content-primary">{title}</h2>
      <p className="mt-1 text-xs text-content-secondary">{body}</p>
      <div className="mt-4 flex justify-center">{action}</div>
    </div>
  );
}
