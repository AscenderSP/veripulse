// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — global captcha bus
//
//  `CaptchaMount` registers itself as the listener on mount; any call
//  site invokes `requestCaptcha()` and awaits the user's answer. Returns
//  { ok: true, token } on pass (the signed token can be forwarded to the
//  server mutation) or { ok: false } on cancel/fail. If no listener is
//  mounted the request resolves to ok=false immediately.
// ════════════════════════════════════════════════════════════════════════

export interface CaptchaResult {
  ok: boolean;
  token?: string;      // server-signed verification token (opaque)
  answer?: string;     // the typed answer, for server-side revalidation
}

export type CaptchaResolver = (r: CaptchaResult) => void;

type Listener = (req: { resolver: CaptchaResolver; reason?: string }) => void;

let listener: Listener | null = null;

export function setCaptchaListener(fn: Listener | null): void {
  listener = fn;
}

/**
 * Prompt the user to solve a captcha. `reason` can be surfaced in the
 * modal copy (e.g. "to publish this report").
 */
export function requestCaptcha(reason?: string): Promise<CaptchaResult> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve({ ok: false });
      return;
    }
    listener({
      resolver: (r) => resolve(r),
      reason,
    });
  });
}
