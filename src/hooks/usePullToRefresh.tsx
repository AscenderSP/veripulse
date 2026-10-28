'use client';

// ════════════════════════════════════════════════════════════════════════
//  usePullToRefresh — iOS/Android-style pull-to-refresh for scrollable
//  containers. Returns the live pull offset in pixels so the caller can
//  render a progress indicator above its content.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type RefObject } from 'react';

interface Options {
  targetRef: RefObject<HTMLElement | null>;
  onRefresh: () => void | Promise<void>;
  /** Pixels of pull required to fire a refresh. Default 72. */
  threshold?: number;
  /** Soft maximum pull distance for the indicator. Default 120. */
  maxPull?: number;
  enabled?: boolean;
}

export function usePullToRefresh({
  targetRef,
  onRefresh,
  threshold = 72,
  maxPull = 120,
  enabled = true,
}: Options) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const canPull = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const el = targetRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const scroller = targetRef.current;
      if (!scroller) return;
      // Only arm the gesture when already at the top.
      if (scroller.scrollTop > 0) {
        canPull.current = false;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
      canPull.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!canPull.current || startY.current == null || refreshing) return;
      const delta = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      // Rubber-band damping past the threshold.
      const damped = Math.min(maxPull, delta * 0.5);
      setPull(damped);
    }

    async function onTouchEnd() {
      if (!canPull.current) return;
      const current = pullRef.current;
      startY.current = null;
      canPull.current = false;
      if (current >= threshold && !refreshing) {
        setRefreshing(true);
        setPull(threshold);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, targetRef, onRefresh, threshold, maxPull, refreshing]);

  // Keep the latest pull value readable inside the stable touchend handler.
  const pullRef = useRef(0);
  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  return { pull, refreshing, progress: Math.min(1, pull / threshold) };
}
