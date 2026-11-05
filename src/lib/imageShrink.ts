/**
 * Downscale a data: image URL to a shrunk JPEG so it fits comfortably in
 * localStorage (and in Supabase storage requests). Keeps aspect ratio.
 *
 * - Browser-only (uses Image + canvas). Returns the original URL on
 *   servers, blob errors, or if it's already small enough.
 * - Default limits keep a typical photo under ~150 KB — safe to persist
 *   alongside other demo state inside the 5-10 MB per-origin cap.
 */

export async function shrinkDataUrl(
  dataUrl: string,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<string> {
  const maxEdge = opts.maxEdge ?? 1200;
  const quality = opts.quality ?? 0.72;

  if (typeof window === 'undefined') return dataUrl;
  if (!dataUrl.startsWith('data:image/')) return dataUrl;
  if (dataUrl.length < 200 * 1024) return dataUrl; // already small enough

  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    if (scale >= 1 && dataUrl.length < 400 * 1024) return dataUrl;

    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
