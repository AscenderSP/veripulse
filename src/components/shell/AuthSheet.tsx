'use client';

import { useState } from 'react';
import {
  X,
  Mail,
  Loader2,
  CheckCircle2,
  Phone,
  ShieldCheck,
  Newspaper,
  UserCircle2,
  Sparkles,
  AlertTriangle,
  Lock,
  FileCheck2,
} from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { useSession } from '@/hooks/useSession';
import { useCaptchaGate } from '@/hooks/useCaptchaGate';
import { ACCOUNT_TYPES } from '@/lib/accountTiers';
import type { AccountType } from '@/lib/types';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup';
type SigninView = 'picker' | 'email' | 'phone' | 'digilocker' | 'sent';
type SignupStep = 'account_type' | 'details' | 'journalist_verify' | 'done';

const ACCOUNT_ORDER: AccountType[] = ['reader', 'citizen_reporter', 'pro_reporter', 'journalist'];
const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  reader: UserCircle2,
  citizen_reporter: Sparkles,
  pro_reporter: ShieldCheck,
  journalist: Newspaper,
};

export function AuthSheet() {
  const {
    authOpen,
    setAuthOpen,
    signInWithEmail,
    signInWithGoogle,
    signInWithDigiLocker,
    signInWithOtpMock,
    signUp,
    requestJournalistVerification,
  } = useSession();
  const { requireHuman } = useCaptchaGate();

  const [mode, setMode] = useState<Mode>('signin');
  // sign-in state
  const [signinView, setSigninView] = useState<SigninView>('picker');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  // sign-up state
  const [signupStep, setSignupStep] = useState<SignupStep>('account_type');
  const [accountType, setAccountType] = useState<AccountType>('citizen_reporter');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [pressId, setPressId] = useState('');
  const [employer, setEmployer] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authOpen) return null;

  function close() {
    setAuthOpen(false);
    setTimeout(reset, 200);
  }

  function reset() {
    setMode('signin');
    setSigninView('picker');
    setSignupStep('account_type');
    setEmail('');
    setPhone('');
    setOtp('');
    setAadhaar('');
    setName('');
    setUsername('');
    setEmailOrPhone('');
    setPressId('');
    setEmployer('');
    setProofNote('');
    setError(null);
    setBusy(false);
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const r = await signInWithGoogle();
    setBusy(false);
    if (r.error) setError(r.error);
    else close();
  }

  async function handleEmailLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await signInWithEmail(email.trim());
    setBusy(false);
    if (r.error) setError(r.error);
    else setSigninView('sent');
  }

  async function handlePhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await signInWithOtpMock(phone.trim(), otp.trim() || '000000');
    setBusy(false);
    if (r.error) setError(r.error);
    else close();
  }

  async function handleDigiLocker(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await signInWithDigiLocker(aadhaar);
    setBusy(false);
    if (r.error) setError(r.error);
    else close();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Account creation always requires a captcha — this is the one surface
    // we never give a free pass on, regardless of the batch counter.
    const captcha = await requireHuman({
      always: true,
      reason: 'Verify you are human to finish creating your account.',
    });
    if (!captcha.ok) {
      setError('Captcha not completed. Please try again.');
      return;
    }
    setBusy(true);
    const r = await signUp({
      name,
      username: username || name.toLowerCase().replace(/\s+/g, '_'),
      emailOrPhone: emailOrPhone.trim(),
      accountType,
    });
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    if (accountType === 'journalist') setSignupStep('journalist_verify');
    else setSignupStep('done');
  }

  async function handleJournalistVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await requestJournalistVerification({
      pressCredentialId: pressId,
      employer,
      proofNote,
    });
    setBusy(false);
    if (r.error) setError(r.error);
    else setSignupStep('done');
  }

  const headerTitle =
    mode === 'signup'
      ? signupStep === 'journalist_verify'
        ? 'Verify your press credentials'
        : signupStep === 'done'
          ? 'Welcome to VeriPulse'
          : 'Create your account'
      : signinView === 'sent'
        ? 'Check your inbox'
        : 'Sign in to VeriPulse';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal
    >
      <div className="sheet-overlay absolute inset-0" onClick={close} />
      <div className="safe-bottom-sheet relative z-10 w-full max-w-sm sm:max-w-md">
        <div className="modal-content p-5">
          <div className="sheet-handle sm:hidden" />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-content-primary">{headerTitle}</h2>
            <button
              onClick={close}
              aria-label="Close"
              className="press-effect flex h-7 w-7 items-center justify-center rounded-full glass text-content-muted hover:text-content-primary"
            >
              <X size={14} />
            </button>
          </div>

          {signupStep !== 'done' && signinView !== 'sent' && (
            <ModeTabs mode={mode} onChange={(m) => { setMode(m); setError(null); }} />
          )}

          {mode === 'signin' && signinView === 'picker' && (
            <SignInPicker
              busy={busy}
              onGoogle={handleGoogle}
              onEmail={() => setSigninView('email')}
              onPhone={() => setSigninView('phone')}
              onDigiLocker={() => setSigninView('digilocker')}
            />
          )}

          {mode === 'signin' && signinView === 'email' && (
            <form onSubmit={handleEmailLink} className="space-y-3">
              <BackButton onClick={() => setSigninView('picker')} />
              <p className="text-xs text-content-secondary">
                We'll email a one-time sign-in link. No password needed.
              </p>
              <IconField icon={Mail}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </IconField>
              {error && <ErrorLine text={error} />}
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 size={15} className="animate-spin" />} Email me a link
              </Button>
            </form>
          )}

          {mode === 'signin' && signinView === 'phone' && (
            <form onSubmit={handlePhoneOtp} className="space-y-3">
              <BackButton onClick={() => setSigninView('picker')} />
              <p className="text-xs text-content-secondary">
                Enter your mobile and the OTP we send over SMS. Demo mode accepts any 6-digit code.
              </p>
              <IconField icon={Phone}>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98xxx xxxxx"
                  className={inputClass}
                />
              </IconField>
              <IconField icon={Lock}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP"
                  className={inputClass}
                />
              </IconField>
              {error && <ErrorLine text={error} />}
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 size={15} className="animate-spin" />} Verify & sign in
              </Button>
            </form>
          )}

          {mode === 'signin' && signinView === 'digilocker' && (
            <form onSubmit={handleDigiLocker} className="space-y-3">
              <BackButton onClick={() => setSigninView('picker')} />
              <div className="rounded-button bg-brand-sky/10 p-3 text-[11px] leading-relaxed text-content-secondary">
                <p className="font-semibold text-content-primary">Government-backed verification</p>
                We'll route you to DigiLocker / Meri Pehchaan to pull your verified Aadhaar name &
                photo. Your Aadhaar number is never stored by VeriPulse.
              </div>
              <IconField icon={ShieldCheck}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                  placeholder="Last 4 of Aadhaar (demo)"
                  className={inputClass}
                />
              </IconField>
              {error && <ErrorLine text={error} />}
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 size={15} className="animate-spin" />} Continue with DigiLocker
              </Button>
            </form>
          )}

          {mode === 'signin' && signinView === 'sent' && (
            <div className="flex items-start gap-2 rounded-button bg-[var(--brand-emerald-glow)] p-3 text-xs text-content-primary animate-scale-in">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-emerald" />
              Check {email} for a sign-in link.
            </div>
          )}

          {mode === 'signup' && signupStep === 'account_type' && (
            <div className="space-y-3">
              <p className="text-xs text-content-secondary">
                Pick what fits you. Everyone can vote, earn & hunt bounties. Choose Journalist only if
                you can show press credentials.
              </p>
              <div className="space-y-2">
                {ACCOUNT_ORDER.map((id) => {
                  const meta = ACCOUNT_TYPES[id];
                  const Icon = ACCOUNT_ICONS[id];
                  const selected = accountType === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setAccountType(id)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-button border p-3 text-left transition',
                        selected
                          ? 'border-brand-emerald bg-[var(--brand-emerald-glow)]'
                          : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      <Icon size={18} className="mt-0.5 shrink-0 text-brand-emerald" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-content-primary">
                            {meta.name}
                          </span>
                          <span className="text-[10px] font-mono text-content-muted">
                            {meta.priceInr === 0 ? 'Free' : `₹${meta.priceInr}/mo`}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-content-secondary">
                          {meta.subtitle}
                        </p>
                        {selected && (
                          <ul className="mt-2 space-y-0.5 text-[10px] text-content-muted">
                            {meta.perks.slice(0, 3).map((p) => (
                              <li key={p}>· {p}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button className="w-full" onClick={() => setSignupStep('details')}>
                Continue
              </Button>
            </div>
          )}

          {mode === 'signup' && signupStep === 'details' && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <BackButton onClick={() => setSignupStep('account_type')} />
              <GoogleButton onClick={handleGoogle} busy={busy} label="Sign up with Google" />
              <Divider label="or with email" />
              <IconField icon={UserCircle2}>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className={inputClass}
                />
              </IconField>
              <IconField icon={Sparkles}>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="Username (optional)"
                  className={inputClass}
                />
              </IconField>
              <IconField icon={Mail}>
                <input
                  required
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="Email or +91 phone"
                  className={inputClass}
                />
              </IconField>
              {accountType === 'pro_reporter' && (
                <div className="rounded-button border border-brand-amber/40 bg-brand-amber/10 p-2.5 text-[11px] text-content-secondary">
                  Pro Reporter is ₹99/mo. We'll ask for payment after your account is created.
                </div>
              )}
              {accountType === 'journalist' && (
                <div className="rounded-button border border-brand-sky/40 bg-brand-sky/10 p-2.5 text-[11px] text-content-secondary">
                  Next step collects your press credential ID. Posts stay in review until an admin
                  approves. Verified status unlocks UPI payouts.
                </div>
              )}
              {error && <ErrorLine text={error} />}
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 size={15} className="animate-spin" />} Create account
              </Button>
            </form>
          )}

          {mode === 'signup' && signupStep === 'journalist_verify' && (
            <form onSubmit={handleJournalistVerify} className="space-y-3">
              <p className="text-xs text-content-secondary">
                Give us your PIB / press-club credential or outlet press-card number. Our team will
                check it and flip your badge to Verified Journalist usually within 48 h.
              </p>
              <IconField icon={FileCheck2}>
                <input
                  required
                  value={pressId}
                  onChange={(e) => setPressId(e.target.value)}
                  placeholder="Press credential ID"
                  className={inputClass}
                />
              </IconField>
              <IconField icon={Newspaper}>
                <input
                  required
                  value={employer}
                  onChange={(e) => setEmployer(e.target.value)}
                  placeholder="Outlet / employer"
                  className={inputClass}
                />
              </IconField>
              <textarea
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                placeholder="Portfolio link or short note (optional)"
                rows={3}
                className="w-full rounded-button border border-[var(--glass-border)] bg-bg-primary/50 p-2.5 text-sm text-content-primary focus:border-brand-emerald focus:outline-none"
              />
              {error && <ErrorLine text={error} />}
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 size={15} className="animate-spin" />} Submit for review
              </Button>
            </form>
          )}

          {mode === 'signup' && signupStep === 'done' && (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-emerald-glow)]">
                <CheckCircle2 size={22} className="text-brand-emerald" />
              </div>
              <h3 className="text-base font-bold text-content-primary">You're in.</h3>
              <p className="text-xs text-content-secondary">
                {accountType === 'journalist'
                  ? 'Verification submitted. You can post up to 3 drafts/day while we review.'
                  : accountType === 'pro_reporter'
                    ? 'Head to Profile → Subscription to activate Pro and unlock 15 posts/day.'
                    : 'Verify your Aadhaar in Profile to unlock full voting weight & review prompts.'}
              </p>
              <Button className="w-full" onClick={close}>
                Explore VeriPulse
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-button border border-[var(--glass-border)] bg-bg-primary/50 py-2.5 pl-9 pr-3 text-sm text-content-primary focus:border-brand-emerald focus:outline-none';

function IconField({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-medium text-content-muted hover:text-content-primary"
    >
      ← Back
    </button>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1 text-xs text-brand-rose">
      <AlertTriangle size={12} /> {text}
    </p>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-content-muted">
      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
      {label}
      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  );
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-button border border-[var(--border-subtle)] p-1">
      {(['signin', 'signup'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            'rounded-[8px] px-3 py-1.5 text-xs font-semibold transition',
            mode === m
              ? 'bg-bg-elevated text-content-primary shadow'
              : 'text-content-muted hover:text-content-primary',
          )}
        >
          {m === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      ))}
    </div>
  );
}

function SignInPicker({
  busy,
  onGoogle,
  onEmail,
  onPhone,
  onDigiLocker,
}: {
  busy: boolean;
  onGoogle: () => void;
  onEmail: () => void;
  onPhone: () => void;
  onDigiLocker: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-content-secondary">
        Voting, reporting, reviews and withdrawals need an account.
      </p>
      <GoogleButton onClick={onGoogle} busy={busy} label="Continue with Google" />
      <button
        onClick={onDigiLocker}
        className="press-effect flex w-full items-center justify-center gap-2 rounded-button border border-brand-sky/50 bg-brand-sky/10 py-2.5 text-sm font-semibold text-content-primary hover:bg-brand-sky/20"
      >
        <ShieldCheck size={16} className="text-brand-sky" />
        Continue with DigiLocker
      </button>
      <Divider label="or" />
      <button
        onClick={onEmail}
        className="press-effect flex w-full items-center justify-center gap-2 rounded-button border border-[var(--border-subtle)] bg-bg-primary/40 py-2.5 text-sm font-semibold text-content-primary hover:border-[var(--border-strong)]"
      >
        <Mail size={16} /> Email magic link
      </button>
      <button
        onClick={onPhone}
        className="press-effect flex w-full items-center justify-center gap-2 rounded-button border border-[var(--border-subtle)] bg-bg-primary/40 py-2.5 text-sm font-semibold text-content-primary hover:border-[var(--border-strong)]"
      >
        <Phone size={16} /> Phone OTP
      </button>
    </div>
  );
}

function GoogleButton({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="press-effect flex w-full items-center justify-center gap-2 rounded-button border border-[var(--border-strong)] bg-white py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.6-5.2-11.6-11.5S17.6 12.5 24 12.5c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.3-.1-2.3-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.6 15.1 18.9 12.5 24 12.5c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.3 6.3 14.1z" />
          <path fill="#4CAF50" d="M24 43.5c5.1 0 9.7-1.9 13.1-5.1l-6-5.1C29.1 34.9 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5c3.3 5.9 9.9 10 17.8 10z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.3l6 5.1c3.5-3.2 6.2-7.9 6.2-13.9 0-1.3-.1-2.3-.4-3.5z" />
        </svg>
      )}
      {label}
    </button>
  );
}
