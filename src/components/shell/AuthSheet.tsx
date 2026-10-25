'use client';

import { useState } from 'react';
import { X, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { useSession } from '@/hooks/useSession';

export function AuthSheet() {
  const { authOpen, setAuthOpen, signInWithEmail } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authOpen) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signInWithEmail(email.trim());
    setBusy(false);
    if (res.error) setError(res.error);
    else setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <div className="sheet-overlay absolute inset-0" onClick={() => setAuthOpen(false)} />
      <div className="safe-bottom-sheet relative z-10 w-full max-w-sm sm:max-w-md">
        <div className="modal-content p-5">
          <div className="sheet-handle sm:hidden" />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-content-primary">Sign in to VeriPulse</h2>
            <button
              onClick={() => setAuthOpen(false)}
              aria-label="Close"
              className="press-effect flex h-7 w-7 items-center justify-center rounded-full glass text-content-muted hover:text-content-primary"
            >
              <X size={14} />
            </button>
          </div>
          {sent ? (
            <div className="flex items-start gap-2 rounded-button bg-[var(--brand-emerald-glow)] p-3 text-xs text-content-primary animate-scale-in">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-emerald" />
              Check {email} for a sign-in link.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-xs text-content-secondary">
                Voting, reporting, ownership checks and withdrawals need an account. We'll email you a
                one-time link.
              </p>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-button border border-[var(--glass-border)] bg-bg-primary/50 py-2.5 pl-9 pr-3 text-sm text-content-primary focus:border-brand-emerald focus:outline-none"
                />
              </div>
              {error && <p className="text-xs text-brand-rose">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 size={15} className="animate-spin" />} Email me a link
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
