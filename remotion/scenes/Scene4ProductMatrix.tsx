import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { AnimatedCursor } from '../components/AnimatedCursor';

export const Scene4ProductMatrix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 10, mass: 0.5 } });

  // Cursor moves to click "Best Camera under ₹20k", then opens Product Detail Modal
  const cursorX = interpolate(frame, [0, 50, 110, 170, 230], [200, 360, 360, 520, 520], { extrapolateRight: 'clamp' });
  const cursorY = interpolate(frame, [0, 50, 110, 170, 230], [200, 80, 80, 380, 380], { extrapolateRight: 'clamp' });
  const isClicking = (frame >= 45 && frame <= 60) || (frame >= 165 && frame <= 180);

  // Modal pops up at frame 175
  const modalOpen = frame >= 175;
  const modalSpring = spring({ frame: frame - 175, fps, config: { damping: 10, mass: 0.5 } });

  // Interactive slider moving commute distance from 25 to 55 km
  const commuteKm = Math.min(55, Math.floor(25 + (frame / fps) * 4));
  const monthlySavings = commuteKm * 64;

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#070B14] p-10 text-white font-sans">
      <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-amber-500/15 blur-[140px]" />

      {/* Top Banner: Kinetic Pop Typography */}
      <div className="relative z-10 flex items-center justify-between pb-4">
        <div style={{ transform: `scale(${titleSpring})` }} className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-950/70 px-4 py-1 text-xs font-mono font-black uppercase text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            STEP 04 • PRODUCT HUB
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            The <span className="text-amber-400">Reality Gap</span>: Verified Owner Telemetry
          </h1>
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-slate-900/90 px-5 py-2 font-mono text-right">
          <div className="text-[10px] text-slate-400">AUDIT METHOD</div>
          <div className="text-sm font-black text-amber-400">GST & VAHAN RC INVOICES</div>
        </div>
      </div>

      {/* Main UI Simulation: Product Hub with Dynamic Quick Rankings & Modal */}
      <div className="relative z-10 flex-1 my-2">
        <BrowserFrame activeTab="Product Hub • Comparison Matrix" url="veripulse.in/compare">
          <AnimatedCursor x={cursorX} y={cursorY} clicking={isClicking} label={modalOpen ? 'Drill Down' : 'Quick Ranking'} />

          <div className="space-y-4">
            {/* Dynamic Category-Specific Quick Rankings bar */}
            <div className="flex items-center gap-2 overflow-hidden pb-1">
              <span className="text-xs font-mono text-slate-400 font-bold mr-1">Rankings:</span>
              {[
                { name: 'Best Camera under ₹20k', active: true },
                { name: 'Battery Titan', active: false },
                { name: 'Pure Gaming', active: false },
                { name: 'Clean UI (No Bloat)', active: false },
                { name: 'Honest Marketing', active: false },
              ].map((qr, i) => (
                <div
                  key={i}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold transition-all ${
                    qr.active
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
                      : 'border border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  {qr.name}
                </div>
              ))}
            </div>

            {/* Product Card / Modal Area */}
            {!modalOpen ? (
              <div className="grid grid-cols-12 gap-6 rounded-2xl border border-slate-700/80 bg-[#0B132B]/90 p-5 shadow-2xl items-center">
                <div className="col-span-4 rounded-xl bg-slate-800 p-4 border border-white/10 text-center space-y-1">
                  <span className="text-4xl">📱</span>
                  <div className="font-bold text-white text-sm">Realme 12+ 5G</div>
                  <div className="text-xs font-mono text-emerald-400">₹18,999 • Steal Deal</div>
                </div>

                <div className="col-span-8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-amber-400 font-bold">142 VERIFIED INVOICE OWNERS</span>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400">
                      Score: 8.6 / 10
                    </span>
                  </div>
                  <p className="text-xs text-slate-200">
                    Flagship Sony LYT-600 sensor with OIS confirmed by reviewers. Verified 6.8h SOT with 67W fast charging.
                  </p>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-700/60 font-mono text-xs">
                    <span className="text-emerald-400 font-bold">Reality Gap: 12% (Honest Specs)</span>
                    <span className="text-slate-400">• Click to open deep drill-down</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Product Detail Modal: The Good, The Bad & Commute ROI Calculator */
              <div
                style={{ transform: `scale(${modalSpring})` }}
                className="rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-slate-900 via-[#0B132B] to-black p-5 shadow-2xl backdrop-blur-xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-500 text-black px-2 py-0.5 font-mono text-[10px] font-black">
                      TRANSPARENCY MATRIX
                    </span>
                    <h3 className="text-lg font-black text-white">Realme 12+ 5G (8/128) Deep Telemetry</h3>
                  </div>
                  <span className="font-mono text-xs text-emerald-400 font-bold">STEAL DEAL BADGE</span>
                </div>

                {/* The Good vs The Bad Matrix */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 space-y-1">
                    <div className="font-bold text-emerald-400 flex items-center gap-1">
                      <span>✓</span> THE GOOD (VERIFIED CONSENSUS)
                    </div>
                    <ul className="text-slate-200 text-[11px] space-y-0.5 list-disc list-inside">
                      <li>Sony LYT-600 OIS camera natural portraits</li>
                      <li>Luxury vegan leather back resists fingerprints</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 space-y-1">
                    <div className="font-bold text-rose-400 flex items-center gap-1">
                      <span>✗</span> THE BAD (COMMUNITY GOTCHAS)
                    </div>
                    <ul className="text-slate-200 text-[11px] space-y-0.5 list-disc list-inside">
                      <li>Glance lockscreen ads (requires manual disable)</li>
                      <li>8MP ultra-wide is soft in low-light conditions</li>
                    </ul>
                  </div>
                </div>

                {/* Commute Fuel & ROI Slider */}
                <div className="rounded-xl bg-black/60 p-3 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">Daily Commute Distance:</span>
                    <span className="font-bold text-amber-400">{commuteKm} km / day</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${(commuteKm / 60) * 100}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono pt-0.5">
                    <span className="text-slate-400">Calculated EV Payback Savings:</span>
                    <span className="text-emerald-400 font-bold text-sm">₹{monthlySavings.toLocaleString('en-IN')} / month</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </BrowserFrame>
      </div>

      {/* Footer Strip */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-white/10">
        <span>SMART ALTERNATIVE ENGINE</span>
        <span className="text-amber-400 font-bold">Unbiased 1-to-10 Benchmark Scores</span>
      </div>
    </div>
  );
};
