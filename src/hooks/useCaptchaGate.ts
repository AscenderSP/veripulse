'use client';

// ════════════════════════════════════════════════════════════════════════
//  useCaptchaGate — ask the user to solve a captcha every N mutating
//  actions. "N" defaults to 4 (per spec: "ask for solving captcha again
//  after submitting 4 of any kind"). A single counter spans account
//  creation / posting reports / consensus votes / news dispatches / bounty
//  posts, so a bot can't bypass the limit by cycling actions.
// ════════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { requestCaptcha, type CaptchaResult } from '@/lib/captchaBus';

const COUNTER_KEY = 'vp_captcha_submits_remaining_v1';
const BATCH_SIZE = 4;

interface GateOptions {
  /** Force a captcha regardless of the counter (e.g. account creation). */
  always?: boolean;
  /** Message shown in the captcha modal (why we're asking). */
  reason?: string;
}

export function useCaptchaGate() {
  const requireHuman = useCallback(
    async ({ always, reason }: GateOptions = {}): Promise<CaptchaResult> => {
      if (!always) {
        try {
          const remaining = Number(localStorage.getItem(COUNTER_KEY) ?? '0');
          if (remaining > 0) {
            localStorage.setItem(COUNTER_KEY, String(remaining - 1));
            return { ok: true };
          }
        } catch {
          /* fall through to challenge */
        }
      }
      const result = await requestCaptcha(reason);
      if (result.ok) {
        try {
          // One solve buys the next BATCH_SIZE submissions.
          localStorage.setItem(COUNTER_KEY, String(BATCH_SIZE - 1));
        } catch {
          /* non-fatal */
        }
      }
      return result;
    },
    [],
  );

  return { requireHuman };
}
