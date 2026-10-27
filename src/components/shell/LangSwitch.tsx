'use client';

import { useLang } from '@/hooks/useLang';
import { LANGS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { triggerSelectionHaptic } from '@/lib/nativeHardware';

export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-pill glass p-0.5',
        compact ? 'gap-0' : 'gap-0.5',
      )}
    >
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={async () => {
            if (lang !== l.code) await triggerSelectionHaptic();
            setLang(l.code);
          }}
          aria-pressed={lang === l.code}
          className={cn(
            'press-effect rounded-pill px-2.5 py-1 text-xs font-semibold transition-all duration-300',
            lang === l.code
              ? 'bg-brand-emerald text-[#04110b] shadow-md'
              : 'text-content-secondary hover:text-content-primary',
          )}
          style={lang === l.code ? { boxShadow: '0 2px 8px rgba(52,211,153,0.3)' } : undefined}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
