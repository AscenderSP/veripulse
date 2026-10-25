import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { AnimatedCursor } from '../components/AnimatedCursor';

export const Scene3NewsHub: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 10, mass: 0.5 } });

  // Cursor moves to switch news category to Tech, then upvotes credibility
  const cursorX = interpolate(frame, [0, 50, 110, 160, 220], [200, 380, 380, 560, 560], { extrapolateRight: 'clamp' });
  const cursorY = interpolate(frame, [0, 50, 110, 160, 220], [200, 110, 110, 480, 480], { extrapolateRight: 'clamp' });
  const isClicking = (frame >= 48 && frame <= 60) || (frame >= 155 && frame <= 170);

  // Active Category state simulated
  const activeCategory = frame >= 55 ? 'Science & Technology' : 'All Categories';
  const realVotesCount = frame >= 165 ? 421 : 420;

  // Language cycling: English -> বাংলা -> हिंदी
  const activeLangIndex = Math.floor((frame / 60) % 3);
  const languages = ['EN (English)', 'BN (বাংলা)', 'HI (हिंदी)'];

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#070B14] p-10 text-white font-sans">
      <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-cyan-600/15 blur-[140px]" />

      {/* Top Banner: Kinetic Pop Typography */}
      <div className="relative z-10 flex items-center justify-between pb-4">
        <div style={{ transform: `scale(${titleSpring})` }} className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/50 bg-cyan-950/70 px-4 py-1 text-xs font-mono font-black uppercase text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            STEP 03 • CITIZEN JOURNALISM
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Verified News Hub: Strictly <span className="text-cyan-400">60 Words</span> in 3 Languages
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/40 bg-slate-900/90 px-4 py-2 font-mono">
          <span className="text-xs text-slate-400">ACTIVE LANGUAGE:</span>
          <span className="rounded-full bg-cyan-500 px-3 py-0.5 text-xs font-black text-black">
            {languages[activeLangIndex]}
          </span>
        </div>
      </div>

      {/* Main UI Simulation: News Hub UI with category chips and squarish news card */}
      <div className="relative z-10 flex-1 my-2">
        <BrowserFrame activeTab="News Hub • 5 Core Categories" url="veripulse.in/news">
          <AnimatedCursor x={cursorX} y={cursorY} clicking={isClicking} label={frame > 140 ? 'Upvote Real' : 'Select Category'} />

          <div className="space-y-4">
            {/* Category Selector Chips */}
            <div className="flex items-center gap-2.5 overflow-hidden pb-1">
              {['All', 'Politics', 'Business', 'Science & Technology', 'Health', 'Entertainment'].map((cat, i) => {
                const isActive = (cat === 'Science & Technology' && frame >= 55) || (cat === 'All' && frame < 55);
                return (
                  <div
                    key={i}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black shadow-md'
                        : 'border border-slate-700 bg-slate-900 text-slate-300'
                    }`}
                  >
                    {cat}
                  </div>
                );
              })}
            </div>

            {/* The Actual News Card Component */}
            <div className="grid grid-cols-12 gap-6 rounded-2xl border border-slate-700/80 bg-[#0B132B]/90 p-5 shadow-2xl">
              {/* Left Column: Squarish Photo + Reporter Badge Strip */}
              <div className="col-span-5 space-y-3">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-4xl">🚀</span>
                    <div className="font-mono text-xs font-bold text-slate-300 mt-1">Sriharikota CE20 Test</div>
                  </div>
                  <div className="absolute top-2 right-2 rounded-full bg-black/80 border border-emerald-400 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                    C2PA VERIFIED
                  </div>
                </div>

                {/* Reporter Badge Strip directly below photo */}
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-2.5 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-emerald-500 text-black font-bold flex items-center justify-center text-[10px]">
                      VS
                    </div>
                    <div>
                      <div className="font-bold text-white text-[11px]">Vikram Sen • Bureau Chief</div>
                      <div className="text-[9px] text-slate-400">Match: 96% with Consensus</div>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400 text-xs">+₹380 Earned</span>
                </div>
              </div>

              {/* Right Column: 60-Word Story & Credibility Voting */}
              <div className="col-span-7 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase">ISRO GAGANYAAN UPDATE</span>
                    <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                      56 / 60 Words
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-white leading-snug">
                    ISRO Gaganyaan uncrewed capsule passes high-altitude parachute abort tests
                  </h3>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Autonomous high-altitude escape sequences were demonstrated off Sriharikota coast. Two drogue chutes opened at Mach 1.3, dampening oscillations before main chutes brought the module to a gentle splashdown. Telemetry confirmed all life-support sensor modules operated within nominal limits.
                  </p>
                </div>

                {/* Credibility Consensus Voting Action Bar */}
                <div className="flex items-center justify-between border-t border-slate-700/60 pt-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold font-mono transition-transform ${
                        frame >= 165 ? 'bg-emerald-500 text-black scale-105' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}
                    >
                      <span>👍 Real</span>
                      <span>({realVotesCount})</span>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold font-mono text-rose-400">
                      <span>👎 Hoax (4)</span>
                    </div>
                  </div>

                  <span className="font-mono text-xs text-cyan-300 font-bold">
                    Credibility: 98% Consensus
                  </span>
                </div>
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>

      {/* Footer Strip */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-white/10">
        <span>MULTI-REPORTER BUFFER PROTOCOL</span>
        <span className="text-cyan-400 font-bold">Deduplication Engine Merges Breaking Events</span>
      </div>
    </div>
  );
};
