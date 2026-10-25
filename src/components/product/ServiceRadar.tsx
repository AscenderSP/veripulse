'use client';

import { useState } from 'react';
import {
  Wrench,
  MapPin,
  Clock,
  IndianRupee,
  ShieldCheck,
  Star,
  Building2,
  ThumbsUp,
  Plus,
  CheckCircle2,
  XCircle,
  Filter,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_SERVICE_REVIEWS } from '@/lib/demoData';
import { formatINR } from '@/lib/utils';
import type { ServiceCenterReview } from '@/lib/types';

export function ServiceRadar({
  brand,
  category,
}: {
  brand?: string;
  category?: string;
}) {
  const [reviews, setReviews] = useState<ServiceCenterReview[]>(DEMO_SERVICE_REVIEWS);
  const [selectedBrand, setSelectedBrand] = useState<string>(brand ?? 'all');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [centerName, setCenterName] = useState('');
  const [city, setCity] = useState('Kolkata');
  const [issueType, setIssueType] = useState('Screen replacement');
  const [turnaroundDays, setTurnaroundDays] = useState(2);
  const [costInr, setCostInr] = useState(0);
  const [warrantyHonored, setWarrantyHonored] = useState(true);
  const [rating, setRating] = useState(8);
  const [comment, setComment] = useState('');

  const filtered = reviews.filter((r) => {
    if (selectedBrand !== 'all' && r.brand.toLowerCase() !== selectedBrand.toLowerCase()) {
      return false;
    }
    return true;
  });

  const avgTurnaround = filtered.length
    ? (filtered.reduce((s, r) => s + r.turnaroundDays, 0) / filtered.length).toFixed(1)
    : '—';
  const avgRating = filtered.length
    ? (filtered.reduce((s, r) => s + r.rating, 0) / filtered.length).toFixed(1)
    : '—';
  const warrantyRate = filtered.length
    ? Math.round((filtered.filter((r) => r.warrantyHonored).length / filtered.length) * 100)
    : 100;

  function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!centerName.trim() || !comment.trim()) return;

    const newRev: ServiceCenterReview = {
      id: `sc-${Date.now()}`,
      brand: selectedBrand === 'all' ? 'Realme' : selectedBrand,
      centerName: centerName.trim(),
      city: city.trim(),
      category: category ?? 'mobile',
      reviewerName: 'you_verified',
      isVerifiedOwner: true,
      issueType,
      turnaroundDays,
      costInr,
      warrantyHonored,
      rating,
      comment: comment.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };

    setReviews([newRev, ...reviews]);
    setShowAddForm(false);
    setCenterName('');
    setComment('');
  }

  const brands = ['all', 'Realme', 'Samsung', 'TVS', 'Apple', 'Hyundai'];

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
              After-Sales Reality Check
            </span>
            <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
              Community Audited
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            Service Center Truth Radar
          </h3>
          <p className="text-xs text-content-muted">
            Real wait times, out-of-pocket costs, and warranty honor rates for official service centers in your city.
          </p>
        </div>

        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 text-xs font-bold bg-brand-emerald text-[#04110b]"
        >
          <Plus size={14} /> Report Service Experience
        </Button>
      </div>

      {/* Aggregate Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-[10px] text-content-muted uppercase font-bold">Avg Turnaround</div>
          <div className="mt-1 font-mono text-xl font-black text-brand-sky">{avgTurnaround} Days</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] text-content-muted uppercase font-bold">Warranty Honor Rate</div>
          <div className="mt-1 font-mono text-xl font-black text-brand-emerald">{warrantyRate}%</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] text-content-muted uppercase font-bold">Service Quality</div>
          <div className="mt-1 font-mono text-xl font-black text-brand-amber">★ {avgRating} / 10</div>
        </Card>
      </div>

      {/* Brand Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold text-content-muted mr-1">Brand:</span>
        {brands.map((b) => (
          <button
            key={b}
            onClick={() => setSelectedBrand(b)}
            className={`rounded-pill px-3 py-1 text-xs font-semibold capitalize border ${
              selectedBrand.toLowerCase() === b.toLowerCase()
                ? 'border-brand-emerald bg-brand-emerald/15 text-brand-emerald'
                : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Add Review Form */}
      {showAddForm && (
        <Card className="p-4 border-brand-emerald/40 animate-slide-up">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-emerald mb-3 flex items-center gap-1.5">
            <Wrench size={14} /> Share Your Service Center Experience
          </h4>

          <form onSubmit={handleSubmitReview} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-content-muted font-medium">Service Center Name & Location</label>
                <input
                  type="text"
                  placeholder="e.g. Realme Authorized Service Center, Gariahat"
                  value={centerName}
                  onChange={(e) => setCenterName(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-content-muted font-medium">Issue or Service Type</label>
                <input
                  type="text"
                  placeholder="e.g. Battery replacement, Screen fix, 1st Service"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-content-muted font-medium">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-content-muted font-medium">Turnaround (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={turnaroundDays}
                  onChange={(e) => setTurnaroundDays(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-content-muted font-medium">Total Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={costInr}
                  onChange={(e) => setCostInr(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-content-muted font-medium">Rating (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-content-secondary font-medium">Warranty Honored?</label>
              <button
                type="button"
                onClick={() => setWarrantyHonored(!warrantyHonored)}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  warrantyHonored ? 'bg-brand-emerald text-[#04110b]' : 'bg-brand-rose text-white'
                }`}
              >
                {warrantyHonored ? 'Yes, honored under warranty' : 'No, paid out-of-pocket'}
              </button>
            </div>

            <div>
              <label className="text-content-muted font-medium">Detailed Experience</label>
              <textarea
                rows={2}
                placeholder="How was the staff behavior, transparency in billing, part availability?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-2 text-content-primary focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddForm(false)} className="px-3 py-1 text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1 text-xs">
                Submit Report
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-3">
        {filtered.map((rev) => (
          <Card key={rev.id} className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-content-primary">{rev.centerName}</span>
                  <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)" className="text-[10px]">
                    {rev.brand}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-content-muted">
                  <MapPin size={11} /> {rev.city} {rev.area ? `· ${rev.area}` : ''}
                  <span>·</span>
                  <span>by @{rev.reviewerName}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 font-mono text-xs font-bold text-brand-amber">
                <Star size={13} className="fill-brand-amber" /> {rev.rating.toFixed(1)} / 10
              </div>
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-bg-surface px-2 py-0.5 text-content-secondary font-medium">
                Issue: {rev.issueType}
              </span>

              <span className="flex items-center gap-1 rounded bg-bg-surface px-2 py-0.5 text-content-muted">
                <Clock size={11} /> {rev.turnaroundDays === 0 ? 'Same Day' : `${rev.turnaroundDays} Days`}
              </span>

              <span className="rounded bg-bg-surface px-2 py-0.5 font-mono text-content-primary font-semibold">
                Cost: {rev.costInr === 0 ? 'Free (₹0)' : formatINR(rev.costInr)}
              </span>

              {rev.warrantyHonored ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-emerald">
                  <CheckCircle2 size={12} /> Warranty Honored
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-rose">
                  <XCircle size={12} /> Denied Warranty
                </span>
              )}
            </div>

            <p className="text-xs text-content-secondary leading-relaxed">{rev.comment}</p>
            <div className="text-[10px] text-content-muted">Reported on {rev.createdAt}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
