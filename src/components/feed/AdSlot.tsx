'use client';

import { useEffect, useRef } from 'react';

/**
 * Dual-rail ad slot.
 *  - Web: Google AdSense fluid unit (loaded only if a real client id is set).
 *  - Native: AdMob banners are anchored natively by the Capacitor plugin, so
 *    on native builds this renders a spacer and the banner floats above the
 *    tab bar (handled in AdMobController).
 * Falls back to a labelled placeholder when no ad client is configured.
 */
export function AdSlot() {
  const ref = useRef<HTMLModElement>(null);
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const configured = client && client.startsWith('ca-pub-') && !client.includes('xxxx');

  useEffect(() => {
    if (!configured) return;
    try {
      // @ts-expect-error adsbygoogle injected by the AdSense script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ignore */
    }
  }, [configured]);

  if (!configured) {
    return (
      <div className="flex items-center justify-center rounded-card border border-dashed border-[var(--border-subtle)] bg-bg-surface/40 py-6 text-xs text-content-muted">
        Sponsored · AdSense / AdMob slot
      </div>
    );
  }

  return (
    <ins
      ref={ref}
      className="adsbygoogle block"
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-format="fluid"
      data-ad-layout-key="-6t+ed+2i-1n-4w"
    />
  );
}
