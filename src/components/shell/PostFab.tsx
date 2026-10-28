'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X, PenSquare, Radio, Newspaper, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerTapHaptic } from '@/lib/nativeHardware';
import { useBackClose } from '@/hooks/useBackClose';

export const DISPATCH_SIGNAL_KEY = 'veripulse_open_news_dispatch_v1';

type FabAction = 'post_report' | 'dispatch_news' | 'post_bounty';

export const BOUNTY_SIGNAL_KEY = 'veripulse_open_bounty_composer_v1';

interface PostFabProps {
  onAction: (action: FabAction) => void;
  /**
   * External trigger — when consumers (e.g. the mobile bottom-nav +)
   * flip this to true the menu opens. Reset to false by the fab.
   */
  openSignal?: boolean;
  onConsumeSignal?: () => void;
}

/**
 * Floating + button, static overlay in both mobile and desktop. On tap it
 * opens a radial-ish menu with the two post actions:
 *   1. Post Citizen Report → compose
 *   2. File News Dispatch  → news hub with the dispatch panel open
 *
 * Mobile places the fab just above the bottom nav; desktop places it in
 * the bottom-right corner. Visible on every section.
 */
export function PostFab({ onAction, openSignal, onConsumeSignal }: PostFabProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useBackClose(open, () => setOpen(false));

  // External open signal (used by the mobile nav + button).
  useEffect(() => {
    if (openSignal) {
      setOpen(true);
      onConsumeSignal?.();
    }
  }, [openSignal, onConsumeSignal]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function toggle() {
    await triggerTapHaptic();
    setOpen((o) => !o);
  }

  async function pick(action: FabAction) {
    await triggerTapHaptic();
    setOpen(false);
    onAction(action);
  }

  return (
    <div
      ref={containerRef}
      className="post-fab-anchor fixed right-4 z-50 flex flex-col items-end gap-2"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 96px)',
      }}
    >
      {/* Desktop placement.
          On lg (≥1024px, right rail not yet shown) we sit in the
          bottom-right of the viewport. On xl (≥1280px) the right rail
          renders at w-340 inside a max-w-[1400px] centred layout, so
          we anchor at the GAP between the main column and the right
          rail — regardless of how wide the viewport is. The formula:
            right = max((100vw - 1400px) / 2, 0px) + 372px
          (340 rail + 12 margin + 20 breathing room). */}
      <style jsx>{`
        @media (min-width: 1024px) {
          .post-fab-anchor {
            bottom: 1.5rem !important;
          }
        }
        @media (min-width: 1280px) {
          .post-fab-anchor {
            right: calc(max((100vw - 1400px) / 2, 0px) + 372px) !important;
          }
        }
      `}</style>

      {open && (
        <div
          role="menu"
          aria-label="Post actions"
          className="animate-fade-in flex min-w-[14rem] flex-col gap-1 rounded-card border border-[var(--border-strong)] bg-bg-elevated p-1.5 shadow-xl"
        >
          <MenuItem
            icon={PenSquare}
            iconClass="text-brand-emerald"
            label="Post Citizen Report"
            sub="Text / photo from the field"
            onClick={() => pick('post_report')}
          />
          <MenuItem
            icon={Newspaper}
            iconClass="text-brand-sky"
            label="File News Dispatch"
            sub="Press-grade wire with dedup check"
            onClick={() => pick('dispatch_news')}
          />
          <MenuItem
            icon={Target}
            iconClass="text-brand-amber"
            label="Post a Bounty"
            sub="Open escrow for crowdsourced verification"
            onClick={() => pick('post_bounty')}
          />
        </div>
      )}

      <button
        onClick={toggle}
        aria-label={open ? 'Close post menu' : 'Open post menu'}
        aria-expanded={open}
        className={cn(
          'press-effect flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-transform duration-200',
          open
            ? 'bg-brand-rose rotate-45 text-white'
            : 'bg-brand-emerald text-[#04110b] post-glow',
        )}
      >
        {open ? <X size={22} strokeWidth={2.5} /> : <Plus size={24} strokeWidth={2.5} />}
      </button>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  iconClass,
  label,
  sub,
  onClick,
}: {
  icon: React.ElementType;
  iconClass: string;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className="press-effect flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-left transition hover:bg-bg-primary"
    >
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-bg-primary', iconClass)}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-content-primary">{label}</div>
        <div className="text-[11px] text-content-muted">{sub}</div>
      </div>
      <Radio size={12} className="text-content-muted" />
    </button>
  );
}
