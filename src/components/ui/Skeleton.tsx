// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — Skeleton + EmptyState primitives
//  Used in Feed, NewsHub, Product grid, Bounties, Admin panels.
// ════════════════════════════════════════════════════════════════════════

import { type ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  'aria-label'?: string;
}

const roundedMap: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md',
  'aria-label': ariaLabel = 'Loading',
}: SkeletonProps) {
  const style: Record<string, string | number> = {};
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;
  return (
    <div
      className={`vp-skeleton ${roundedMap[rounded]} ${className}`}
      style={style}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    />
  );
}

/** Standard list skeleton — N stacked cards. */
export function SkeletonList({ rows = 3, rowHeight = 96 }: { rows?: number; rowHeight?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={rowHeight} rounded="lg" />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}

/** Friendly empty-state card. Use when a filtered list has no rows. */
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-bg-surface px-6 py-10 text-center">
      {icon && <div className="text-content-tertiary">{icon}</div>}
      <h3 className="text-base font-bold text-content-primary">{title}</h3>
      {body && <p className="max-w-sm text-sm text-content-secondary">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
