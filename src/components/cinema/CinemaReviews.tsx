'use client';

// ════════════════════════════════════════════════════════════════════════
//  Cinema Sentinel UI — browse movies, verify a ticket, unlock review,
//  submit review, see verified community reviews.
//
//  Three-pillar gate (ticket hash + unlock time + 500 m geo-fence) is
//  enforced server-side; this component surfaces the gate state so the
//  user can see WHY the review button is locked.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import {
  Film,
  Ticket,
  MapPin,
  Clock,
  ShieldCheck,
  Trophy,
  ArrowLeft,
  Sparkles,
  Coins,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui/primitives';
import { EmptyState, SkeletonList } from '@/components/ui/Skeleton';
import {
  DEMO_MOVIES,
  DEMO_CINEMAS,
  DEMO_MOVIE_REVIEWS,
  isSupabaseConfigured,
} from '@/lib/demoData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api';
import { useSession, useRequireAuth } from '@/hooks/useSession';
import { useCaptchaGate } from '@/hooks/useCaptchaGate';
import { useBackClose } from '@/hooks/useBackClose';
import {
  haversineMeters,
  tierFor,
  rewardFor,
  parseTicketText,
  type ReviewTier,
} from '@/lib/cinema';
import { getCurrentCoords, triggerSuccessHaptic } from '@/lib/nativeHardware';
import type { Movie, MovieReview, Cinema, CineRatingKey } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';

const RATING_PARAMS: { key: CineRatingKey; label: string; sub: string }[] = [
  { key: 'pacing',       label: 'Pacing & Screenplay', sub: 'Story coherence, interval hook, climax' },
  { key: 'theater',      label: 'Theater Experience',  sub: 'Sound, visuals, scale' },
  { key: 'acting',       label: 'Acting',              sub: 'Lead + supporting cast' },
  { key: 'rewatch',      label: 'Rewatchability',      sub: 'Value per rupee spent' },
  { key: 'reality_gap',  label: 'Hype vs Reality',     sub: 'Did it meet the promo?' },
];

export function CinemaReviews() {
  const [movies, setMovies] = useState<Movie[]>(DEMO_MOVIES);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Movie | null>(null);
  const [verifyFor, setVerifyFor] = useState<Movie | null>(null);

  // Fetch live catalogue when Supabase is configured; otherwise demo set.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/cinema/movies');
        if (res?.ok) {
          const data = (await res.json()) as { items: Movie[] };
          if (data.items.length > 0) setMovies(data.items);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useBackClose(verifyFor !== null, () => setVerifyFor(null));
  useBackClose(selected !== null, () => setSelected(null));

  if (verifyFor) {
    return (
      <VerifyTicketFlow
        movie={verifyFor}
        onBack={() => setVerifyFor(null)}
        onVerified={() => {
          setVerifyFor(null);
          setSelected(verifyFor);
        }}
      />
    );
  }

  if (selected) {
    return (
      <MovieDetail
        movie={selected}
        onBack={() => setSelected(null)}
        onVerifyTicket={() => setVerifyFor(selected)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-brand-emerald/15 text-brand-emerald">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-content-primary">Cinema Sentinel</h2>
            <p className="mt-1 text-xs text-content-secondary">
              100% ticket-verified reviews. Three gates — ticket hash, show-time + runtime,
              500 m geo-fence — stop bots, pirate clips, and paid review farms.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <Pill icon={<Ticket size={11} />}  label="Ticket hash unique" />
              <Pill icon={<Clock size={11} />}   label="Opens after showtime" />
              <Pill icon={<MapPin size={11} />}  label="Within 500 m of the hall" />
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <SkeletonList rows={3} rowHeight={120} />
      ) : movies.length === 0 ? (
        <EmptyState title="No reviewable titles yet" body="Pull to refresh when a show you booked goes live." />
      ) : (
        <div className="space-y-3">
          {movies.map((m) => (
            <MovieCard key={m.id} movie={m} onOpen={() => setSelected(m)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-[var(--border-subtle)] bg-bg-surface px-2 py-0.5 text-content-secondary">
      {icon}
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Movie card — shows critic hype vs crowd reality side-by-side so a user
// can instantly see when a trailer is overselling.
// ────────────────────────────────────────────────────────────────────────
function MovieCard({ movie, onOpen }: { movie: Movie; onOpen: () => void }) {
  const gap =
    movie.crowd_reality_score != null
      ? movie.crowd_reality_score - movie.critic_hype_score
      : null;
  const gapColor =
    gap == null
      ? 'text-content-muted'
      : gap >= 0.5
        ? 'text-brand-emerald'
        : gap <= -1.0
          ? 'text-brand-rose'
          : 'text-content-secondary';
  return (
    <button
      onClick={onOpen}
      className="press-effect flex w-full items-stretch gap-3 overflow-hidden rounded-card border border-[var(--border-subtle)] bg-bg-surface text-left hover:bg-bg-elevated"
    >
      <div
        className="aspect-[2/3] w-20 shrink-0 bg-bg-elevated bg-cover bg-center"
        style={{ backgroundImage: `url(${movie.poster_url})` }}
      />
      <div className="min-w-0 flex-1 py-3 pr-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-bold text-content-primary">{movie.title}</h3>
          <ChevronRight size={14} className="shrink-0 text-content-muted" />
        </div>
        <div className="mt-0.5 text-[11px] text-content-muted">
          {movie.language.toUpperCase()} · {movie.duration_minutes} min · {new Date(movie.release_date).toLocaleDateString()}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <ScorePill label="Critic hype" value={movie.critic_hype_score} tone="text-brand-sky" />
          <ScorePill
            label="Crowd reality"
            value={movie.crowd_reality_score}
            tone={gapColor}
            suffix={
              gap != null && (
                <span className={cn('ml-1 font-mono text-[10px]', gapColor)}>
                  {gap >= 0 ? '+' : ''}
                  {gap.toFixed(1)}
                </span>
              )
            }
          />
        </div>
      </div>
    </button>
  );
}

function ScorePill({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: number | null;
  tone: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="rounded-button border border-[var(--border-subtle)] bg-bg-primary px-2 py-1">
      <div className="text-[10px] uppercase tracking-wider text-content-muted">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-sm font-bold', tone)}>
          {value == null ? '—' : value.toFixed(1)}
        </span>
        <span className="text-[10px] text-content-muted">/10</span>
        {suffix}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Movie detail — review list + CTA to verify ticket and post a review.
// ────────────────────────────────────────────────────────────────────────
function MovieDetail({
  movie,
  onBack,
  onVerifyTicket,
}: {
  movie: Movie;
  onBack: () => void;
  onVerifyTicket: () => void;
}) {
  const [reviews, setReviews] = useState<MovieReview[]>(() =>
    DEMO_MOVIE_REVIEWS.filter((r) => r.movie_id === movie.id),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/cinema/reviews?movie_id=${encodeURIComponent(movie.id)}`);
        if (res?.ok) {
          const data = (await res.json()) as { items: MovieReview[] };
          setReviews(data.items);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [movie.id]);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary"
      >
        <ArrowLeft size={18} /> Back to Cinema Sentinel
      </button>

      <Card className="overflow-hidden">
        <div
          className="h-32 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${movie.poster_url})` }}
        />
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-content-primary">{movie.title}</h2>
              <div className="text-xs text-content-muted">
                {movie.language.toUpperCase()} · {movie.duration_minutes} min · Released{' '}
                {new Date(movie.release_date).toLocaleDateString()}
              </div>
            </div>
            <Button onClick={onVerifyTicket} className="bg-brand-emerald text-[#04110b] font-bold text-xs px-3 py-1.5">
              <Ticket size={14} className="mr-1" /> Verify Ticket
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <ScorePill label="Critic hype"   value={movie.critic_hype_score}   tone="text-brand-sky" />
            <ScorePill label="Crowd reality" value={movie.crowd_reality_score} tone="text-brand-emerald" />
          </div>
        </div>
      </Card>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-content-secondary">
          Verified reviews ({reviews.length})
        </h3>
        {loading ? (
          <SkeletonList rows={3} rowHeight={96} />
        ) : reviews.length === 0 ? (
          <EmptyState
            title="No verified reviews yet"
            body="Be the First Sentinel — a 50 VPcoin bonus is waiting for the FDFS reviewer."
          />
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <ReviewRow key={r.id} review={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ review }: { review: MovieReview }) {
  const [reveal, setReveal] = useState(false);
  const tierColor =
    review.window_tier === 'fdfs'
      ? 'bg-brand-amber/15 text-brand-amber'
      : review.window_tier === 'day1'
        ? 'bg-brand-sky/15 text-brand-sky'
        : 'bg-brand-emerald/15 text-brand-emerald';
  const tierLabel =
    review.window_tier === 'fdfs'
      ? 'FDFS'
      : review.window_tier === 'day1'
        ? 'Day 1'
        : 'Verified';

  return (
    <div className="rounded-card border border-[var(--border-subtle)] bg-bg-surface p-3">
      <div className="flex items-center justify-between gap-2 text-[11px] text-content-muted">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-pill px-2 py-0.5 font-bold', tierColor)}>{tierLabel}</span>
          <span className="font-mono">{review.overall_score.toFixed(1)}/10</span>
          <span>· Reality {review.reality_gap.toFixed(1)}</span>
        </div>
        <span>{timeAgo(review.created_at)}</span>
      </div>
      {review.spoiler ? (
        <button
          onClick={() => setReveal((r) => !r)}
          className="press-effect mt-2 flex w-full items-center justify-between gap-2 rounded-button border border-dashed border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-muted"
        >
          <span className="flex items-center gap-1.5">
            {reveal ? <Eye size={13} /> : <EyeOff size={13} />}
            {reveal ? 'Spoiler shown' : 'Spoiler hidden — tap to reveal'}
          </span>
          <AlertTriangle size={12} className="text-brand-rose" />
        </button>
      ) : (
        <p className="mt-2 text-sm text-content-primary">{review.verdict}</p>
      )}
      <div className="mt-2 text-[10px] text-content-muted">
        <MapPin size={9} className="mr-0.5 inline" />
        {review.distance_meters} m from the hall
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Verify ticket + submit review flow.
// ────────────────────────────────────────────────────────────────────────
function VerifyTicketFlow({
  movie,
  onBack,
  onVerified,
}: {
  movie: Movie;
  onBack: () => void;
  onVerified: () => void;
}) {
  const { profile, demo, patchDemoProfile } = useSession();
  const requireAuth = useRequireAuth();
  const { requireHuman } = useCaptchaGate();
  const [cinemaId, setCinemaId] = useState<string>(DEMO_CINEMAS[0]?.id ?? '');
  const [showTime, setShowTime] = useState<string>(() =>
    // Default to a show that unlocks in the next couple of hours.
    new Date(Date.now() - (movie.duration_minutes + 10) * 60_000).toISOString().slice(0, 16),
  );
  const [seatNo, setSeatNo] = useState<string>('F14');
  const [bookingId, setBookingId] = useState<string>('BMS' + Math.random().toString(36).slice(2, 10).toUpperCase());
  const [ratings, setRatings] = useState<Record<CineRatingKey, number>>({
    pacing: 7, theater: 7, acting: 7, rewatch: 6, reality_gap: 6,
  });
  const [verdict, setVerdict] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [stage, setStage] = useState<'ticket' | 'review'>('ticket');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [unlockAt, setUnlockAt] = useState<Date | null>(null);
  const [cinema, setCinema] = useState<Cinema | null>(() => DEMO_CINEMAS[0] ?? null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [tier, setTier] = useState<ReviewTier | null>(null);

  // Live countdown + proximity meter.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const c = await getCurrentCoords();
      if (!cancel && c) setCoords(c);
    };
    void run();
    const t = setInterval(run, 20_000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, []);

  // Prefill from OCR if the native camera dropped text in sessionStorage.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('vp_cinema_ocr_v1');
      if (!raw) return;
      window.sessionStorage.removeItem('vp_cinema_ocr_v1');
      const parsed = parseTicketText(raw);
      if (parsed.seat_no) setSeatNo(parsed.seat_no);
      if (parsed.booking_id) setBookingId(parsed.booking_id);
      if (parsed.show_time_iso)
        setShowTime(parsed.show_time_iso.slice(0, 16));
    } catch {
      /* storage disabled */
    }
  }, []);

  const unlockMs = unlockAt ? unlockAt.getTime() - Date.now() : null;
  const unlocked = unlockMs !== null && unlockMs <= 0;
  const distanceM = coords && cinema ? haversineMeters(coords, cinema) : null;
  const inFence = distanceM != null && distanceM <= 500;
  const currentTier = unlockAt ? tierFor(unlockAt) : null;
  const previewReward = currentTier && currentTier !== 'locked' ? rewardFor(currentTier) : null;

  async function verifyTicket() {
    setError(null);
    const captcha = await requireHuman({ reason: 'Confirm you are human to verify this ticket.' });
    if (!captcha.ok) {
      setError('Captcha not completed.');
      return;
    }
    setBusy(true);
    try {
      if (demo) {
        const chosen = DEMO_CINEMAS.find((c) => c.id === cinemaId) ?? DEMO_CINEMAS[0];
        setCinema(chosen);
        setTicketId('demo-' + Date.now());
        const unlock = new Date(
          new Date(showTime).getTime() + (movie.duration_minutes + (movie.interval_minutes ?? 15)) * 60_000,
        );
        setUnlockAt(unlock);
        setStage('review');
        return;
      }
      const r = await requireAuth(() =>
        apiFetch('/api/cinema/tickets/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            movie_id: movie.id,
            cinema_id: cinemaId,
            show_time: new Date(showTime).toISOString(),
            seat_no: seatNo,
            booking_id: bookingId,
            source: 'manual',
            captcha_token: captcha.token,
          }),
        }),
      );
      if (!r) return;
      if (!r.ok) {
        const detail = await r.json().catch(() => ({ error: 'Verify failed' }));
        throw new Error(detail.error || 'Verify failed');
      }
      const data = (await r.json()) as {
        ticket_id: string;
        unlock_at: string;
        cinema: Cinema;
      };
      setTicketId(data.ticket_id);
      setUnlockAt(new Date(data.unlock_at));
      setCinema(data.cinema);
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    setError(null);
    if (!ticketId || !unlockAt || !coords) {
      setError('Need ticket + live location before posting.');
      return;
    }
    if (!unlocked) {
      setError('Review opens after the show finishes.');
      return;
    }
    if (!inFence) {
      setError('Move within 500 m of the cinema to post the review.');
      return;
    }
    if (!verdict.trim() || verdict.trim().length < 10) {
      setError('Write at least a one-sentence verdict (10 chars).');
      return;
    }
    const captcha = await requireHuman({ reason: 'One more check before locking in your review.' });
    if (!captcha.ok) {
      setError('Captcha not completed.');
      return;
    }
    setBusy(true);
    try {
      if (demo) {
        const t = tierFor(unlockAt);
        const r = t === 'locked' ? 0 : rewardFor(t);
        if (profile) patchDemoProfile({ wallet_balance_inr: (profile.wallet_balance_inr ?? 0) + r / 10 });
        setReward(r);
        setTier(t === 'locked' ? null : t);
        await triggerSuccessHaptic();
        return;
      }
      const r = await requireAuth(() =>
        apiFetch('/api/cinema/reviews/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_id: ticketId,
            ratings,
            verdict: verdict.trim(),
            spoiler,
            selfie_url: null,
            lat: coords.lat,
            lng: coords.lng,
            captcha_token: captcha.token,
          }),
        }),
      );
      if (!r) return;
      if (!r.ok) {
        const detail = await r.json().catch(() => ({ error: 'Failed' }));
        throw new Error(detail.error || 'Submit failed');
      }
      const data = (await r.json()) as { reward_vp: number; window_tier: ReviewTier };
      setReward(data.reward_vp);
      setTier(data.window_tier);
      await triggerSuccessHaptic();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed.');
    } finally {
      setBusy(false);
    }
  }

  // Success screen.
  if (reward !== null) {
    return (
      <SuccessPanel
        movie={movie}
        reward={reward}
        tier={tier}
        onDone={onVerified}
      />
    );
  }

  if (stage === 'ticket') {
    return (
      <TicketStep
        movie={movie}
        cinemas={DEMO_CINEMAS}
        cinemaId={cinemaId}
        setCinemaId={(id) => {
          setCinemaId(id);
          setCinema(DEMO_CINEMAS.find((c) => c.id === id) ?? null);
        }}
        showTime={showTime}
        setShowTime={setShowTime}
        seatNo={seatNo}
        setSeatNo={setSeatNo}
        bookingId={bookingId}
        setBookingId={setBookingId}
        error={error}
        busy={busy}
        onBack={onBack}
        onVerify={verifyTicket}
      />
    );
  }

  return (
    <ReviewStep
      movie={movie}
      cinema={cinema}
      ratings={ratings}
      setRating={(k, v) => setRatings((r) => ({ ...r, [k]: v }))}
      verdict={verdict}
      setVerdict={setVerdict}
      spoiler={spoiler}
      setSpoiler={setSpoiler}
      unlockMs={unlockMs}
      unlocked={unlocked}
      distanceM={distanceM}
      inFence={inFence}
      previewTier={currentTier}
      previewReward={previewReward}
      error={error}
      busy={busy}
      onBack={() => setStage('ticket')}
      onSubmit={submitReview}
      // Force a tick dependency so the countdown re-renders.
      _tick={tick}
    />
  );
}

// ─── sub-steps ─────────────────────────────────────────────────────────
function TicketStep(props: {
  movie: Movie;
  cinemas: Cinema[];
  cinemaId: string;
  setCinemaId: (id: string) => void;
  showTime: string;
  setShowTime: (v: string) => void;
  seatNo: string;
  setSeatNo: (v: string) => void;
  bookingId: string;
  setBookingId: (v: string) => void;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onVerify: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={props.onBack}
        className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Ticket size={16} className="text-brand-emerald" />
          <h3 className="text-sm font-bold text-content-primary">Verify your ticket</h3>
        </div>
        <p className="text-[11px] text-content-muted">
          For {props.movie.title}. Fields auto-fill from a BookMyShow QR scan on the native shell;
          otherwise type them in from your ticket.
        </p>

        <Field label="Cinema">
          <select
            value={props.cinemaId}
            onChange={(e) => props.setCinemaId(e.target.value)}
            className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-sm text-content-primary"
          >
            {props.cinemas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.city}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Show time (local)">
          <input
            type="datetime-local"
            value={props.showTime}
            onChange={(e) => props.setShowTime(e.target.value)}
            className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-sm text-content-primary"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Seat (e.g. F14)">
            <input
              type="text"
              value={props.seatNo}
              onChange={(e) => props.setSeatNo(e.target.value.toUpperCase())}
              maxLength={10}
              className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-sm text-content-primary"
            />
          </Field>
          <Field label="Booking / PNR">
            <input
              type="text"
              value={props.bookingId}
              onChange={(e) => props.setBookingId(e.target.value.toUpperCase())}
              maxLength={24}
              className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-sm text-content-primary"
            />
          </Field>
        </div>

        {props.error && (
          <div className="rounded-button border border-brand-rose/40 bg-brand-rose/10 px-3 py-2 text-[11px] font-semibold text-brand-rose">
            {props.error}
          </div>
        )}

        <Button
          onClick={props.onVerify}
          disabled={props.busy}
          className="w-full bg-brand-emerald text-[#04110b] font-bold text-xs"
        >
          {props.busy ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Verifying…
            </span>
          ) : (
            'Verify ticket'
          )}
        </Button>
      </Card>
    </div>
  );
}

function ReviewStep(props: {
  movie: Movie;
  cinema: Cinema | null;
  ratings: Record<CineRatingKey, number>;
  setRating: (k: CineRatingKey, v: number) => void;
  verdict: string;
  setVerdict: (v: string) => void;
  spoiler: boolean;
  setSpoiler: (b: boolean) => void;
  unlockMs: number | null;
  unlocked: boolean;
  distanceM: number | null;
  inFence: boolean;
  previewTier: ReviewTier | 'locked' | null;
  previewReward: number | null;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onSubmit: () => void;
  _tick: number;
}) {
  const words = props.verdict.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="space-y-4">
      <button
        onClick={props.onBack}
        className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary"
      >
        <ArrowLeft size={18} /> Edit ticket
      </button>

      <Card className="space-y-3 p-4">
        <GateRow
          icon={<Clock size={14} />}
          label="Review window"
          ok={props.unlocked}
          value={
            props.unlockMs == null
              ? '—'
              : props.unlocked
                ? `Open — ${props.previewTier?.toUpperCase() ?? ''} tier`
                : `Opens in ${formatCountdown(props.unlockMs)}`
          }
        />
        <GateRow
          icon={<MapPin size={14} />}
          label={props.cinema ? `Distance to ${props.cinema.name}` : 'Distance to cinema'}
          ok={props.inFence}
          value={props.distanceM == null ? 'Locating…' : `${props.distanceM} m`}
        />
        {props.previewReward != null && (
          <GateRow
            icon={<Coins size={14} />}
            label="Reward tier"
            ok
            value={`+${props.previewReward} VPcoins · ${props.previewTier?.toUpperCase()}`}
          />
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Film size={16} className="text-brand-emerald" />
          <h3 className="text-sm font-bold text-content-primary">Rate the five parameters</h3>
        </div>
        {RATING_PARAMS.map((p) => (
          <RatingSlider
            key={p.key}
            label={p.label}
            sub={p.sub}
            value={props.ratings[p.key]}
            onChange={(v) => props.setRating(p.key, v)}
          />
        ))}

        <Field label={`One-sentence verdict (${words}/25 words max)`}>
          <textarea
            value={props.verdict}
            onChange={(e) => props.setVerdict(e.target.value)}
            maxLength={220}
            rows={2}
            className="w-full resize-none rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-sm text-content-primary"
            placeholder="Punchy. 25 words or less."
          />
        </Field>

        <label className="flex items-center gap-2 text-xs text-content-secondary">
          <input
            type="checkbox"
            checked={props.spoiler}
            onChange={(e) => props.setSpoiler(e.target.checked)}
            className="h-4 w-4 accent-brand-emerald"
          />
          <AlertTriangle size={12} className="text-brand-rose" />
          Flag as spoiler — body hidden until tapped
        </label>

        {props.error && (
          <div className="rounded-button border border-brand-rose/40 bg-brand-rose/10 px-3 py-2 text-[11px] font-semibold text-brand-rose">
            {props.error}
          </div>
        )}

        <Button
          onClick={props.onSubmit}
          disabled={props.busy || !props.unlocked || !props.inFence}
          className="w-full bg-brand-emerald text-[#04110b] font-bold text-xs"
        >
          {props.busy ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Submitting…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Sparkles size={14} /> Submit verified review
            </span>
          )}
        </Button>
      </Card>
    </div>
  );
}

function RatingSlider({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-content-primary">{label}</div>
          <div className="text-[10px] text-content-muted">{sub}</div>
        </div>
        <span className="font-mono text-sm font-bold text-brand-emerald">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-1 w-full accent-brand-emerald"
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-content-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}

function GateRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-button border px-3 py-2 text-xs',
        ok
          ? 'border-brand-emerald/40 bg-brand-emerald/10 text-brand-emerald'
          : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted',
      )}
    >
      <span className="flex items-center gap-2 font-semibold">
        {icon}
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function SuccessPanel({
  movie,
  reward,
  tier,
  onDone,
}: {
  movie: Movie;
  reward: number;
  tier: ReviewTier | null;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-emerald/15 text-brand-emerald">
          <Trophy size={28} />
        </div>
        <h2 className="text-base font-extrabold text-content-primary">Review verified</h2>
        <p className="text-xs text-content-secondary">
          Your three-pillar review for <strong>{movie.title}</strong> is now part of the Crowd Reality score.
        </p>
        <div className="mx-auto inline-flex items-center gap-2 rounded-pill border border-brand-amber/40 bg-brand-amber/10 px-3 py-1.5 text-xs font-bold text-brand-amber">
          <Coins size={14} />+{reward} VPcoins
          {tier && (
            <Badge className="ml-1 bg-brand-emerald/15 text-brand-emerald text-[10px]">
              {tier.toUpperCase()}
            </Badge>
          )}
        </div>
        <Button onClick={onDone} className="w-full bg-brand-emerald text-[#04110b] font-bold text-xs">
          See verified reviews
        </Button>
      </Card>
    </div>
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
