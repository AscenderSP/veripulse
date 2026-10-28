'use client';

// ════════════════════════════════════════════════════════════════════════
//  useListboxKeys — ArrowUp/Down/Home/End/Esc/Enter for dropdown lists
//  Attach the returned handler to the dropdown container (role="listbox").
//  Each option element must carry data-listbox-option, be focusable
//  (tabIndex={0}), and should call its onSelect from `onClick` + `onKeyDown`
//  on Enter/Space.
// ════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, type KeyboardEvent, type RefObject } from 'react';

interface Options {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function useListboxKeys({ open, containerRef, onClose }: Options) {
  // Focus the first option (or the one marked data-active) on open so the
  // user can navigate without first clicking.
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const options = el.querySelectorAll<HTMLElement>('[data-listbox-option]');
    if (options.length === 0) return;
    const active = Array.from(options).find((o) => o.dataset.active === 'true');
    (active ?? options[0]).focus();
  }, [open, containerRef]);

  const onKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLElement>) => {
      const container = containerRef.current;
      if (!container) return;
      const options = Array.from(
        container.querySelectorAll<HTMLElement>('[data-listbox-option]'),
      );
      if (options.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const idx = active ? options.indexOf(active) : -1;

      if (ev.key === 'Escape') {
        ev.preventDefault();
        onClose();
        return;
      }
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        const next = options[(idx + 1 + options.length) % options.length];
        next?.focus();
        return;
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        const prev = options[(idx - 1 + options.length) % options.length];
        prev?.focus();
        return;
      }
      if (ev.key === 'Home') {
        ev.preventDefault();
        options[0]?.focus();
        return;
      }
      if (ev.key === 'End') {
        ev.preventDefault();
        options[options.length - 1]?.focus();
        return;
      }
      if (ev.key === 'Enter' || ev.key === ' ') {
        if (active?.dataset.listboxOption) {
          ev.preventDefault();
          active.click();
        }
      }
    },
    [containerRef, onClose],
  );

  return { onKeyDown };
}
