'use client';

import { useState } from 'react';
import { Globe2, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentCoords } from '@/lib/nativeHardware';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';

export interface Area {
  scope: 'global' | 'hyperlocal';
  lat: number | null;
  lng: number | null;
}

export const GLOBAL_AREA: Area = { scope: 'global', lat: null, lng: null };

/**
 * Global ↔ Hyperlocal (10 km) switch. Going hyperlocal takes a location fix
 * and, when signed in, stores it as the profile's home point — that's what
 * the consensus engine uses for the 1.5× geo multiplier.
 */
export function AreaSwitcher({
  area,
  onChange,
  compact = false,
}: {
  area: Area;
  onChange: (a: Area) => void;
  compact?: boolean;
}) {
  const { demo, user, refreshProfile } = useSession();
  const { lang } = useLang();
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  async function goHyperlocal() {
    setLocating(true);
    setDenied(false);
    const c = await getCurrentCoords();
    setLocating(false);
    if (!c) {
      setDenied(true);
      return;
    }
    onChange({ scope: 'hyperlocal', lat: c.lat, lng: c.lng });
    if (!demo && user) {
      await getSupabaseBrowserClient()
        .from('profiles')
        .update({ home_lat: c.lat, home_lng: c.lng })
        .eq('id', user.id);
      refreshProfile();
    }
  }

  const local = area.scope === 'hyperlocal';

  if (compact) {
    return (
      <button
        onClick={() => (local ? onChange(GLOBAL_AREA) : goHyperlocal())}
        aria-label={local ? t('area_global', lang) : t('area_hyperlocal', lang)}
        className="flex items-center gap-1 rounded-pill border border-[var(--border-subtle)] bg-bg-elevated px-2.5 py-1 text-xs font-semibold text-content-secondary"
      >
        {locating ? <Loader2 size={13} className="animate-spin" /> : local ? <MapPin size={13} className="text-brand-emerald" /> : <Globe2 size={13} className="text-brand-sky" />}
        {local ? '10 km' : t('area_global', lang)}
      </button>
    );
  }

  return (
    <div className="mt-5 rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-1">
      <div className="grid grid-cols-2 gap-1">
        <Seg active={!local} onClick={() => onChange(GLOBAL_AREA)} icon={<Globe2 size={14} />} label={t('area_global', lang)} />
        <Seg
          active={local}
          onClick={goHyperlocal}
          icon={locating ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          label={t('area_hyperlocal', lang)}
        />
      </div>
      <div className="px-2 pb-1 pt-1.5 text-[10px] text-content-muted">
        {denied
          ? t('location_denied', lang)
          : local
            ? `${t('area_within_10km', lang)} (${area.lat!.toFixed(3)}, ${area.lng!.toFixed(3)})`
            : t('area_all_regions', lang)}
      </div>
    </div>
  );
}

function Seg({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-[9px] py-1.5 text-xs font-semibold transition-colors',
        active ? 'bg-bg-surface text-content-primary' : 'text-content-muted hover:text-content-secondary',
      )}
    >
      <span className={active ? 'text-brand-emerald' : undefined}>{icon}</span>
      {label}
    </button>
  );
}
