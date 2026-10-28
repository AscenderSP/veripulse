'use client';

// ════════════════════════════════════════════════════════════════════════
//  PullToRefreshIndicator — spinner anchored above the hub content that
//  tracks the live pull offset. Wired by AppShell's main ref.
// ════════════════════════════════════════════════════════════════════════

import { Loader2 } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import type { RefObject } from 'react';

interface Props {
  targetRef: RefObject<HTMLElement | null>;
  onRefresh: () => void | Promise<void>;
}

export function PullToRefreshIndicator({ targetRef, onRefresh }: Props) {
  const { pull, refreshing, progress } = usePullToRefresh({ targetRef, onRefresh });
  if (pull <= 0 && !refreshing) return null;
  const rotation = progress * 360;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex justify-center lg:hidden"
      style={{
        transform: `translateY(${pull - 36}px)`,
        transition: refreshing ? 'transform 180ms ease' : undefined,
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-bg-elevated shadow-xl backdrop-blur-xl"
        style={{ opacity: Math.min(1, progress + 0.3) }}
      >
        {refreshing ? (
          <Loader2 size={16} className="animate-spin text-brand-emerald" />
        ) : (
          <div
            className="h-4 w-4 rounded-full border-2 border-brand-emerald border-r-transparent"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        )}
      </div>
    </div>
  );
}
