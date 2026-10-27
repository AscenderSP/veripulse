'use client';

import { useState } from 'react';
import {
  Target,
  Flame,
  Award,
  Sparkles,
  IndianRupee,
  Coins,
  TrendingUp,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { BountyQuests } from './BountyQuests';
import { SentinelPool } from './SentinelPool';
import { MilestoneGrants } from './MilestoneGrants';
import { BadgesView } from './BadgesView';
import { OwnershipPassportView } from './OwnershipPassport';
import { useSession } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';
import { formatINR } from '@/lib/utils';

type EarnTab = 'bounties' | 'dividends' | 'grants' | 'passport' | 'badges';

export function EarnHub({ onVerify }: { onVerify?: () => void }) {
  const [tab, setTab] = useState<EarnTab>('bounties');
  const { profile, patchDemoProfile } = useSession();
  const { lang } = useLang();

  function handleClaimSuccess(amount: number) {
    if (profile) {
      patchDemoProfile({
        wallet_balance_inr: (profile.wallet_balance_inr ?? 0) + amount,
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Navigation Tabs for Earning Streams. Sticky to match
          NewsHub / Product Hub. */}
      <div
        className="sticky z-20 -mx-4 flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border-subtle)] bg-bg-primary px-4 py-2 backdrop-blur-md scrollbar-none lg:!top-0"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}
      >
        <button
          onClick={() => setTab('bounties')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            tab === 'bounties'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Target size={15} /> {t('tab_bounties', lang)}
        </button>

        <button
          onClick={() => setTab('dividends')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            tab === 'dividends'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Flame size={15} /> {t('tab_dividends', lang)}
        </button>

        <button
          onClick={() => setTab('grants')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            tab === 'grants'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Sparkles size={15} /> {t('tab_grants', lang)}
        </button>

        <button
          onClick={() => setTab('passport')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            tab === 'passport'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Award size={15} /> {t('tab_passport', lang)}
        </button>

        <button
          onClick={() => setTab('badges')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            tab === 'badges'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Award size={15} /> {t('tab_badges', lang)}
        </button>
      </div>

      {/* Render selected view */}
      {tab === 'bounties' && <BountyQuests onClaimSuccess={handleClaimSuccess} />}
      {tab === 'dividends' && <SentinelPool />}
      {tab === 'grants' && <MilestoneGrants onClaimSuccess={handleClaimSuccess} />}
      {tab === 'passport' && <OwnershipPassportView />}
      {tab === 'badges' && <BadgesView />}
    </div>
  );
}
