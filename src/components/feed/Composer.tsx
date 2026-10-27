'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, Loader2, Send, ShieldCheck } from 'lucide-react';
import { Card, Button } from '@/components/ui/primitives';
import { captureVerifiedMedia, type VerifiedMedia } from '@/lib/nativeHardware';
import { isSupabaseConfigured } from '@/lib/demoData';
import { apiFetch } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSession, useRequireAuth } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';

/** Uploads the captured image to evidence/{uid}/… and returns its public URL. */
async function uploadEvidence(uid: string, media: VerifiedMedia): Promise<string> {
  const blob = await (await fetch(media.dataUrl)).blob();
  const ext = media.mime.split('/')[1] || 'jpg';
  const path = `${uid}/${Date.now()}.${ext}`;
  const sb = getSupabaseBrowserClient();
  const { error } = await sb.storage.from('evidence').upload(path, blob, { contentType: media.mime });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return sb.storage.from('evidence').getPublicUrl(path).data.publicUrl;
}

export function Composer({
  onSubmitted,
  autoCapture = false,
}: {
  onSubmitted?: () => void;
  autoCapture?: boolean;
}) {
  const { user } = useSession();
  const { lang } = useLang();
  const requireAuth = useRequireAuth();
  const [text, setText] = useState('');
  const [place, setPlace] = useState('');
  const [media, setMedia] = useState<VerifiedMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const autoFired = useRef(false);

  // live completeness hint — a cheap local proxy; server recomputes via Gemini
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const completeness = Math.min(
    100,
    Math.round((words / 45) * 70) + (media ? 15 : 0) + (media?.lat ? 10 : 0) + (place ? 5 : 0),
  );

  async function capture() {
    try {
      const m = await captureVerifiedMedia();
      setMedia(m);
      setMsg(m.lat ? 'Photo captured with location lock.' : 'Photo captured — location unavailable.');
    } catch {
      setMsg('Capture cancelled.');
    }
  }

  useEffect(() => {
    if (autoCapture && !autoFired.current) {
      autoFired.current = true;
      capture();
    }
  }, [autoCapture]);

  async function submit() {
    if (words < 5) {
      setMsg('Add a bit more detail before posting.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (!isSupabaseConfigured()) {
        await new Promise((r) => setTimeout(r, 900));
        setMsg('Demo mode — connect Supabase to publish. Report looks good!');
      } else {
        const res = await requireAuth(async () => {
          const mediaUrl = media && user ? await uploadEvidence(user.id, media) : null;
          return apiFetch('/api/stories/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              location_name: place.trim() || (media?.lat ? 'Pinned location' : 'Unknown'),
              lat: media?.lat ?? null,
              lng: media?.lng ?? null,
              media_url: mediaUrl,
              media_type: 'image',
              captured_at: media?.capturedAt ?? null,
            }),
          });
        });
        if (!res) return;
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed');
        setMsg(
          data.action === 'merged_timeline'
            ? 'Merged into an existing story as a timeline update.'
            : 'Published to the Sentinel canary ring.',
        );
      }
      setText('');
      setPlace('');
      setMedia(null);
      onSubmitted?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-content-primary">
        <ShieldCheck size={16} className="text-brand-emerald" /> {lang === 'bn' ? 'নাগরিক ডেস্ক' : lang === 'hi' ? 'नागरिक डेस्क' : 'Citizen Desk'}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('composerPlaceholder', lang)}
        rows={3}
        className="w-full resize-none rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2.5 text-sm text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
      />
      <input
        value={place}
        onChange={(e) => setPlace(e.target.value)}
        placeholder={lang === 'bn' ? 'কোথায়? (উদাঃ সল্টলেক সেক্টর ৫)' : lang === 'hi' ? 'कहाँ? (उदा. साल्ट लेक सेक्टर 5)' : 'Where? (e.g. Salt Lake Sector V)'}
        className="mt-2 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
      />

      {/* media + completeness */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          onClick={capture}
          className="flex shrink-0 items-center gap-2 rounded-button border border-dashed border-[var(--border-strong)] px-3 py-2 text-xs font-medium text-content-secondary hover:text-content-primary"
        >
          <Camera size={15} />
          {media
            ? (lang === 'bn' ? 'ছবি পরিবর্তন' : lang === 'hi' ? 'फोटो बदलें' : 'Replace photo')
            : (lang === 'bn' ? 'যাচাইকৃত ছবি তুলুন' : lang === 'hi' ? 'सत्यापित फोटो लें' : 'Capture verified photo')}
          {media?.lat && <MapPin size={13} className="text-brand-emerald" />}
        </button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-[11px] text-content-muted">
            <span>{t('completeness', lang)}</span>
            <span className="font-mono">{completeness}%</span>
          </div>
          <div className="cred-meter">
            <span
              style={{
                width: `${completeness}%`,
                background: completeness >= 70 ? 'var(--brand-emerald)' : 'var(--brand-amber)',
              }}
            />
          </div>
        </div>
      </div>

      {media && (
        <img src={media.dataUrl} alt="Captured evidence" className="mt-3 max-h-40 w-full rounded-button object-cover" />
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-content-muted">{msg}</span>
        <Button onClick={submit} disabled={busy} className="shrink-0">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {t('postUpdate', lang)}
        </Button>
      </div>
    </Card>
  );
}
