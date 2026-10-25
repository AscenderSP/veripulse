import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';

export const Scene6CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 9, mass: 0.5 } });
  const opacity = interpolate(frame, [0, 15], [0, 1]);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#070B14] p-10 text-white font-sans text-center">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[650px] w-[650px] rounded-full bg-emerald-500/20 blur-[180px]" />

      {/* Top Tag */}
      <div style={{ opacity }} className="flex items-center justify-center pb-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-6 py-1.5 text-xs font-mono font-black uppercase text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          BECOME A VERIPULSE SENTINEL
        </div>
      </div>

      {/* Central Hero Banner with Live App Preview */}
      <div style={{ transform: `scale(${titleSpring})` }} className="my-auto space-y-6 max-w-4xl mx-auto z-10">
        <h1 className="text-6xl font-black tracking-tight leading-tight">
          Stop Guessing. <br />
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-amber-300 bg-clip-text text-transparent">
            Start Verifying.
          </span>
        </h1>

        <p className="text-xl text-slate-300 font-medium max-w-2xl mx-auto">
          Join thousands of citizens earning daily cash, busting viral hoaxes, and dodging deceptive marketing traps.
        </p>

        {/* Big Neon Domain Badge */}
        <div className="pt-2 flex justify-center">
          <div
            style={{ transform: `scale(${pulse})` }}
            className="rounded-3xl border-2 border-emerald-400 bg-black/90 px-12 py-5 shadow-[0_0_80px_rgba(16,185,129,0.45)]"
          >
            <span className="font-mono text-4xl font-black text-emerald-400 tracking-wider">
              veripulse.in
            </span>
          </div>
        </div>

        {/* Platform Availability Strip */}
        <div className="flex items-center justify-center gap-4 pt-3 font-mono text-xs text-slate-300">
          <div className="flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-700 px-4 py-2">
            <span>🌐</span> Progressive Web App
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-700 px-4 py-2">
            <span>📱</span> Android APK & iOS
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-700 px-4 py-2">
            <span>⚡</span> Instant UPI Payouts
          </div>
        </div>
      </div>

      {/* Footer Strip */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-white/10 z-10">
        <span>VERIPULSE DECENTRALIZED PLATFORM</span>
        <span className="text-emerald-400 font-bold">Live in English, বাংলা & हिंदी</span>
      </div>
    </div>
  );
};
