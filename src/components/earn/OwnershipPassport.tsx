'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  Award,
  QrCode,
  Download,
  Share2,
  CheckCircle2,
  TrendingUp,
  Battery,
  Wrench,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_PASSPORTS } from '@/lib/demoData';
import { formatINR } from '@/lib/utils';
import type { OwnershipPassport } from '@/lib/types';

export function OwnershipPassportView() {
  const [passports, setPassports] = useState<OwnershipPassport[]>(DEMO_PASSPORTS);
  const [selectedPassport, setSelectedPassport] = useState<OwnershipPassport>(DEMO_PASSPORTS[0]);
  const [copied, setCopied] = useState(false);

  function handleShare(p: OwnershipPassport) {
    const text = `VeriPulse Certified Ownership Passport for ${p.productName}\nGrade: ${p.decayGrade} (Reliability Certified)\nEstimated Resale Premium: +₹${p.estimatedPremiumInr}\nVerified on: ${p.verifiedAt}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
              Second-Hand Market Advantage
            </span>
            <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
              +15% Higher Resale Price
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            &quot;VeriPulse Certified&quot; Resale Passport
          </h3>
          <p className="text-xs text-content-muted">
            Selling your phone or bike on OLX or Cashify? Generate a tamper-proof digital certificate of ownership, battery health, and service records to avoid lowballers.
          </p>
        </div>
      </div>

      {/* Select Passport Tab */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-content-muted font-semibold shrink-0">Your Devices:</span>
        {passports.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPassport(p)}
            className={`rounded-button px-3 py-1.5 font-bold border shrink-0 transition-all ${
              selectedPassport.id === p.id
                ? 'border-brand-emerald bg-brand-emerald/15 text-brand-emerald'
                : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted'
            }`}
          >
            {p.productName}
          </button>
        ))}
      </div>

      {/* Digital Certificate Card */}
      {selectedPassport && (
        <Card className="relative overflow-hidden border-2 border-brand-emerald/50 p-5 bg-gradient-to-br from-bg-surface to-bg-elevated shadow-xl">
          {/* Watermark / Badge */}
          <div className="absolute right-4 top-4 flex flex-col items-center justify-center rounded-full bg-brand-emerald/10 border-2 border-brand-emerald p-3 text-brand-emerald text-center">
            <ShieldCheck size={28} />
            <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">VERIFIED</span>
          </div>

          <div className="space-y-4 max-w-md">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-emerald">
                Official Ownership & Health Certificate
              </div>
              <h2 className="text-xl font-black text-content-primary mt-0.5">
                {selectedPassport.productName}
              </h2>
              <div className="text-xs text-content-muted">
                Owned by @{selectedPassport.ownerName} · Verified via {selectedPassport.verificationMethod}
              </div>
            </div>

            {/* Premium Highlight */}
            <div className="rounded-button bg-brand-emerald/15 border border-brand-emerald/30 p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-brand-emerald">
                  Certified Resale Premium
                </div>
                <div className="text-xs text-content-muted">Over standard OLX / Cashify cash rate</div>
              </div>
              <div className="font-mono text-xl font-black text-brand-emerald">
                +{formatINR(selectedPassport.estimatedPremiumInr)}
              </div>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-bg-surface p-2.5 border border-[var(--border-subtle)]">
                <div className="text-[10px] text-content-muted">Decay Grade</div>
                <div className="font-mono text-lg font-black text-brand-emerald">
                  Grade {selectedPassport.decayGrade}
                </div>
              </div>

              {selectedPassport.batteryHealth !== undefined && (
                <div className="rounded bg-bg-surface p-2.5 border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-content-muted">Battery Health</div>
                  <div className="font-mono text-lg font-black text-brand-sky">
                    {selectedPassport.batteryHealth}% Tested
                  </div>
                </div>
              )}

              <div className="rounded bg-bg-surface p-2.5 border border-[var(--border-subtle)]">
                <div className="text-[10px] text-content-muted">Accident / Crash Free</div>
                <div className="font-semibold text-content-primary flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={13} className="text-brand-emerald" /> Yes, 100% Clean
                </div>
              </div>

              <div className="rounded bg-bg-surface p-2.5 border border-[var(--border-subtle)]">
                <div className="text-[10px] text-content-muted">Milestone Check-Ins</div>
                <div className="font-semibold text-content-primary mt-0.5">
                  {selectedPassport.totalCheckIns} Verified Logs
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[11px] text-content-muted">
              <span>Certificate ID: VP-CERT-{selectedPassport.id.toUpperCase()}</span>
              <span>Issued on {selectedPassport.verifiedAt}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex items-center gap-2">
            <Button
              onClick={() => handleShare(selectedPassport)}
              className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Share2 size={13} /> {copied ? 'Certificate Link Copied!' : 'Share Certificate with Buyer'}
            </Button>
            <Button
              variant="outline"
              onClick={() => alert('Passport PDF downloaded to your files.')}
              className="px-3 py-1.5 text-xs text-content-primary"
            >
              <Download size={13} /> Download PDF
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
