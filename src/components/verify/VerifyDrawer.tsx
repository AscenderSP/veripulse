'use client';

import { useState } from 'react';
import { X, ScanLine, Loader2, CheckCircle2, AlertTriangle, FileCheck2, Car } from 'lucide-react';
import { Button, Badge } from '@/components/ui/primitives';
import { captureVerifiedMedia } from '@/lib/nativeHardware';
import { isSupabaseConfigured } from '@/lib/demoData';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';

type Step = 'idle' | 'scanning' | 'ocr' | 'vahan' | 'done' | 'error';

/**
 * AI OCR Verification Drawer (§4.3 / §3.2). Captures an RC or GST invoice,
 * streams through a live extraction animation, then calls
 * /api/verify/rc-invoice. On success it reports the unlocked perks.
 */
export function VerifyDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useLang();
  const [step, setStep] = useState<Step>('idle');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { demo, user, setAuthOpen, refreshProfile } = useSession();

  async function run() {
    if (!demo && !user) {
      onClose();
      setAuthOpen(true);
      return;
    }
    setError(null);
    setResult(null);
    try {
      setStep('scanning');
      const media = await captureVerifiedMedia();

      setStep('ocr');
      if (!isSupabaseConfigured()) {
        await delay(1200);
        setStep('vahan');
        await delay(1100);
        setStep('done');
        setResult('Demo: RC recognised · tamper check passed · Verified Owner badge unlocked.');
        return;
      }

      const res = await apiFetch('/api/verify/rc-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: media.dataUrl, mime: media.mime }),
      });
      setStep('vahan');
      const data = await res.json();
      if (!res.ok) {
        setStep('error');
        setError(mapError(data.error) + (data.tamper_notes ? ` (${data.tamper_notes})` : ''));
        return;
      }
      await refreshProfile();
      setStep('done');
      setResult(
        `${data.verification.brand_model} · ${data.verification.masked_identifier} · badge unlocked, 3× vote weight.`,
      );
    } catch (e) {
      setStep('error');
      setError(e instanceof Error ? e.message : 'Capture failed');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <div className="sheet-overlay absolute inset-0" onClick={onClose} />
      <div className="safe-bottom-sheet relative z-10 w-full max-w-md">
        <div className="modal-content p-5">
          <div className="sheet-handle sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-content-primary">
            <ScanLine size={16} className="text-brand-emerald" style={{ filter: 'drop-shadow(0 0 4px var(--brand-emerald))' }} /> {t('verifyOwnership', lang)}
          </h2>
          <button onClick={onClose} className="press-effect flex h-7 w-7 items-center justify-center rounded-full glass text-content-muted hover:text-content-primary">
            <X size={14} />
          </button>
        </div>

        <p className="mb-4 text-xs text-content-secondary">
          {lang === 'bn'
            ? 'আপনার গাড়ির আরসি বা একটি জিএসটি ট্যাক্স চালান স্ক্যান করুন। আমরা ফরেনসিক ওসিআর চালাই এবং পরিবহন রেজিস্ট্রির সাথে যাচাই করি। আপনার আইডি এনক্রিপ্ট থাকে।'
            : lang === 'hi'
              ? 'अपना वाहन आरसी या जीएसटी टैक्स चालान स्कैन करें। हम फोरेंसिक ओसीआर चलाते हैं और परिवहन रजिस्ट्री से मिलान करते हैं। आपकी आईडी सुरक्षित रहती है।'
              : 'Scan your vehicle RC or a GST tax invoice. We run forensic OCR and, for vehicles, cross-check the Parivahan registry. Your ID is hashed and masked — the raw number is never stored.'}
        </p>

        {/* step rail */}
        <div className="mb-4 space-y-2">
          <StepRow icon={<ScanLine size={15} />} label={lang === 'bn' ? 'নথি ক্যাপচার করুন' : lang === 'hi' ? 'दस्तावेज़ कैप्चर करें' : 'Capture document'} active={step === 'scanning'} done={passed(step, 'scanning')} />
          <StepRow icon={<FileCheck2 size={15} />} label={lang === 'bn' ? 'ওসিআর ও সত্যতা যাচাই' : lang === 'hi' ? 'ओसीआर और फॉरेंसिक जांच' : 'OCR + tamper forensics'} active={step === 'ocr'} done={passed(step, 'ocr')} />
          <StepRow icon={<Car size={15} />} label={lang === 'bn' ? 'পরিবহন / চালান যাচাই' : lang === 'hi' ? 'परिवहन / चालान जांच' : 'Parivahan / invoice check'} active={step === 'vahan'} done={passed(step, 'vahan')} />
        </div>

        {step === 'done' && result && (
          <div className="mb-4 flex items-start gap-2 rounded-button bg-[var(--brand-emerald-glow)] p-3 text-xs text-content-primary">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-emerald" />
            <div>
              <div className="mb-1 font-semibold">{lang === 'bn' ? 'যাচাই সম্পন্ন' : lang === 'hi' ? 'सत्यापन संपन्न' : 'Verified'}</div>
              {result}
              <div className="mt-2 flex gap-1.5">
                <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">{t('verifiedOwners', lang)}</Badge>
                <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">3× weight</Badge>
                <Badge color="var(--brand-amber)" bg="rgba(245,158,11,0.12)">20% pool</Badge>
              </div>
            </div>
          </div>
        )}

        {step === 'error' && error && (
          <div className="mb-4 flex items-start gap-2 rounded-button bg-[rgba(244,63,94,0.12)] p-3 text-xs text-content-primary">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-brand-rose" />
            {error}
          </div>
        )}

        <Button
          onClick={run}
          disabled={step === 'scanning' || step === 'ocr' || step === 'vahan'}
          className="w-full"
        >
          {step === 'scanning' || step === 'ocr' || step === 'vahan' ? (
            <>
              <Loader2 size={15} className="animate-spin" /> {lang === 'bn' ? 'যাচাই করা হচ্ছে…' : lang === 'hi' ? 'सत्यापित हो रहा है…' : 'Verifying…'}
            </>
          ) : step === 'done' ? (
            (lang === 'bn' ? 'অন্য একটি স্ক্যান করুন' : lang === 'hi' ? 'दूसरा स्कैन करें' : 'Scan another')
          ) : (
            (lang === 'bn' ? 'স্ক্যান শুরু করুন' : lang === 'hi' ? 'स्कैन शुरू करें' : 'Start scan')
          )}
        </Button>
        </div>
      </div>
    </div>
  );
}

function StepRow({ icon, label, active, done }: { icon: React.ReactNode; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors"
        style={{
          borderColor: done ? 'var(--brand-emerald)' : active ? 'var(--brand-sky)' : 'var(--border-strong)',
          color: done ? 'var(--brand-emerald)' : active ? 'var(--brand-sky)' : 'var(--text-muted)',
        }}
      >
        {done ? <CheckCircle2 size={15} /> : active ? <Loader2 size={14} className="animate-spin" /> : icon}
      </span>
      <span className={done || active ? 'text-content-primary' : 'text-content-muted'}>{label}</span>
    </div>
  );
}

const ORDER: Step[] = ['scanning', 'ocr', 'vahan', 'done'];
function passed(current: Step, target: Step): boolean {
  if (current === 'done') return target !== 'done';
  return ORDER.indexOf(current) > ORDER.indexOf(target);
}
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function mapError(code: string): string {
  const m: Record<string, string> = {
    TAMPER_DETECTED: 'This document appears edited. Submit an unaltered original.',
    DUPLICATE_ASSET: 'This asset is already registered to another account.',
    VAHAN_MISMATCH: 'The RC could not be confirmed as active on Parivahan.',
    OCR_INCOMPLETE: 'Could not read all fields — retake in better light.',
    NO_IMAGE: 'No image captured.',
    IMAGE_TOO_LARGE: 'Image is over 8 MB — retake at a lower resolution.',
  };
  return m[code] ?? `Verification failed (${code}).`;
}
