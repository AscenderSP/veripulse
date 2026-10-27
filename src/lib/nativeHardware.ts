'use client';

/**
 * Unified cross-platform hardware bridge.
 *
 * One API for camera, geolocation, share, and haptics that works in three
 * environments without branching at the call site:
 *   - Native iOS/Android (Capacitor plugins)
 *   - Standard web browsers (Web APIs: getUserMedia/file input, Geolocation,
 *     Web Share, Vibration)
 *
 * Capacitor plugins are imported dynamically so the web/SSR bundle never
 * hard-depends on native code and desktop browsers are never broken.
 */

export interface VerifiedMedia {
  dataUrl: string; // base64 data URL of the captured image
  mime: string;
  lat: number | null;
  lng: number | null;
  capturedAt: string; // ISO
}

function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-expect-error Capacitor global injected on native
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

// ── Camera + location lock ──────────────────────────────────────────────
export async function captureVerifiedMedia(): Promise<VerifiedMedia> {
  const capturedAt = new Date().toISOString();

  if (isNative()) {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const { Geolocation } = await import('@capacitor/geolocation');

    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera, // force live capture — no gallery
    });

    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      /* location denied — media still usable, lower C2PA confidence */
    }

    return {
      dataUrl: photo.dataUrl ?? '',
      mime: `image/${photo.format ?? 'jpeg'}`,
      lat,
      lng,
      capturedAt,
    };
  }

  // ── Web fallback: file input (capture=environment hints the rear camera on
  //    mobile browsers) + Geolocation API. ──
  const file = await pickImageFile();
  const dataUrl = await fileToDataUrl(file);
  const coords = await getWebCoords();
  return {
    dataUrl,
    mime: file.type || 'image/jpeg',
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    capturedAt,
  };
}

function pickImageFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) resolve(f);
      else reject(new Error('No file selected'));
    };
    input.click();
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getWebCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

/** Current position via the native plugin or the browser API; null if denied. */
export async function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  if (isNative()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return null;
    }
  }
  return getWebCoords();
}

// ── Share ───────────────────────────────────────────────────────────────
export async function shareStory(opts: {
  title: string;
  text: string;
  url: string;
}): Promise<void> {
  if (isNative()) {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title: opts.title, text: opts.text, url: opts.url });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(opts);
      return;
    } catch {
      /* user cancelled or unsupported → clipboard */
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(`${opts.title}\n${opts.url}`);
  }
}

// ── Haptics ─────────────────────────────────────────────────────────────
export async function triggerVoteHaptic(): Promise<void> {
  if (isNative()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    } catch {
      /* ignore */
    }
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(18);
  }
}

/** Light tap for incidental UI interactions (nav switches, chips). */
export async function triggerTapHaptic(): Promise<void> {
  if (isNative()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    } catch {
      /* ignore */
    }
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(8);
  }
}

/** Soft selection tick for pill switches, segmented controls. */
export async function triggerSelectionHaptic(): Promise<void> {
  if (isNative()) {
    try {
      const { Haptics } = await import('@capacitor/haptics');
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
      return;
    } catch {
      /* ignore */
    }
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(6);
  }
}

/** Success buzz — call after a confirmed irreversible action. */
export async function triggerSuccessHaptic(): Promise<void> {
  if (isNative()) {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Success });
      return;
    } catch {
      /* ignore */
    }
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([10, 40, 20]);
  }
}

export { isNative };
