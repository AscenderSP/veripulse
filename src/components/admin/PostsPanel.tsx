'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, RotateCcw, Shield, Search, AlertTriangle } from 'lucide-react';
import type { Story } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';
import {
  fetchPosts,
  moderatePost,
  type ModerationStatus,
} from './adminApi';

export function PostsPanel({ demo, localPreview }: { demo: boolean; localPreview: boolean }) {
  const [status, setStatus] = useState<ModerationStatus>('live');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const useDemo = demo || localPreview;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchPosts({ demo: useDemo, status, q }));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [useDemo, status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function act(id: string, action: 'takedown' | 'restore') {
    setBusyId(id);
    try {
      await moderatePost({ demo: useDemo, storyId: id, action, reason });
      setRows((prev) => prev.filter((r) => r.id !== id));
      setNote(
        localPreview
          ? `Preview only — ${action === 'takedown' ? 'took down' : 'restored'} locally.`
          : action === 'takedown'
            ? 'Post taken down.'
            : 'Post restored to the public feed.',
      );
    } catch {
      setNote('Action failed.');
    }
    setBusyId(null);
    setReasonFor(null);
    setReason('');
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-bold text-content-primary">Content moderation</h2>
        <div className="inline-flex rounded-button border border-[var(--border-subtle)] p-1 text-[11px]">
          {(['live', 'taken_down'] as ModerationStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-[6px] px-2.5 py-1 font-semibold transition',
                status === s
                  ? 'bg-bg-primary text-content-primary'
                  : 'text-content-muted hover:text-content-primary',
              )}
            >
              {s === 'live' ? 'Live' : 'Taken down'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title…"
            className="w-44 rounded-button border border-[var(--border-subtle)] bg-bg-primary py-1.5 pl-7 pr-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
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
        <p className="py-10 text-center text-xs text-content-muted">
          Nothing to show in this view.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const title = row.titles?.en ?? '(untitled)';
            return (
              <li
                key={row.id}
                className="rounded-xl border border-[var(--border-subtle)] p-3"
              >
                <div className="flex items-start gap-3">
                  {row.media_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.media_url}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md bg-bg-primary text-content-muted">
                      <Shield size={14} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-content-primary">{title}</p>
                    <p className="mt-0.5 text-[11px] text-content-secondary">
                      {row.category} · {row.location_name} · {timeAgo(row.created_at)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-content-muted">
                      <span>cred {Math.round(row.credibility_score)}</span>
                      <span>AI {Math.round(row.ai_probability_score)}%</span>
                      <span>stage {row.rollout_stage}</span>
                      <span>imp {row.ad_impressions.toLocaleString()}</span>
                    </div>
                    {row.admin_taken_down && row.takedown_reason && (
                      <p className="mt-2 flex items-start gap-1 rounded-button bg-brand-rose/10 p-2 text-[11px] text-brand-rose">
                        <AlertTriangle size={11} className="mt-0.5" />
                        {row.takedown_reason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  {status === 'live' ? (
                    reasonFor === row.id ? (
                      <>
                        <input
                          autoFocus
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Reason for takedown…"
                          className="flex-1 rounded-button border border-[var(--border-subtle)] bg-bg-primary px-2 py-1.5 text-[11px] text-content-primary"
                        />
                        <button
                          onClick={() => act(row.id, 'takedown')}
                          disabled={busyId === row.id || reason.trim().length < 3}
                          className="press-effect flex items-center gap-1 rounded-button bg-brand-rose px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                        >
                          {busyId === row.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          Confirm
                        </button>
                        <button
                          onClick={() => {
                            setReasonFor(null);
                            setReason('');
                          }}
                          className="text-[11px] text-content-muted hover:text-content-primary"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setReasonFor(row.id)}
                        className="press-effect flex items-center gap-1 rounded-button border border-brand-rose/50 px-3 py-1.5 text-[11px] font-semibold text-brand-rose hover:bg-brand-rose/10"
                      >
                        <Trash2 size={12} /> Take down
                      </button>
                    )
                  ) : (
                    <button
                      disabled={busyId === row.id}
                      onClick={() => act(row.id, 'restore')}
                      className="press-effect flex items-center gap-1 rounded-button border border-brand-emerald/50 px-3 py-1.5 text-[11px] font-semibold text-brand-emerald hover:bg-brand-emerald/10 disabled:opacity-50"
                    >
                      {busyId === row.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      Restore
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
