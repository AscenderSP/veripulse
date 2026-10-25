'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={cn(
        'press-effect inline-flex items-center justify-center rounded-pill glass transition-all duration-300',
        compact ? 'h-8 w-8 p-1.5' : 'gap-1.5 px-2.5 py-1.5 text-xs font-semibold',
      )}
    >
      <span
        className="inline-flex transition-transform duration-500 ease-spring-bounce"
        style={{ transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)' }}
      >
        {isDark ? (
          <Sun size={14} className="text-brand-amber" style={{ filter: 'drop-shadow(0 0 4px var(--brand-amber))' }} />
        ) : (
          <Moon size={14} className="text-brand-sky" style={{ filter: 'drop-shadow(0 0 4px var(--brand-sky))' }} />
        )}
      </span>
      {!compact && (
        <span className="transition-all duration-200">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
}
