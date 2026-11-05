'use client';

import { useState, type ReactNode } from 'react';
import { Lock, Sparkles, KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, Button } from '@/components/ui/primitives';
import { useSession } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { EARLY_ACCESS_EMAIL, EARLY_ACCESS_PASSWORD } from '@/lib/demoData';

/**
 * Lightweight paywall-like gate for sections that are still in private
 * beta: Product Hub, Cinema Sentinel, Resale Passport. Shows a teaser
 * blurb for the specific section plus an email+password sign-in that
 * unlocks it via signInEarlyAccess. Credentials are printed openly on
 * the form since this is a demo surface.
 */
export function EarlyAccessTeaser({
  section,
}: {
  section: 'compare' | 'cinema' | 'passport';
}) {
  const { signInEarlyAccess } = useSession();
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const content = TEASER_COPY[section][lang] ?? TEASER_COPY[section].en;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signInEarlyAccess(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    // On success the SessionProvider swaps the profile; this component
    // unmounts because AppShell switches to rendering the real section.
  }

  function prefill() {
    setEmail(EARLY_ACCESS_EMAIL);
    setPassword(EARLY_ACCESS_PASSWORD);
  }

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 0%, color-mix(in oklab, var(--section-accent) 22%, transparent) 0%, transparent 70%)',
          }}
        />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-amber/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-amber">
            <Lock size={10} /> {lang === 'bn' ? 'আর্লি অ্যাক্সেস' : lang === 'hi' ? 'अर्ली एक्सेस' : 'Early Access'}
          </div>
          <h2 className="text-2xl font-bold text-content-primary">{content.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-content-secondary">{content.lede}</p>

          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {content.highlights.map((h, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-bg-surface p-3"
              >
                <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-emerald" />
                <span className="text-sm text-content-primary">{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="p-5">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-content-primary">
            <KeyRound size={15} className="text-brand-emerald" />
            {lang === 'bn' ? 'আর্লি অ্যাক্সেস সাইন ইন' : lang === 'hi' ? 'अर्ली एक्सेस साइन इन' : 'Sign in with your early-access credentials'}
          </div>
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                {lang === 'bn' ? 'ইমেল' : lang === 'hi' ? 'ईमेल' : 'Email'}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={EARLY_ACCESS_EMAIL}
                autoComplete="email"
                className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                {lang === 'bn' ? 'পাসওয়ার্ড' : lang === 'hi' ? 'पासवर्ड' : 'Password'}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
              />
            </label>
          </div>

          {error && (
            <div className="rounded-button border border-brand-rose/40 bg-brand-rose/10 px-3 py-2 text-xs text-brand-rose">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || !email || !password}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {lang === 'bn' ? 'অ্যাক্সেস আনলক' : lang === 'hi' ? 'एक्सेस अनलॉक' : 'Unlock access'}
            </Button>
            <button
              type="button"
              onClick={prefill}
              className="rounded-button border border-dashed border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-content-secondary hover:text-content-primary"
            >
              {lang === 'bn' ? 'ডেমো ক্রেডেনশিয়াল ভরুন' : lang === 'hi' ? 'डेमो क्रेडेंशियल भरें' : 'Fill demo credentials'}
            </button>
          </div>

          <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-bg-elevated p-3 text-[11px] text-content-muted">
            <div className="mb-1 font-semibold uppercase tracking-wide text-content-secondary">
              {lang === 'bn' ? 'ডেমো ক্রেডেনশিয়াল' : lang === 'hi' ? 'डेमो क्रेडेंशियल' : 'Demo credentials'}
            </div>
            <div>
              <span className="text-content-muted">Email</span>{' '}
              <code className="font-mono text-content-primary">{EARLY_ACCESS_EMAIL}</code>
            </div>
            <div>
              <span className="text-content-muted">Password</span>{' '}
              <code className="font-mono text-content-primary">{EARLY_ACCESS_PASSWORD}</code>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

type TeaserCopy = {
  title: string;
  lede: string;
  highlights: string[];
};

const TEASER_COPY: Record<'compare' | 'cinema' | 'passport', Record<'en' | 'bn' | 'hi', TeaserCopy>> = {
  compare: {
    en: {
      title: 'Product Hub — verified-owner telemetry, side by side',
      lede: 'Transparent product truth from people who actually own the thing — battery health decay, real range on a bike, service-center turnaround, resale retention. Still in private beta while we vet the first wave of verified owners.',
      highlights: [
        'Verified-owner reviews with document-backed ownership (GST invoice, Vahan RC, IMEI).',
        'Reality-gap score — marketing claim vs. measured telemetry from owners.',
        '3-year total cost of ownership, service-center truth, spare parts pricing.',
        'Head-to-head battles with owner-weighted vote tallies.',
      ],
    },
    bn: {
      title: 'প্রোডাক্ট হাব — যাচাইকৃত মালিকদের টেলিমেট্রি, পাশাপাশি',
      lede: 'যারা আসলে ব্যবহার করছেন তাদের কাছ থেকে প্রোডাক্টের সত্যতা — ব্যাটারি হেলথ, সার্ভিস সেন্টার টার্নঅ্যারাউন্ড, রিসেল ভ্যালু। আর্লি অ্যাক্সেসে সীমিত।',
      highlights: [
        'নথি-ভিত্তিক মালিকানা যাচাই (GST ইনভয়েস, Vahan RC, IMEI)।',
        'বিপণন দাবি বনাম বাস্তব টেলিমেট্রির "Reality Gap" স্কোর।',
        'তিন বছরের মালিকানার মোট খরচ, সার্ভিস সেন্টার রেটিং।',
        'হেড-টু-হেড প্রোডাক্ট ব্যাটল, মালিক-ওজনযুক্ত ভোট।',
      ],
    },
    hi: {
      title: 'प्रोडक्ट हब — सत्यापित मालिकों की टेलीमेट्री, तुलना में',
      lede: 'असली मालिकों से मिलने वाली पारदर्शी सच्चाई — बैटरी हेल्थ, सर्विस-सेंटर समय, पुनर्विक्रय मूल्य। फिलहाल अर्ली एक्सेस में।',
      highlights: [
        'दस्तावेज़-आधारित स्वामित्व सत्यापन (GST इनवॉइस, Vahan RC, IMEI)।',
        'मार्केटिंग दावे बनाम मापी गई टेलीमेट्री का "Reality Gap" स्कोर।',
        '3-वर्षीय कुल स्वामित्व लागत, सर्विस सेंटर रेटिंग।',
        'मालिक-भारित वोट के साथ हेड-टू-हेड तुलना।',
      ],
    },
  },
  cinema: {
    en: {
      title: 'Cinema Sentinel — reviews only from people who actually watched',
      lede: 'Reality-gap scoring on new releases from verified ticket holders, matched to their cinema and showtime. No review bombs, no paid hype. Opening for early-access members first.',
      highlights: [
        'Ticket-verified reviews (QR scan or OCR of the paper ticket).',
        'Reality-gap score — critic hype vs. the crowd that actually sat through it.',
        'Window tiers: FDFS, Day 1, standard — so first reactions aren\'t drowned out.',
        'Theatre-level projection, sound, and seating ratings.',
      ],
    },
    bn: {
      title: 'সিনেমা সেন্টিনেল — শুধু যারা সত্যিই দেখেছেন তাদের রিভিউ',
      lede: 'যাচাইকৃত টিকিট ধারকদের রিভিউ, থিয়েটার ও শো টাইমের সাথে মিলিয়ে। আর্লি অ্যাক্সেসে উন্মুক্ত।',
      highlights: [
        'টিকিট-যাচাইকৃত রিভিউ (QR স্ক্যান বা OCR)।',
        'সমালোচক হাইপ বনাম দর্শকের বাস্তবতা গ্যাপ স্কোর।',
        'FDFS, Day 1, Standard — উইন্ডো অনুযায়ী রিভিউ।',
        'থিয়েটার-স্তরের প্রজেকশন ও সাউন্ড রেটিং।',
      ],
    },
    hi: {
      title: 'सिनेमा सेंटिनल — सिर्फ उनकी समीक्षा जिन्होंने फ़िल्म देखी',
      lede: 'सत्यापित टिकट धारकों की समीक्षाएँ, थिएटर व शोटाइम से मिलान। अर्ली एक्सेस में।',
      highlights: [
        'टिकट-सत्यापित समीक्षाएँ (QR या OCR)।',
        'समालोचक हाइप बनाम दर्शक सच्चाई का गैप स्कोर।',
        'FDFS, Day 1, Standard — विंडो स्तर समीक्षाएँ।',
        'थिएटर-स्तर पर प्रोजेक्शन व ध्वनि रेटिंग।',
      ],
    },
  },
  passport: {
    en: {
      title: 'Resale Passport — a tamper-proof history for your device',
      lede: 'Battery health, repair history, decay score, QR-signed passport that travels with the device at resale. Pilot opened to early-access members before the public rollout.',
      highlights: [
        'Milestone check-ins at 3 / 6 / 12 / 24 months with earned rewards.',
        'Battery health trend, crash-free status, repair log on-chain.',
        'Decay grade (A+ → F) buyers can trust at resale.',
        'QR passport — scan to verify ownership and condition instantly.',
      ],
    },
    bn: {
      title: 'রিসেল পাসপোর্ট — আপনার ডিভাইসের টেম্পার-প্রুফ ইতিহাস',
      lede: 'ব্যাটারি হেলথ, মেরামত ইতিহাস, QR-সাইন করা পাসপোর্ট — রিসেলের সময় ডিভাইসের সাথে যায়। আর্লি অ্যাক্সেসে উন্মুক্ত।',
      highlights: [
        '3/6/12/24 মাসের মাইলস্টোন চেক-ইন এবং পুরস্কার।',
        'ব্যাটারি হেলথ ট্রেন্ড, মেরামত লগ।',
        'A+ → F পর্যন্ত Decay Grade।',
        'QR পাসপোর্ট — স্ক্যান করেই যাচাই।',
      ],
    },
    hi: {
      title: 'रीसेल पासपोर्ट — आपके डिवाइस का छेड़छाड़-रोधी इतिहास',
      lede: 'बैटरी हेल्थ, मरम्मत इतिहास, QR-साइन पासपोर्ट — पुनर्विक्रय के समय डिवाइस के साथ जाता है। अर्ली एक्सेस में।',
      highlights: [
        '3/6/12/24 महीने के माइलस्टोन व पुरस्कार।',
        'बैटरी हेल्थ ट्रेंड और मरम्मत लॉग।',
        'A+ → F डिके ग्रेड।',
        'QR पासपोर्ट — स्कैन करके तुरंत सत्यापन।',
      ],
    },
  },
};

export function EarlyAccessBadge({ children }: { children?: ReactNode }) {
  return (
    <span className="ml-auto flex items-center gap-0.5 rounded-full bg-brand-amber/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-amber">
      <Lock size={9} /> {children ?? 'Beta'}
    </span>
  );
}
