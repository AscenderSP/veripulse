'use client';

import { useCallback, useMemo, useState } from 'react';
import { Sparkles, X, Send, Smartphone, Car, Bike, Laptop, Loader2 } from 'lucide-react';
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

// Category-relevant rating parameters. Each gets its own 1-10 colour-coded
// bar. Keep lists short (4–5) so the form stays on one screen on mobile.
const CATEGORY_CRITERIA: Record<ProductCategory, { key: string; label: string; hint: string }[]> = {
  mobile: [
    { key: 'display', label: 'Display', hint: 'brightness, colours, refresh' },
    { key: 'performance', label: 'Performance', hint: 'speed, thermals, gaming' },
    { key: 'battery', label: 'Battery', hint: 'screen-on time, charging' },
    { key: 'camera', label: 'Camera', hint: 'photo + video quality' },
    { key: 'build', label: 'Build', hint: 'materials, feel, durability' },
  ],
  laptop: [
    { key: 'display', label: 'Display', hint: 'brightness, colours, panel' },
    { key: 'performance', label: 'Performance', hint: 'CPU, GPU, memory' },
    { key: 'battery', label: 'Battery', hint: 'real-world runtime' },
    { key: 'keyboard', label: 'Keyboard & Trackpad', hint: 'typing + pointer feel' },
    { key: 'portability', label: 'Portability', hint: 'weight, thermals, noise' },
  ],
  car: [
    { key: 'performance', label: 'Performance', hint: 'pickup, drivetrain' },
    { key: 'comfort', label: 'Comfort', hint: 'ride, seats, NVH' },
    { key: 'mileage', label: 'Mileage', hint: 'real-world fuel/charge' },
    { key: 'features', label: 'Features', hint: 'tech, safety, infotainment' },
    { key: 'build', label: 'Build Quality', hint: 'fit, finish, materials' },
  ],
  bike: [
    { key: 'performance', label: 'Performance', hint: 'power, acceleration' },
    { key: 'mileage', label: 'Mileage', hint: 'fuel economy' },
    { key: 'handling', label: 'Handling', hint: 'turning, balance, brakes' },
    { key: 'comfort', label: 'Comfort', hint: 'seat, ride, long trips' },
    { key: 'build', label: 'Build Quality', hint: 'paint, parts, service' },
  ],
};

// 1-10 colour tiers: 1-3 rose, 4-6 amber, 7-10 emerald.
function toneForScore(score: number): 'rose' | 'amber' | 'emerald' {
  if (score <= 3) return 'rose';
  if (score <= 6) return 'amber';
  return 'emerald';
}
function toneLabel(tone: 'rose' | 'amber' | 'emerald') {
  return tone === 'rose' ? 'Needs work' : tone === 'amber' ? 'Mixed' : 'Great';
}
const TONE_STYLE: Record<
  'rose' | 'amber' | 'emerald',
  { bar: string; text: string; chipActive: string }
> = {
  rose: {
    bar: 'bg-brand-rose',
    text: 'text-brand-rose',
    chipActive: 'border-brand-rose bg-brand-rose text-[color:var(--bg-primary)]',
  },
  amber: {
    bar: 'bg-brand-amber',
    text: 'text-brand-amber',
    chipActive: 'border-brand-amber bg-brand-amber text-[color:var(--bg-primary)]',
  },
  emerald: {
    bar: 'bg-brand-emerald',
    text: 'text-brand-emerald',
    chipActive: 'border-brand-emerald bg-brand-emerald text-[color:var(--bg-primary)]',
  },
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
  // Per-criterion scores keyed by criterion.key (1-10, 0 = unrated).
  const [scores, setScores] = useState<Record<string, number>>({});
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

  const criteria: { key: string; label: string; hint: string }[] = candidate
    ? CATEGORY_CRITERIA[candidate.productCategory as ProductCategory] ?? []
    : [];
  const ratedCount = Object.values(scores).filter((v) => v > 0).length;
  const overall = useMemo(() => {
    const vals = Object.values(scores).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  }, [scores]);

  async function submit() {
    if (!candidate || ratedCount === 0) return;
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
    setScores({});
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

              {/* ── Per-criterion ratings (1-10, colour-coded) ── */}
              <div className="mt-3 flex items-center justify-between">
                <label className="block text-xs font-semibold text-content-primary">
                  Rate each parameter
                </label>
                {overall > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-content-muted">
                    Overall{' '}
                    <span
                      className={cn(
                        'rounded-pill px-1.5 py-0.5 font-mono text-[11px] font-bold',
                        TONE_STYLE[toneForScore(overall)].text,
                      )}
                    >
                      {overall.toFixed(1)}/10
                    </span>
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-content-muted">
                Tap a number — 1 is poor, 10 is excellent. Red low, yellow mid, green high.
              </p>

              <div className="mt-2 max-h-[46vh] space-y-3 overflow-y-auto pr-1">
                {criteria.map((c) => (
                  <CriterionRow
                    key={c.key}
                    label={c.label}
                    hint={c.hint}
                    value={scores[c.key] ?? 0}
                    onChange={(v) => setScores((prev) => ({ ...prev, [c.key]: v }))}
                  />
                ))}
              </div>

              <label className="mt-3 block text-xs font-semibold text-content-primary">
                Short note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="After-service, surprises, deal-breakers — the real-world stuff."
                className="mt-1 w-full rounded-button border border-[var(--glass-border)] bg-bg-primary/50 p-2.5 text-sm text-content-primary focus:border-brand-emerald focus:outline-none"
              />

              <Button
                className="mt-3 w-full"
                disabled={ratedCount === 0 || sending}
                onClick={submit}
              >
                {sending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Submit review · earn {REVIEW_REWARD_VPCOINS} VPcoins
              </Button>
              {ratedCount > 0 && ratedCount < criteria.length && (
                <p className="mt-1.5 text-center text-[10px] text-content-muted">
                  {ratedCount}/{criteria.length} rated — rate the rest for a fuller review.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CriterionRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const tone = value > 0 ? toneForScore(value) : null;
  const style = tone ? TONE_STYLE[tone] : null;
  // Visualize the bar as 10 segments; filled up to `value`, each tinted by
  // the tier the FINAL value sits in — a 9 shows nine green segments, a 3
  // shows three red segments, so the colour reads at a glance.
  return (
    <div className="rounded-card border border-[var(--border-subtle)] bg-bg-primary/40 p-2.5">
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-bold text-content-primary leading-tight">{label}</div>
          <div className="truncate text-[10px] text-content-muted">{hint}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {value > 0 && style ? (
            <>
              <span className={cn('font-mono text-sm font-extrabold leading-none', style.text)}>
                {value}
                <span className="text-[10px] opacity-70">/10</span>
              </span>
              <span
                className={cn(
                  'rounded-pill px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                  style.text,
                )}
              >
                {toneLabel(tone!)}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-semibold text-content-muted">Tap to rate</span>
          )}
        </div>
      </div>

      {/* Segmented bar: 10 cells. Entire filled stretch takes the tier colour. */}
      <div
        role="radiogroup"
        aria-label={`${label} rating`}
        className="flex items-center gap-1"
      >
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const filled = value >= n;
          const segTone = filled ? toneForScore(value) : null;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} out of 10`}
              onClick={() => onChange(value === n ? 0 : n)}
              className={cn(
                'press-effect group relative h-7 flex-1 min-w-0 rounded-sm transition',
                filled && segTone
                  ? TONE_STYLE[segTone].bar
                  : 'bg-bg-elevated hover:bg-bg-surface',
              )}
            >
              <span
                className={cn(
                  'absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold transition',
                  filled
                    ? 'text-[color:var(--bg-primary)] opacity-0 group-hover:opacity-100'
                    : 'text-content-muted opacity-60',
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
