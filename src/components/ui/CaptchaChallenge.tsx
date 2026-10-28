'use client';

// ════════════════════════════════════════════════════════════════════════
//  CaptchaChallenge — minimal in-house captcha modal.
//
//  Two defences stacked:
//    1. Honeypot field — invisible to humans, bots fill it. Any non-empty
//       value fails the challenge instantly.
//    2. Math or word puzzle — generated locally; the server /api/captcha/
//       issue endpoint also mints a signed token so a successful solve
//       can be forwarded with any mutating API call. In demo mode the
//       token is a client-stamped nonce.
//
//  No external captcha dependency (hCaptcha / reCAPTCHA). The modal is
//  mounted globally via <CaptchaMount /> and triggered by
//  `requestCaptcha()` from `src/lib/captchaBus.ts`.
// ════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, X, RefreshCw } from 'lucide-react';
import { setCaptchaListener, type CaptchaResolver } from '@/lib/captchaBus';
import { useBackClose } from '@/hooks/useBackClose';

interface Puzzle {
  question: string;
  answer: string;
}

function makeMathPuzzle(): Puzzle {
  const a = 2 + Math.floor(Math.random() * 8);  // 2..9
  const b = 2 + Math.floor(Math.random() * 8);
  const addition = Math.random() < 0.6;
  if (addition) {
    return { question: `${a} + ${b}`, answer: String(a + b) };
  }
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return { question: `${hi} − ${lo}`, answer: String(hi - lo) };
}

const WORDS = [
  'LION', 'RIVER', 'OCEAN', 'PULSE', 'TRUTH', 'SHIELD', 'AURORA', 'SPARK',
  'HARBOR', 'EMBER', 'CIPHER', 'KITE', 'ORBIT', 'BLOOM', 'STEEL', 'FOREST',
];

function makeWordPuzzle(): Puzzle {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  return { question: `Type: ${word}`, answer: word };
}

function makePuzzle(): Puzzle {
  return Math.random() < 0.5 ? makeMathPuzzle() : makeWordPuzzle();
}

async function issueServerToken(): Promise<string | null> {
  // Best-effort: a server-signed challenge binds the solve to a nonce the
  // server will remember. Falls back to null in demo mode where the
  // route isn't reachable.
  try {
    const resp = await fetch('/api/captcha/issue', { method: 'POST' });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

export function CaptchaMount() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [puzzle, setPuzzle] = useState<Puzzle>(() => makePuzzle());
  const [input, setInput] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const resolverRef = useRef<CaptchaResolver | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setPuzzle(makePuzzle());
    setInput('');
    setError(null);
    setToken(await issueServerToken());
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    setCaptchaListener(({ resolver, reason: r }) => {
      resolverRef.current = resolver;
      setReason(r);
      setAttempts(0);
      setHoneypot('');
      setOpen(true);
      void refresh();
    });
    return () => setCaptchaListener(null);
  }, [refresh]);

  const resolve = useCallback((ok: boolean) => {
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    r?.({ ok, token: ok ? token ?? undefined : undefined, answer: ok ? input : undefined });
  }, [input, token]);

  // Native back / swipe-back cancels the challenge.
  useBackClose(open, () => resolve(false));

  function submit() {
    if (honeypot.trim().length > 0) {
      // Bot behaviour — fail without feedback that could help them tune.
      resolve(false);
      return;
    }
    const normalized = input.trim().toUpperCase();
    const expected = puzzle.answer.toUpperCase();
    if (normalized === expected) {
      resolve(true);
      return;
    }
    setAttempts((a) => a + 1);
    setError('Not quite — try again.');
    setInput('');
    if (attempts >= 2) {
      // Cycle the puzzle after 3 failed tries so a human doesn't get stuck.
      void refresh();
      setAttempts(0);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vp-captcha-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-strong)] bg-bg-elevated p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-emerald/15 text-brand-emerald">
              <ShieldCheck size={16} />
            </div>
            <h2 id="vp-captcha-title" className="text-sm font-bold text-content-primary">
              Quick check
            </h2>
          </div>
          <button
            onClick={() => resolve(false)}
            aria-label="Cancel"
            className="press-effect flex h-7 w-7 items-center justify-center rounded-full text-content-muted hover:bg-bg-primary hover:text-content-primary"
          >
            <X size={14} />
          </button>
        </div>

        <p className="mt-2 text-xs text-content-secondary">
          {reason ?? 'Confirm you are human to continue.'}
        </p>

        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-base font-bold tracking-wider text-content-primary">
              {puzzle.question}
            </span>
            <button
              onClick={() => void refresh()}
              aria-label="New puzzle"
              className="press-effect flex h-7 w-7 items-center justify-center rounded-full text-content-muted hover:bg-bg-elevated hover:text-content-primary"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-label="Your answer"
            className="mt-3 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-sm text-content-primary outline-none focus:border-brand-emerald"
            placeholder="Your answer"
          />

          {/* Honeypot: hidden from humans with CSS + off-screen; bots that
              fill every input will trigger a silent fail. */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-9999px',
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: 'none',
            }}
          />

          {error && (
            <div className="mt-2 text-[11px] text-brand-rose">{error}</div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => resolve(false)}
            className="press-effect rounded-button px-3 py-1.5 text-xs font-semibold text-content-secondary hover:text-content-primary"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="press-effect rounded-button bg-brand-emerald px-4 py-1.5 text-xs font-bold text-[#04110b]"
          >
            Verify
          </button>
        </div>
      </div>
    </div>
  );
}
