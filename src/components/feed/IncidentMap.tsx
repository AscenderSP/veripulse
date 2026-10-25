'use client';

import { useState } from 'react';
import {
  Map,
  MapPin,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Filter,
  Eye,
  Radio,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import type { Story } from '@/lib/types';
import { useLang } from '@/hooks/useLang';

export function IncidentMap({
  stories,
  onSelectStory,
}: {
  stories: Story[];
  onSelectStory?: (story: Story) => void;
}) {
  const { lang } = useLang();
  const [filterStage, setFilterStage] = useState<'all' | 'verified' | 'quarantined'>('all');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // Filter stories with lat/lng or location_name
  const filteredStories = stories.filter((s) => {
    if (filterStage === 'verified' && s.credibility_score < 70) return false;
    if (filterStage === 'quarantined' && s.rollout_stage !== 'quarantined') return false;
    if (selectedLocation && s.location_name !== selectedLocation) return false;
    return true;
  });

  // Group by location
  const locationGroups: Record<string, { stories: Story[]; verifiedCount: number; hoaxCount: number }> = {};
  for (const s of stories) {
    const loc = s.location_name || 'Global';
    if (!locationGroups[loc]) {
      locationGroups[loc] = { stories: [], verifiedCount: 0, hoaxCount: 0 };
    }
    locationGroups[loc].stories.push(s);
    if (s.credibility_score >= 70) locationGroups[loc].verifiedCount += 1;
    if (s.rollout_stage === 'quarantined') locationGroups[loc].hoaxCount += 1;
  }

  const locations = Object.keys(locationGroups);

  return (
    <Card className="p-4 space-y-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-button bg-brand-emerald text-[#04110b]">
            <Map size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-content-primary">Hyperlocal Incident Heatmap</h3>
            <p className="text-[11px] text-content-muted">Real-time GPS clusters of verified events and flagged hazards</p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setFilterStage('all')}
            className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
              filterStage === 'all'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'bg-bg-elevated text-content-muted'
            }`}
          >
            All ({stories.length})
          </button>
          <button
            onClick={() => setFilterStage('verified')}
            className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
              filterStage === 'verified'
                ? 'bg-brand-sky text-white'
                : 'bg-bg-elevated text-content-muted'
            }`}
          >
            Verified
          </button>
          <button
            onClick={() => setFilterStage('quarantined')}
            className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
              filterStage === 'quarantined'
                ? 'bg-brand-rose text-white'
                : 'bg-bg-elevated text-content-muted'
            }`}
          >
            Hoaxes
          </button>
        </div>
      </div>

      {/* Visual Regional Clusters Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {locations.map((loc) => {
          const group = locationGroups[loc];
          const isSelected = selectedLocation === loc;
          const hasHoax = group.hoaxCount > 0;

          return (
            <div
              key={loc}
              onClick={() => setSelectedLocation(isSelected ? null : loc)}
              className={`cursor-pointer rounded-button border p-3 transition-all ${
                isSelected
                  ? 'border-brand-emerald bg-brand-emerald/10 shadow-sm'
                  : 'border-[var(--border-subtle)] bg-bg-surface hover:bg-bg-elevated'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1 text-content-primary truncate">
                  <MapPin size={12} className="text-brand-emerald shrink-0" />
                  <span className="truncate">{loc}</span>
                </span>
                <span className="font-mono text-[11px] text-content-muted">
                  {group.stories.length}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-[10px]">
                <span className="text-brand-emerald flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-emerald" />
                  {group.verifiedCount} Real
                </span>
                {hasHoax && (
                  <span className="text-brand-rose flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-rose" />
                    {group.hoaxCount} Flagged
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Location Incidents List */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between text-xs text-content-muted">
          <span>
            {selectedLocation ? `Incidents in ${selectedLocation}` : 'Active Local Feeds'} ({filteredStories.length})
          </span>
          {selectedLocation && (
            <button
              onClick={() => setSelectedLocation(null)}
              className="text-brand-emerald font-semibold hover:underline"
            >
              Show all areas
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {filteredStories.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelectStory?.(s)}
              className="rounded-button border border-[var(--border-subtle)] bg-bg-surface p-2.5 text-xs hover:border-[var(--border-strong)] cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-content-muted">
                  <MapPin size={11} /> {s.location_name}
                </span>
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    s.credibility_score >= 70
                      ? 'bg-brand-emerald/15 text-brand-emerald'
                      : s.rollout_stage === 'quarantined'
                      ? 'bg-brand-rose/15 text-brand-rose'
                      : 'bg-brand-amber/15 text-brand-amber'
                  }`}
                >
                  {Math.round(s.credibility_score)}% Credibility
                </span>
              </div>
              <div className="font-bold text-content-primary line-clamp-1">{s.titles[lang]}</div>
              <p className="text-[11px] text-content-secondary line-clamp-1">{s.summaries[lang]}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
