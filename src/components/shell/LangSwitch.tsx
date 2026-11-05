'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { useBackClose } from '@/hooks/useBackClose';
import { LANGS, cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { triggerSelectionHaptic } from '@/lib/nativeHardware';
import type { Lang } from '@/lib/types';

/**
 * Site-wide language picker rendered as a dropdown. One source of truth
 * (`useLang`) feeds every `t(key, lang)` call in the app, so switching
 * here re-renders every chrome string without extra wiring.
 *
 * The listbox is portaled to <body> with position: fixed so it escapes
 * the sidebar's overflow-y-auto clip — otherwise an absolute child gets
 * sliced off by the scroll container.
 */
export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setMounted(true), []);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  // Anchor the portaled listbox below the trigger. Recomputed on every
  // open and on scroll/resize so the menu tracks the button.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      // Left-align the menu to the trigger, but keep it on-screen with
      // an 8px gutter on either side. Menu is ~160px wide.
      const menuW = 180;
      const gutter = 8;
      const maxLeft = window.innerWidth - menuW - gutter;
      const left = Math.max(gutter, Math.min(r.left, maxLeft));
      setAnchor({
        top: r.bottom + 6,
        left,
      });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // Outside-click + Escape close. Back button + mobile edge-swipe close
  // via useBackClose so this picker plays well with native navigation.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useBackClose(open, () => setOpen(false));

  async function pick(next: Lang) {
    if (next !== lang) await triggerSelectionHaptic();
    setLang(next);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language', lang)}
        title={t('language', lang)}
        className={cn(
          'press-effect flex items-center gap-1.5 rounded-pill glass font-semibold text-content-secondary hover:text-content-primary transition-all duration-200',
          compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs',
        )}
      >
        <Globe size={compact ? 12 : 13} className="text-brand-emerald" />
        <span className="max-w-[80px] truncate">{current.label}</span>
        <ChevronDown
          size={compact ? 11 : 12}
          className={cn('opacity-70 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {mounted && open && anchor
        ? createPortal(
            <ul
              ref={listRef}
              role="listbox"
              aria-label={t('language', lang)}
              className="fixed z-[1000] min-w-[160px] overflow-hidden rounded-button glass-heavy shadow-xl animate-fade-in"
              style={{
                top: anchor.top,
                left: anchor.left,
                border: '1px solid var(--glass-border)',
              }}
            >
              {LANGS.map((l) => {
                const selected = l.code === lang;
                return (
                  <li key={l.code} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => pick(l.code)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium transition-colors',
                        selected
                          ? 'bg-brand-emerald/15 text-content-primary'
                          : 'text-content-secondary hover:bg-bg-elevated/60 hover:text-content-primary',
                      )}
                    >
                      <span className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold">{l.label}</span>
                        <span className="text-[10px] uppercase tracking-wide text-content-muted">
                          {l.short}
                        </span>
                      </span>
                      {selected && <Check size={14} className="text-brand-emerald" />}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
