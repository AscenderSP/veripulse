import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { AnimatedCursor } from '../components/AnimatedCursor';

export const Scene2Breakthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 10, mass: 0.5 } });
  
  // Simulated Cursor moving to inspect C2PA Provenance Seal
  const cursorX = interpolate(frame, [0, 50, 110, 180], [300, 680, 680, 840], { extrapolateRight: 'clamp' });
  const cursorY = interpolate(frame, [0, 50, 110, 180], [500, 260, 260, 360], { extrapolateRight: 'clamp' });
  const isClicking = (frame >= 105 && frame <= 120);

  // Modal open trigger when clicking C2PA seal
  const modalOpen = frame >= 115;
  const modalSpring = spring({ frame: frame - 115, fps, config: { damping: 11, mass: 0.5 } });

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#070B14] p-10 text-white font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[550px] w-[550px] rounded-full bg-emerald-500/15 blur-[160px]" />

      {/* Top Banner: Kinetic Pop Typography */}
      <div className="relative z-10 flex items-center justify-between pb-4">
        <div style={{ transform: `scale(${titleSpring})` }} className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-950/70 px-4 py-1 text-xs font-mono font-black uppercase text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            STEP 02 • THE BREAKTHROUGH
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Meet <span className="text-emerald-400">VeriPulse</span>: Cryptographic Proof & Consensus
          </h1>
        </div>

        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-5 py-2 text-right font-mono">
          <div className="text-[10px] text-emerald-300">SECURITY STANDARD</div>
          <div className="text-lg font-black text-emerald-400">C2PA HARDWARE ENCLAVE</div>
        </div>
      </div>

      {/* Main UI Simulation: Live Story Card with Cryptographic C2PA Verification */}
      <div className="relative z-10 flex-1 my-2">
        <BrowserFrame activeTab="Live Circle • Verification Engine" url="veripulse.in/feed">
          <AnimatedCursor x={cursorX} y={cursorY} clicking={isClicking} label={modalOpen ? 'Cryptographic Hash' : 'Inspect C2PA'} />

          <div className="grid grid-cols-12 gap-6 h-full items-center">
            {/* Left Column: Live Card with Verified Photo & C2PA Seal */}
            <div className="col-span-6 rounded-2xl border border-slate-700/80 bg-[#0B132B]/90 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="rounded bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 text-xs font-bold font-mono">
                  VERIFIED CITIZEN REPORT
                </span>
                <span className="font-mono text-xs text-slate-400">2 mins ago • Kolkata, WB</span>
              </div>

              {/* Verified Image Placeholder with Neon C2PA Badge */}
              <div className="relative h-44 w-full overflow-hidden rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center border border-white/10">
                <div className="text-center space-y-1">
                  <div className="text-4xl">🛰️</div>
                  <div className="font-mono text-xs font-bold text-slate-300">ISRO High-Altitude Launch Telemetry</div>
                </div>

                {/* Interactive C2PA Chip */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-emerald-400 bg-black/80 px-3.5 py-1 text-xs font-mono font-bold text-emerald-400 shadow-lg">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>C2PA VERIFIED</span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-black text-white">Gaganyaan Crew Module TV-D2 Splashdown</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Autonomous descent validated with supersonic drogue chutes deployment over Bay of Bengal.
                </p>
              </div>

              {/* Consensus Voting Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs font-mono">
                <span className="text-emerald-400 font-bold">Consensus: 98% Real (420 Votes)</span>
                <span className="text-slate-400">Weight: 3.0x Verified</span>
              </div>
            </div>

            {/* Right Column: C2PA Cryptographic Provenance Drawer */}
            <div className="col-span-6">
              {modalOpen ? (
                <div
                  style={{ transform: `scale(${modalSpring})` }}
                  className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-950/90 via-slate-900 to-black p-6 shadow-2xl backdrop-blur-xl space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">C2PA DIGITAL PROVENANCE MANIFEST</span>
                    <span className="rounded bg-emerald-500 text-black px-2 py-0.5 text-[10px] font-black font-mono">
                      100% UNTAMPERED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="rounded-lg bg-black/60 p-2.5 border border-white/5 flex justify-between">
                      <span className="text-slate-400">Cryptographic Hash:</span>
                      <span className="text-cyan-300 font-bold">sha256-90184bacde90</span>
                    </div>
                    <div className="rounded-lg bg-black/60 p-2.5 border border-white/5 flex justify-between">
                      <span className="text-slate-400">Capture Device:</span>
                      <span className="text-white font-bold">Nikon Z9 Press Pool Enclave</span>
                    </div>
                    <div className="rounded-lg bg-black/60 p-2.5 border border-white/5 flex justify-between">
                      <span className="text-slate-400">Signing Authority:</span>
                      <span className="text-emerald-400 font-bold">C2PA Trust Root Certificate</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/30 p-3 text-xs text-emerald-200 leading-relaxed font-medium">
                    Zero pixel alterations detected. The image signature matches the original camera CMOS exposure.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-2 text-slate-400 font-mono text-xs">
                  <span>Hovering to audit digital certificate...</span>
                </div>
              )}
            </div>
          </div>
        </BrowserFrame>
      </div>

      {/* Footer Strip */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-white/10">
        <span>HARDWARE SECURE ENCLAVE</span>
        <span className="text-emerald-400 font-bold">Eliminating Deepfakes & Altered Media at Root</span>
      </div>
    </div>
  );
};
