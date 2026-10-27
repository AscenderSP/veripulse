'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Star, X, Send, Smartphone, Car, Bike, Laptop, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { useSession } from '@/hooks/useSession';
import { DEMO_PASSPORTS } from '@/lib/demoData';
import type { OwnershipPassport, ProductCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

const STORAGE_REVIEWED = 'veripulse_reviewed_passports_v1';
const STORAGE_DISMISSED = 'veripulse_dismissed_passports_v1';
const REVIEW_REWARD_VPCOINS = 150;

const CATEGORY_ICON: Record<ProductCategory, React.ElementType> = {
  mobile: Smartphone,
  car: Car,
  bike: Bike,
  laptop: Laptop,
};

function readSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

/**
 * Nudges verified owners to review a product they own. Shown as a bottom-right
 * toast; dismissible. Only one prompt is active at a time, cycling through
 * unreviewed verified-ownership passports. Submitting credits a reward.
 */
export function ReviewPrompt() {
  const { profile, patchDemoProfile, demo } = useSession();
  const [reviewed, setReviewed] = useState<Set<string>>(() => readSet(STORAGE_REVIEWED));
  const [dismissed, setDismissed] = useState<Set<string>>(() => readSet(STORAGE_DISMISSED));
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  // Shows the first eligible passport the current user owns, that they haven't
  // reviewed or dismissed yet. In live mode we would read from the user's own
  // ownership_verifications rows via Supabase.
  const candidate: OwnershipPassport | null = useMemo(() => {
    if (!profile?.is_ownership_verified) return null;
    const myOwned = DEMO_PASSPORTS.filter((p) => {
      const matchesHandle = p.ownerName === profile.username;
      // In demo we also surface the first passport if there's no name match,
      // so a brand-new verified user still sees the prompt system.
      return matchesHandle || (!profile.username.startsWith('google_') && p.id === 'pp-1');
    });
    const pool = myOwned.length > 0 ? myOwned : DEMO_PASSPORTS.slice(0, 1);
    return pool.find((p) => !reviewed.has(p.id) && !dismissed.has(p.id)) ?? null;
  }, [profile, reviewed, dismissed]);

  const dismiss = useCallback(() => {
    if (!candidate) return;
    const next = new Set(dismissed).add(candidate.id);
    setDismissed(next);
    writeSet(STORAGE_DISMISSED, next);
  }, [candidate, dismissed]);

  async function submit() {
    if (!candidate || rating === 0) return;
    setSending(true);
    // Simulate verified-review submission. Live mode would POST to
    // /api/reviews with the ownership_verification_id so the server can
    // enforce authenticity (only the verified owner can review).
    await new Promise((r) => setTimeout(r, 650));
    const next = new Set(reviewed).add(candidate.id);
    setReviewed(next);
    writeSet(STORAGE_REVIEWED, next);
    if (profile && demo) {
      const nextCoins = (profile.wallet_balance_vpcoins ?? 0) + REVIEW_REWARD_VPCOINS;
      patchDemoProfile({ wallet_balance_vpcoins: nextCoins });
    }
    setSending(false);
    setConfirmed(candidate.productName);
    setRating(0);
    setNote('');
    setOpen(false);
    window.setTimeout(() => setConfirmed(null), 3200);
  }

  // Nothing to show.
  if (!profile) return null;
  if (!candidate && !confirmed) return null;

  if (confirmed) {
    return (
      <div className="pointer-events-none fixed bottom-24 right-4 z-40 max-w-xs animate-fade-in rounded-xl bg-[var(--brand-emerald)] px-4 py-3 text-sm font-semibold text-white shadow-lg sm:bottom-6">
        <div className="flex items-center gap-2">
          <Sparkles size={16} />
          <div>
            Thanks for reviewing <span className="underline">{confirmed}</span>.
            <div className="text-[11px] font-normal opacity-90">
              +{REVIEW_REWARD_VPCOINS} VPcoins credited.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!candidate) return null;
  const Icon =
    (CATEGORY_ICON as Record<string, React.ElementType>)[candidate.productCategory] ?? Smartphone;

  return (
    <>
      {!open && (
        <div className="fixed bottom-24 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] animate-fade-in rounded-xl border border-[var(--border-strong)] bg-bg-elevated p-3 shadow-xl sm:bottom-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-emerald-glow)]">
              <Icon size={18} className="text-brand-emerald" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-emerald">
                Verified owner review
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-content-primary">
                How's your {candidate.productName}?
              </p>
              <p className="mt-1 text-[11px] leading-snug text-content-secondary">
                You own this. Rate it and earn{' '}
                <span className="font-semibold text-brand-emerald">
                  +{REVIEW_REWARD_VPCOINS} VPcoins
                </span>
                . Takes 20 seconds.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setOpen(true)}
                  className="press-effect rounded-button bg-brand-emerald px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  Review now
                </button>
                <button
                  onClick={dismiss}
                  className="text-[11px] font-medium text-content-muted hover:text-content-primary"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="press-effect flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-content-muted hover:text-content-primary"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal
        >
          <div className="sheet-overlay absolute inset-0" onClick={() => setOpen(false)} />
          <div className="safe-bottom-sheet relative z-10 w-full max-w-sm sm:max-w-md">
            <div className="modal-content p-5">
              <div className="sheet-handle sm:hidden" />
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-emerald-glow)]">
                    <Icon size={16} className="text-brand-emerald" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-content-primary">
                      {candidate.productName}
                    </h3>
                    <p className="text-[10px] text-content-muted">
                      Verified via {candidate.verificationMethod}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="press-effect flex h-7 w-7 items-center justify-center rounded-full glass text-content-muted hover:text-content-primary"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="rounded-button bg-[var(--brand-emerald-glow)]/40 p-2.5 text-[11px] leading-relaxed text-content-secondary">
                Your review is tagged <span className="font-semibold">Verified Owner</span>. We'll
                never let non-owners post here.
              </div>

              <label className="mt-3 block text-xs font-semibold text-content-primary">
                Overall rating
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className={cn(
                      'press-effect h-9 w-9 rounded-button border transition',
                      rating >= n
                        ? 'border-brand-amber bg-brand-amber/15 text-brand-amber'
                        : 'border-[var(--border-subtle)] text-content-muted hover:border-[var(--border-strong)]',
                    )}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  >
                    <Star size={16} className="mx-auto" fill={rating >= n ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>

              <label className="mt-3 block text-xs font-semibold text-content-primary">
                Short note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Battery life, build, after-service — the real-world stuff."
                className="mt-1 w-full rounded-button border border-[var(--glass-border)] bg-bg-primary/50 p-2.5 text-sm text-content-primary focus:border-brand-emerald focus:outline-none"
              />

              <Button
                className="mt-3 w-full"
                disabled={rating === 0 || sending}
                onClick={submit}
              >
                {sending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Submit review · earn {REVIEW_REWARD_VPCOINS} VPcoins
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
