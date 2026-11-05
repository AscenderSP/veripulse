'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, Loader2, Send, ShieldCheck } from 'lucide-react';
import { Card, Button } from '@/components/ui/primitives';
import { captureVerifiedMedia, type VerifiedMedia } from '@/lib/nativeHardware';
import { isSupabaseConfigured } from '@/lib/demoData';
import { apiFetch } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSession, useRequireAuth } from '@/hooks/useSession';
import { useCaptchaGate } from '@/hooks/useCaptchaGate';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';
import { addDemoStory } from '@/lib/demoStoryStore';
import { shrinkDataUrl } from '@/lib/imageShrink';
import { recordActivity } from '@/lib/demoActivityStore';

// Server returns these error codes with a `message` field; fall back to this
// table when the server didn't supply one so the user sees something useful.
const SERVER_ERROR_FALLBACK: Record<string, string> = {
  AUTH_REQUIRED: 'Sign in to publish a report.',
  CAPTCHA_REQUIRED: 'Captcha check failed — please try again.',
  CAPTCHA_REPLAYED: 'Captcha already used — refresh and retry.',
  REPORT_TOO_SHORT: 'Your report is too short. Add more detail (20+ characters).',
  DAILY_LIMIT_REACHED: 'You’ve hit today’s posting limit. Try again in 24h.',
  POST_FORBIDDEN: 'Your account tier can’t publish reports right now.',
  JOURNALIST_PENDING_LIMIT_REACHED: 'Pending journalists post at the Citizen rate — limit reached.',
  SUBSCRIPTION_EXPIRED: 'Your Pro subscription has lapsed. Dropped to the free limit for now.',
  INGEST_FAILED: 'We couldn’t save your report. Please retry.',
  SERVER_ERROR: 'Server error — try again in a moment.',
};

/** Uploads the captured image to evidence/{uid}/… and returns its public URL. */
async function uploadEvidence(uid: string, media: VerifiedMedia): Promise<string> {
  if (!media.dataUrl) throw new Error('No image data to upload.');
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
  const { user, profile } = useSession();
  const { lang } = useLang();
  const requireAuth = useRequireAuth();
  const { requireHuman } = useCaptchaGate();
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
      if (!m.dataUrl) {
        setMsg('No image captured.');
        return;
      }
      // Phone photos are 5-10 MB raw; the full data URL blows through
      // localStorage quota when the dummy path persists the story. Shrink
      // to ~150 KB so demoStoryStore.writeList can commit without the
      // catch-and-drop that would silently lose the whole post.
      const shrunk = await shrinkDataUrl(m.dataUrl);
      setMedia({ ...m, dataUrl: shrunk });
      setMsg(m.lat ? 'Photo captured with location lock.' : 'Photo captured — location unavailable.');
    } catch {
      setMsg('Capture cancelled.');
    }
  }

  useEffect(() => {
    // Only auto-opens when a caller explicitly passes `autoCapture`. The
    // default landing path through the Compose tab does NOT pass it, so the
    // camera no longer fires unprompted every time the panel mounts.
    if (autoCapture && !autoFired.current) {
      autoFired.current = true;
      capture();
    }
  }, [autoCapture]);

  async function submit() {
    // Mirror the server's REPORT_TOO_SHORT check (20+ characters) so a reader
    // never gets a surprising rejection after the client said OK.
    if (text.trim().length < 20) {
      setMsg('Add more detail before posting (at least 20 characters).');
      return;
    }
    // Make the auth gate loud: if no one is signed in (not even a preset
    // dummy), say so instead of silently opening the sheet.
    if (!profile) {
      setMsg('Please sign in to publish your report.');
      requireAuth(() => undefined); // opens the sign-in sheet
      return;
    }
    const captcha = await requireHuman({ reason: 'Confirm you are human to publish this report.' });
    if (!captcha.ok) {
      setMsg('Captcha not completed.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      // Dummy / preset-dummy profiles have no Supabase JWT, so the
      // /api/stories/submit route would reject with AUTH_REQUIRED. Save
      // the post locally through the shared demoStoryStore instead so the
      // card lands on Live Circle and persists across refresh.
      if (!isSupabaseConfigured() || !user) {
        const stored = addDemoStory({
          authorId: profile.id,
          text,
          locationName: place.trim() || (media?.lat ? 'Pinned location' : 'Unknown'),
          lat: media?.lat ?? null,
          lng: media?.lng ?? null,
          mediaUrl: media?.dataUrl ?? null,
        });
        recordActivity({
          profileId: profile.id,
          type: 'post',
          targetId: stored.id,
          targetLabel: stored.titles.en,
          meta: {
            location: stored.location_name,
            hasPhoto: !!stored.media_url,
          },
        });
        setMsg('Published to Live Circle (local preview — a real session persists to the Sentinel ring).');
      } else {
        let mediaUrl: string | null = null;
        try {
          mediaUrl = media && user ? await uploadEvidence(user.id, media) : null;
        } catch (uploadErr) {
          const detail = uploadErr instanceof Error ? uploadErr.message : 'upload failed';
          setMsg(`Image upload failed: ${detail}. You can retry, or post without the photo.`);
          setBusy(false);
          return;
        }
        const res = await apiFetch('/api/stories/submit', {
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
            captcha_token: captcha.token,
          }),
        });
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (!res.ok) {
          const code = typeof data.error === 'string' ? data.error : '';
          const fallback = SERVER_ERROR_FALLBACK[code] ?? `Couldn’t publish (${code || res.status}).`;
          throw new Error((data.message as string) || fallback);
        }
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
            : (lang === 'bn'
                ? 'ছবি যোগ করুন (ঐচ্ছিক)'
                : lang === 'hi'
                  ? 'फोटो जोड़ें (वैकल्पिक)'
                  : 'Add photo (optional)')}
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
