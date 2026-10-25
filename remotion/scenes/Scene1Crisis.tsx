import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { AnimatedCursor } from '../components/AnimatedCursor';

export const Scene1Crisis: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Kinetic Pop animation
  const titleSpring = spring({ frame, fps, config: { damping: 10, mass: 0.5 } });
  
  // Cursor movement simulating user checking a viral WhatsApp claim in FactCheckScanner
  const cursorX = interpolate(frame, [0, 40, 80, 140, 200], [800, 520, 520, 720, 720], { extrapolateRight: 'clamp' });
  const cursorY = interpolate(frame, [0, 40, 80, 140, 200], [600, 310, 310, 460, 460], { extrapolateRight: 'clamp' });
  const isClicking = (frame >= 75 && frame <= 90) || (frame >= 195 && frame <= 210);

  // Scanning progress
  const scanProgress = interpolate(frame, [85, 170], [0, 100], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const showVerdict = frame >= 170;
  const verdictSpring = spring({ frame: frame - 170, fps, config: { damping: 9, mass: 0.4 } });

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#070B14] p-10 text-white font-sans">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-rose-600/20 blur-[130px]" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/15 blur-[130px]" />

      {/* Top Banner: Kinetic Pop Text */}
      <div className="relative z-10 flex items-center justify-between pb-4">
        <div style={{ transform: `scale(${titleSpring})` }} className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/50 bg-rose-950/70 px-4 py-1 text-xs font-mono font-black uppercase text-rose-300">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            STEP 01 • THE PROBLEM
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Tired of <span className="bg-gradient-to-r from-rose-400 via-amber-400 to-rose-400 bg-clip-text text-transparent underline decoration-rose-500 decoration-wavy">Fake WhatsApp Forwards</span>?
          </h1>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-5 py-2.5 text-right font-mono">
          <div className="text-[10px] text-slate-400">VIRAL MISINFORMATION</div>
          <div className="text-lg font-black text-rose-400">84% UNVERIFIED</div>
        </div>
      </div>

      {/* Main UI Simulation: WhatsApp Shield / FactCheck Scanner in Action */}
      <div className="relative z-10 flex-1 my-2">
        <BrowserFrame activeTab="WhatsApp Shield • Scanner" url="veripulse.in/scanner">
          <AnimatedCursor x={cursorX} y={cursorY} clicking={isClicking} label={frame > 160 ? 'Debunked' : 'Scanning'} />

          <div className="grid grid-cols-12 gap-6 h-full items-center">
            {/* Left Column: Viral Forward Input Box */}
            <div className="col-span-6 space-y-4 rounded-2xl border border-slate-700/60 bg-[#0B132B]/80 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
                <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <span>📱</span> VIRAL CLAIM FORWARDED MANY TIMES
                </span>
                <span className="rounded bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-400">
                  FLAGGED BY 24 USERS
                </span>
              </div>

              <div className="rounded-xl bg-black/60 p-4 border border-slate-700/50 text-sm font-medium text-slate-200 leading-relaxed">
                "Government is distributing free laptops to all college students. Register at this link before 30th October with your Aadhaar number..."
              </div>

              {/* Scan Button & Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">AI Deep-Check Analysis:</span>
                  <span className="text-emerald-400 font-bold">{Math.floor(scanProgress)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-75"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Instant VeriPulse Verdict Result */}
            <div className="col-span-6">
              {showVerdict ? (
                <div
                  style={{ transform: `scale(${verdictSpring})` }}
                  className="rounded-2xl border-2 border-rose-500 bg-rose-950/80 p-6 shadow-2xl backdrop-blur-md space-y-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-rose-300">PIB & CYBER ADVISORY CROSS-MATCH</span>
                    <span className="rounded-full bg-rose-500 px-3 py-1 font-mono text-xs font-black text-black">
                      CONFIRMED FAKE
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white">
                    Phishing Scam Debunked in 1.2s
                  </h3>

                  <p className="text-xs text-rose-100 font-medium leading-relaxed">
                    The PIB Fact-Check team confirmed no such laptop scheme exists. The link is designed to harvest personal Aadhaar numbers and bank credentials.
                  </p>

                  <div className="flex items-center gap-2 pt-2 border-t border-rose-500/30 font-mono text-[11px] text-rose-300">
                    <span className="font-bold text-white">Source:</span>
                    <span>PIB Fact-Check Official Archive • Verified</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-700 text-center space-y-2">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  <span className="font-mono text-xs text-slate-400">Verifying claim across official registries...</span>
                </div>
              )}
            </div>
          </div>
        </BrowserFrame>
      </div>

      {/* Footer Strip */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-white/10">
        <span>VERIPULSE WHATSAPP SHIELD</span>
        <span className="text-amber-400 font-bold">Instantly Neutralizing Viral Misinformation</span>
      </div>
    </div>
  );
};
