'use client';

import React, { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  children,
  color,
  bg,
  className,
  glow,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  className?: string;
  glow?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold',
        'transition-all duration-200 ease-spring-smooth',
        glow && 'glow-emerald-pulse',
        className,
      )}
      style={{
        color: color ?? 'var(--text-secondary)',
        background: bg ?? 'var(--glass-bg)',
        backdropFilter: 'blur(12px) saturate(160%)',
        border: '1px solid var(--glass-border)',
      }}
    >
      {children}
    </span>
  );
}

export function CredMeter({ value }: { value: number }) {
  const color =
    value >= 80
      ? 'var(--brand-emerald)'
      : value >= 35
        ? 'var(--brand-amber)'
        : 'var(--brand-rose)';
  return (
    <div className="cred-meter" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color, color }} />
    </div>
  );
}

export function Button({
  children,
  variant = 'solid',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'ghost' | 'danger' | 'outline';
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = ref.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
      btn.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    }
    props.onClick?.(e);
  }, [props.onClick]);

  const base =
    'ripple-container press-effect inline-flex items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';

  const variants: Record<string, string> = {
    solid:
      'bg-brand-emerald text-[#04110b] hover:brightness-110 hover:shadow-lg glow-emerald',
    outline:
      'glass border-[var(--glass-border)] text-content-primary hover:bg-bg-elevated/50',
    ghost:
      'text-content-secondary hover:bg-glass-bg hover:text-content-primary',
    danger:
      'bg-brand-rose text-white hover:brightness-110 hover:shadow-lg glow-rose',
  };

  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], className)}
      {...props}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  glass = true,
  glow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  glass?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-card transition-all duration-300 ease-spring-smooth',
        glass
          ? 'glass-card'
          : 'bg-bg-surface section-bordered',
        glow && 'border-glow',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { CustomSelect, type SelectOption } from './CustomSelect';

