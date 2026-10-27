'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Ban,
  Check,
  Search,
  ShieldCheck,
  ShieldOff,
  RotateCcw,
  UserCircle2,
  Newspaper,
  Pause,
  Shield,
} from 'lucide-react';
import type { Profile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { fetchUsers, patchUser, type UserAction, type UserFilter } from './adminApi';

export function UsersPanel({ demo, localPreview, selfId }: {
  demo: boolean;
  localPreview: boolean;
  selfId: string | null;
}) {
  const [filter, setFilter] = useState<UserFilter>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspendFor, setSuspendFor] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendDays, setSuspendDays] = useState('7');
  const [note, setNote] = useState<string | null>(null);

  const useDemo = demo || localPreview;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchUsers({ demo: useDemo, filter, q }));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [useDemo, filter, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function act(u: Profile, action: UserAction, extra?: { reason?: string; days?: number }) {
    if (u.id === selfId && (action === 'suspend' || action === 'revoke_admin')) {
      setNote('You cannot suspend or demote yourself.');
      return;
    }
    setBusyId(u.id);
    try {
      await patchUser({ demo: useDemo, userId: u.id, action, ...extra });
      setNote(
        localPreview
          ? `Preview only — ${action.replace('_', ' ')} applied locally.`
          : `${action.replace('_', ' ')} applied.`,
      );
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== u.id) return r;
          switch (action) {
            case 'suspend':
              return {
                ...r,
                is_suspended: true,
                suspended_until: new Date(
                  Date.now() + (extra?.days ?? 7) * 86400_000,
                ).toISOString(),
                suspension_reason: extra?.reason,
              };
            case 'unsuspend':
              return { ...r, is_suspended: false, suspended_until: null, suspension_reason: undefined };
            case 'grant_admin':
              return { ...r, is_admin: true };
            case 'revoke_admin':
              return { ...r, is_admin: false };
            case 'revoke_journalist':
              return {
                ...r,
                is_journalist_verified: false,
                journalist_verification_status: 'rejected',
                account_type: 'citizen_reporter',
              };
            case 'reset_trust':
              return { ...r, trust_score: 50 };
            default:
              return r;
          }
        }),
      );
    } catch {
      setNote('Action failed.');
    }
    setBusyId(null);
    setSuspendFor(null);
    setSuspendReason('');
    setSuspendDays('7');
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-bold text-content-primary">User management</h2>
        <div className="inline-flex rounded-button border border-[var(--border-subtle)] p-1 text-[11px]">
          {(['all', 'suspended', 'journalists', 'admins'] as UserFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-[6px] px-2.5 py-1 font-semibold transition capitalize',
                filter === s
                  ? 'bg-bg-primary text-content-primary'
                  : 'text-content-muted hover:text-content-primary',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search @handle or name…"
            className="w-52 rounded-button border border-[var(--border-subtle)] bg-bg-primary py-1.5 pl-7 pr-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
          />
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
        <p className="py-10 text-center text-xs text-content-muted">No users in this view.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((u) => {
            const isMe = u.id === selfId;
            return (
              <li key={u.id} className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="flex items-start gap-3">
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatar_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle2 size={32} className="shrink-0 text-content-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-content-primary">
                        {u.full_name ?? u.username}
                      </span>
                      <span className="text-[11px] text-content-muted">@{u.username}</span>
                      {u.is_admin && (
                        <span className="flex items-center gap-1 rounded-full bg-brand-emerald/15 px-2 py-0.5 text-[10px] font-semibold text-brand-emerald">
                          <Shield size={10} /> Admin
                        </span>
                      )}
                      {u.is_journalist_verified && (
                        <span className="flex items-center gap-1 rounded-full bg-brand-sky/15 px-2 py-0.5 text-[10px] font-semibold text-brand-sky">
                          <Newspaper size={10} /> Journalist
                        </span>
                      )}
                      {u.is_suspended && (
                        <span className="flex items-center gap-1 rounded-full bg-brand-rose/15 px-2 py-0.5 text-[10px] font-semibold text-brand-rose">
                          <Pause size={10} /> Suspended
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-content-secondary">
                      {u.account_type ?? 'citizen_reporter'} · trust {Math.round(u.trust_score)} ·
                      wallet ₹{u.wallet_balance_inr.toFixed(0)}
                    </p>
                    {u.is_suspended && u.suspension_reason && (
                      <p className="mt-1 text-[11px] text-brand-rose">
                        {u.suspension_reason}
                        {u.suspended_until &&
                          ` · until ${new Date(u.suspended_until).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                </div>

                {suspendFor === u.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      autoFocus
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="Reason…"
                      className="flex-1 rounded-button border border-[var(--border-subtle)] bg-bg-primary px-2 py-1.5 text-[11px] text-content-primary"
                    />
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={suspendDays}
                      onChange={(e) => setSuspendDays(e.target.value)}
                      className="w-16 rounded-button border border-[var(--border-subtle)] bg-bg-primary px-2 py-1.5 text-[11px] text-content-primary"
                    />
                    <span className="text-[11px] text-content-muted">days</span>
                    <button
                      onClick={() =>
                        act(u, 'suspend', { reason: suspendReason, days: Number(suspendDays) })
                      }
                      disabled={busyId === u.id || suspendReason.trim().length < 3}
                      className="press-effect flex items-center gap-1 rounded-button bg-brand-rose px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      {busyId === u.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Ban size={12} />
                      )}
                      Confirm suspend
                    </button>
                    <button
                      onClick={() => setSuspendFor(null)}
                      className="text-[11px] text-content-muted hover:text-content-primary"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    {u.is_suspended ? (
                      <ActionButton
                        onClick={() => act(u, 'unsuspend')}
                        busy={busyId === u.id}
                        icon={Check}
                        label="Unsuspend"
                        tone="emerald"
                      />
                    ) : (
                      <ActionButton
                        onClick={() => setSuspendFor(u.id)}
                        disabled={isMe}
                        icon={Ban}
                        label="Suspend"
                        tone="rose"
                      />
                    )}
                    {u.is_journalist_verified && (
                      <ActionButton
                        onClick={() => act(u, 'revoke_journalist')}
                        busy={busyId === u.id}
                        icon={Newspaper}
                        label="Revoke press"
                        tone="amber"
                      />
                    )}
                    {u.is_admin ? (
                      <ActionButton
                        onClick={() => act(u, 'revoke_admin')}
                        busy={busyId === u.id}
                        disabled={isMe}
                        icon={ShieldOff}
                        label="Revoke admin"
                        tone="amber"
                      />
                    ) : (
                      <ActionButton
                        onClick={() => act(u, 'grant_admin')}
                        busy={busyId === u.id}
                        icon={ShieldCheck}
                        label="Grant admin"
                        tone="emerald"
                      />
                    )}
                    <ActionButton
                      onClick={() => act(u, 'reset_trust')}
                      busy={busyId === u.id}
                      icon={RotateCcw}
                      label="Reset trust"
                      tone="neutral"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
  tone,
  busy,
  disabled,
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  tone: 'emerald' | 'rose' | 'amber' | 'neutral';
  busy?: boolean;
  disabled?: boolean;
}) {
  const toneCls = {
    emerald: 'border-brand-emerald/40 text-brand-emerald hover:bg-brand-emerald/10',
    rose: 'border-brand-rose/40 text-brand-rose hover:bg-brand-rose/10',
    amber: 'border-brand-amber/40 text-brand-amber hover:bg-brand-amber/10',
    neutral: 'border-[var(--border-subtle)] text-content-secondary hover:border-[var(--border-strong)]',
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className={`press-effect flex items-center gap-1 rounded-button border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${toneCls}`}
    >
      {busy ? <Loader2 size={11} className="animate-spin" /> : <Icon size={11} />}
      {label}
    </button>
  );
}
