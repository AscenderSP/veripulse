'use client';

import { useState } from 'react';
import {
  Sparkles,
  IndianRupee,
  Calendar,
  Camera,
  CheckCircle2,
  FileCheck2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_MILESTONE_GRANTS } from '@/lib/demoData';
import { formatINR } from '@/lib/utils';
import type { MilestoneGrant } from '@/lib/types';

export function MilestoneGrants({ onClaimSuccess }: { onClaimSuccess?: (amt: number) => void }) {
  const [grants, setGrants] = useState<MilestoneGrant[]>(DEMO_MILESTONE_GRANTS);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  function handleClaim(grantId: string) {
    const grant = grants.find((g) => g.id === grantId);
    if (!grant) return;

    setGrants((prev) =>
      prev.map((g) => (g.id === grantId ? { ...g, status: 'claimed' } : g)),
    );
    onClaimSuccess?.(grant.rewardInr);
    alert(`Milestone Grant of ₹${grant.rewardInr} credited to your VeriPulse wallet!`);
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
              Passive Data Rewards
            </span>
            <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
              Funded by Affiliate Pool
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            Long-Term Telemetry Milestone Grants
          </h3>
          <p className="text-xs text-content-muted">
            Upload simple proofs (battery health screenshot at 6 months, 1st service bill, 1-year review) to unlock guaranteed UPI grants.
          </p>
        </div>
      </div>

      {/* Grants Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {grants.map((g) => {
          const isClaimed = g.status === 'claimed';

          return (
            <Card
              key={g.id}
              className={`p-4 flex flex-col justify-between space-y-3 ${
                isClaimed ? 'border-brand-emerald/40 bg-brand-emerald/5' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
                    ₹{g.rewardInr} Grant
                  </Badge>
                  <span className="font-mono text-xs text-content-muted capitalize">
                    {g.milestone}
                  </span>
                </div>

                <h4 className="mt-2 text-sm font-bold text-content-primary">
                  {g.productName}
                </h4>

                <div className="mt-2 rounded bg-bg-surface p-2 text-xs text-content-secondary space-y-1">
                  <div className="text-[11px] font-semibold text-content-muted">Proof Requirement:</div>
                  <div className="text-content-primary flex items-center gap-1.5 capitalize">
                    {g.requiresUpload.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs">
                <span className="text-content-muted text-[11px]">Expires {g.expiresAt}</span>
                {isClaimed ? (
                  <span className="font-bold text-brand-emerald flex items-center gap-1 text-xs">
                    <CheckCircle2 size={13} /> Grant Claimed
                  </span>
                ) : (
                  <Button
                    onClick={() => handleClaim(g.id)}
                    className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1 text-xs"
                  >
                    Upload Proof (+₹{g.rewardInr})
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
