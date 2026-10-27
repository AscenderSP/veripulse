'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  UserCircle2,
} from 'lucide-react';
import type { Profile } from '@/lib/types';
import { ACCOUNT_TYPES } from '@/lib/accountTiers';

export interface JournalistRow
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

export const DEMO_PENDING: JournalistRow[] = [
  {
    id: 'demo-pending-1',
    username: 'rohini_banerjee',
    full_name: 'Rohini Banerjee',
    avatar_url:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80',
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
    avatar_url:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80',
    city: 'Pune, MH',
    bio: 'Civic + transport beat. Freelance; PIB-accredited.',
    press_credential_id: 'PIB-FREELANCE-2211',
    journalist_employer: 'Freelance (PIB-accredited)',
    journalist_verification_status: 'pending',
    trust_score: 71,
    created_at: new Date(Date.now() - 86400_000 * 5).toISOString(),
  },
];

export function JournalistsPanel({
  demo,
  localPreview,
  onDecision,
}: {
  demo: boolean;
  localPreview: boolean;
  onDecision?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<JournalistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const useDemo = demo || localPreview;

  const load = useCallback(async () => {
    setLoading(true);
    if (useDemo) {
      setRows(tab === 'pending' ? DEMO_PENDING : []);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/journalists?status=${tab}`, { credentials: 'include' });
      const json = res.ok ? await res.json() : { items: [] };
      setRows(json.items ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [useDemo, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusyId(id);
    if (useDemo) {
      await new Promise((r) => setTimeout(r, 300));
    } else {
      try {
        await fetch('/api/admin/journalists', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id, decision }),
        });
      } catch {
        setNote('Action failed.');
        setBusyId(null);
        return;
      }
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setNote(
      localPreview
        ? `Preview only — ${decision}d locally.`
        : decision === 'approve'
          ? 'Approved. Journalist unlocked.'
          : 'Rejected. Dropped to Citizen Reporter.',
    );
    setBusyId(null);
    onDecision?.();
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-content-primary">Journalist verification queue</h2>
        <div className="inline-flex rounded-button border border-[var(--border-subtle)] p-1 text-[11px]">
          {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-[6px] px-2.5 py-1 font-semibold capitalize transition ${
                tab === t
                  ? 'bg-bg-primary text-content-primary'
                  : 'text-content-muted hover:text-content-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {note && (
        <div className="mb-3 rounded-button bg-[var(--brand-emerald-glow)] px-3 py-2 text-[11px] text-content-primary">
          {note}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-content-muted">
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
              actioning={busyId === r.id}
              readOnly={tab !== 'pending'}
              onDecide={decide}
            />
          ))}
        </ul>
      )}
      <PerksCard />
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
    <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-bg-primary p-3 text-[11px] text-content-secondary">
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
