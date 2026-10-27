'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Newspaper,
  UserCircle2,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  FileText,
  LogIn,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/primitives';
import type { Profile } from '@/lib/types';
import { ACCOUNT_TYPES } from '@/lib/accountTiers';
import { AuthSheet } from '@/components/shell/AuthSheet';
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PROFILE } from '@/lib/demoData';

interface AdminStats {
  pendingJournalists: number;
  totalProfiles: number;
  stories24h: number;
}

interface JournalistRow
  extends Pick<
    Profile,
    | 'id'
    | 'username'
    | 'full_name'
    | 'avatar_url'
    | 'city'
    | 'bio'
    | 'press_credential_id'
    | 'journalist_employer'
    | 'journalist_verification_status'
    | 'trust_score'
  > {
  created_at?: string;
}

type Tab = 'pending' | 'approved' | 'rejected';

// Demo-mode seed of pending journalist applications so the admin UI can be
// explored without a live Supabase. Live mode replaces these over the API.
const DEMO_PENDING: JournalistRow[] = [
  {
    id: 'demo-pending-1',
    username: 'rohini_banerjee',
    full_name: 'Rohini Banerjee',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80',
    city: 'Kolkata, WB',
    bio: 'Metro-beat reporter. 6 yrs with Bengal Herald.',
    press_credential_id: 'BH-PRESS-0471',
    journalist_employer: 'Bengal Herald',
    journalist_verification_status: 'pending',
    trust_score: 78,
    created_at: new Date(Date.now() - 86400_000 * 2).toISOString(),
  },
  {
    id: 'demo-pending-2',
    username: 'nikhil_sawant',
    full_name: 'Nikhil Sawant',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80',
    city: 'Pune, MH',
    bio: 'Civic + transport beat. Freelance; PIB-accredited.',
    press_credential_id: 'PIB-FREELANCE-2211',
    journalist_employer: 'Freelance (PIB-accredited)',
    journalist_verification_status: 'pending',
    trust_score: 71,
    created_at: new Date(Date.now() - 86400_000 * 5).toISOString(),
  },
];

export default function AdminPage() {
  const { demo, profile, user, setAuthOpen, signInPreset, signOut } = useSession();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<JournalistRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // ── Admin gate ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (demo) {
        if (!cancelled) {
          setIsAdmin(Boolean(profile?.is_admin));
          setStats({
            pendingJournalists: DEMO_PENDING.length,
            totalProfiles: 1248,
            stories24h: 86,
          });
          setChecking(false);
        }
        return;
      }
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
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
    check();
    return () => {
      cancelled = true;
    };
  }, [demo, user, profile?.is_admin]);

  // ── Row loader ────────────────────────────────────────────────────────
  const loadRows = useCallback(
    async (nextTab: Tab) => {
      setLoadingRows(true);
      if (demo) {
        if (nextTab === 'pending') setRows(DEMO_PENDING.filter((r) => r.journalist_verification_status === 'pending'));
        else setRows([]);
        setLoadingRows(false);
        return;
      }
      try {
        const res = await fetch(`/api/admin/journalists?status=${nextTab}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setRows(json.items ?? []);
        } else {
          setRows([]);
        }
      } catch {
        setRows([]);
      } finally {
        setLoadingRows(false);
      }
    },
    [demo],
  );

  useEffect(() => {
    if (isAdmin) loadRows(tab);
  }, [isAdmin, tab, loadRows]);

  async function decide(id: string, decision: 'approve' | 'reject') {
    setActioningId(id);
    setNote(null);
    if (demo) {
      await new Promise((r) => setTimeout(r, 400));
      setRows((prev) => prev.filter((r) => r.id !== id));
      setStats((prev) =>
        prev
          ? { ...prev, pendingJournalists: Math.max(0, prev.pendingJournalists - 1) }
          : prev,
      );
      setNote(`Marked ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      setActioningId(null);
      return;
    }
    try {
      const res = await fetch('/api/admin/journalists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: id, decision }),
      });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setStats((prev) =>
          prev
            ? { ...prev, pendingJournalists: Math.max(0, prev.pendingJournalists - 1) }
            : prev,
        );
        setNote(`Marked ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      } else {
        setNote('Action failed. Try again.');
      }
    } catch {
      setNote('Action failed. Try again.');
    }
    setActioningId(null);
  }

  const signedIn = demo ? Boolean(profile) : Boolean(user);

  // ── Render ────────────────────────────────────────────────────────────
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
              {demo && (
                <button
                  onClick={() => signInPreset(DEMO_ADMIN_PROFILE)}
                  className="press-effect rounded-button border border-[var(--border-strong)] bg-bg-primary px-3 py-2 text-[11px] font-semibold text-content-primary"
                >
                  Sign in as demo admin
                </button>
              )}
            </div>
          }
        />
        {demo && <DemoAdminCredentialsCard />}
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
              {demo && (
                <button
                  onClick={async () => {
                    await signOut();
                    signInPreset(DEMO_ADMIN_PROFILE);
                  }}
                  className="press-effect rounded-button bg-brand-emerald px-3 py-2 text-xs font-semibold text-white"
                >
                  Switch to admin
                </button>
              )}
              <Link
                href="/"
                className="press-effect rounded-button border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-content-primary"
              >
                Back to app
              </Link>
            </div>
          }
        />
        {demo && <DemoAdminCredentialsCard />}
      </AdminFrame>
    );
  }

  return (
    <AdminFrame>
      <StatsRow stats={stats} />
      <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-content-primary">Journalist verification queue</h2>
          <Tabs value={tab} onChange={setTab} />
        </div>
        {note && (
          <div className="mb-3 rounded-button bg-[var(--brand-emerald-glow)] px-3 py-2 text-[11px] text-content-primary">
            {note}
          </div>
        )}
        {loadingRows ? (
          <div className="flex items-center justify-center py-12 text-content-muted">
            <Loader2 size={16} className="mr-2 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <JournalistCard
                key={r.id}
                row={r}
                actioning={actioningId === r.id}
                readOnly={tab !== 'pending'}
                onDecide={decide}
              />
            ))}
          </ul>
        )}
      </div>

      <PerksCard />
    </AdminFrame>
  );
}

function AdminFrame({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useSession();
  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-bg-primary/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
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
      <main className="mx-auto max-w-3xl p-4 pb-16">{children}</main>
      <AuthSheet />
    </div>
  );
}

function StatsRow({ stats }: { stats: AdminStats | null }) {
  const items = [
    {
      icon: Newspaper,
      label: 'Pending reviews',
      value: stats?.pendingJournalists ?? '—',
      accent: 'text-brand-amber',
    },
    {
      icon: Users,
      label: 'Total profiles',
      value: stats?.totalProfiles ?? '—',
      accent: 'text-brand-sky',
    },
    {
      icon: FileText,
      label: 'Stories (24h)',
      value: stats?.stories24h ?? '—',
      accent: 'text-brand-emerald',
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ icon: Icon, label, value, accent }) => (
        <div
          key={label}
          className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-3"
        >
          <Icon size={14} className={accent} />
          <div className="mt-1 text-xl font-bold text-content-primary">{value}</div>
          <div className="text-[10px] uppercase tracking-wider text-content-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const opts: { id: Tab; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];
  return (
    <div className="inline-flex rounded-button border border-[var(--border-subtle)] p-1 text-[11px]">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-[6px] px-2.5 py-1 font-semibold transition ${
            value === o.id
              ? 'bg-bg-primary text-content-primary'
              : 'text-content-muted hover:text-content-primary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function JournalistCard({
  row,
  actioning,
  readOnly,
  onDecide,
}: {
  row: JournalistRow;
  actioning: boolean;
  readOnly: boolean;
  onDecide: (id: string, decision: 'approve' | 'reject') => void;
}) {
  return (
    <li className="rounded-xl border border-[var(--border-subtle)] p-3">
      <div className="flex items-start gap-3">
        {row.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.avatar_url}
            alt={row.full_name ?? row.username}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <UserCircle2 size={32} className="shrink-0 text-content-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-bold text-content-primary">
              {row.full_name ?? row.username}
            </span>
            <span className="text-[11px] text-content-muted">@{row.username}</span>
            {typeof row.trust_score === 'number' && (
              <span className="rounded-full bg-brand-sky/15 px-1.5 py-0.5 text-[10px] font-mono text-brand-sky">
                trust {row.trust_score.toFixed(0)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-content-secondary">{row.city}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div>
              <dt className="text-content-muted">Press ID</dt>
              <dd className="font-mono text-content-primary">
                {row.press_credential_id || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-content-muted">Employer</dt>
              <dd className="text-content-primary">{row.journalist_employer || '—'}</dd>
            </div>
          </dl>
          {row.bio && (
            <p className="mt-2 line-clamp-2 text-[11px] text-content-secondary">{row.bio}</p>
          )}
        </div>
      </div>
      {!readOnly && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            disabled={actioning}
            onClick={() => onDecide(row.id, 'reject')}
            className="press-effect flex items-center gap-1 rounded-button border border-[var(--border-subtle)] px-3 py-1.5 text-[11px] font-semibold text-content-secondary hover:border-brand-rose/60 hover:text-brand-rose disabled:opacity-60"
          >
            <XCircle size={13} /> Reject
          </button>
          <button
            disabled={actioning}
            onClick={() => onDecide(row.id, 'approve')}
            className="press-effect flex items-center gap-1 rounded-button bg-brand-emerald px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
          >
            {actioning ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Approve
          </button>
        </div>
      )}
    </li>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const msg = useMemo(() => {
    if (tab === 'pending') return 'No pending verification requests. Breathe.';
    if (tab === 'approved') return 'Nothing approved recently.';
    return 'Nothing rejected recently.';
  }, [tab]);
  return (
    <div className="py-10 text-center text-xs text-content-muted">
      <CheckCircle2 size={18} className="mx-auto mb-2 text-content-muted" />
      {msg}
    </div>
  );
}

function PerksCard() {
  const meta = ACCOUNT_TYPES.journalist;
  return (
    <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-4 text-[11px] text-content-secondary">
      <h3 className="text-xs font-bold text-content-primary">What approval unlocks</h3>
      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {meta.perks.map((p) => (
          <li key={p} className="flex items-start gap-1.5">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-brand-emerald" /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DemoAdminCredentialsCard() {
  return (
    <div className="mx-auto mt-4 max-w-md rounded-xl border border-brand-amber/40 bg-brand-amber/10 p-4 text-[11px] text-content-secondary">
      <p className="text-xs font-bold text-content-primary">Demo admin credentials</p>
      <p className="mt-1">
        Use these to log into the admin console while VeriPulse is in demo mode (no live Supabase):
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
        <dt className="text-content-muted">Email</dt>
        <dd className="text-content-primary">{DEMO_ADMIN_EMAIL}</dd>
        <dt className="text-content-muted">Password</dt>
        <dd className="text-content-primary">any (magic link, no password)</dd>
        <dt className="text-content-muted">Username</dt>
        <dd className="text-content-primary">@{DEMO_ADMIN_PROFILE.username}</dd>
      </dl>
      <p className="mt-2 text-[10px] text-content-muted">
        This is a demo-only account. In production, grant admin via{' '}
        <span className="font-mono">profiles.is_admin = true</span> or the{' '}
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
