'use client';

// ════════════════════════════════════════════════════════════════════════
//  useBackClose — tie an overlay / drill-down's "open" state to the
//  browser back button + mobile edge-swipe gesture.
//
//  How it works:
//    · When `open` goes false → true we push a sentinel history entry.
//    · On popstate (back button or iOS/Android swipe-back) we call
//      `onClose()` and mark that we consumed the entry.
//    · When the overlay closes any other way (user clicks "X", submits,
//      ESC, etc.) the cleanup runs — if we did NOT consume via popstate
//      we rewind one history step so the extra entry doesn't accumulate.
//
//  This lets every drill-down participate in native back navigation
//  without a router rewrite: open the overlay, user swipes back, overlay
//  closes, user stays on the same section.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';

const SENTINEL = 'vp_overlay';

export function useBackClose(open: boolean, onClose: () => void, enabled = true): void {
  const consumedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled || !open) return;
    if (typeof window === 'undefined') return;

    consumedRef.current = false;

    // Push a sentinel entry so a back navigation lands here instead of
    // leaving the app. We stamp a unique marker so unrelated popstates
    // (e.g. a sibling overlay) don't close us by mistake.
    const stamp = Date.now() + Math.random();
    try {
      window.history.pushState({ [SENTINEL]: stamp }, '');
    } catch {
      /* history API unavailable (sandboxed iframe); back-close falls back
         to the overlay's own close button */
      return;
    }

    function handler() {
      consumedRef.current = true;
      onCloseRef.current();
    }
    window.addEventListener('popstate', handler);

    return () => {
      window.removeEventListener('popstate', handler);
      // Overlay was closed through a non-back path. Pop the entry we
      // pushed so the next "real" back doesn't just re-close something
      // that's already gone.
      if (!consumedRef.current) {
        try {
          window.history.back();
        } catch {
          /* nothing to do */
        }
      }
    };
  }, [open, enabled]);
}
