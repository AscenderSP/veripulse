import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserFrame } from '../components/BrowserFrame';
import { AnimatedCursor } from '../components/AnimatedCursor';

export const Scene5EarnEconomy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 10, mass: 0.5 } });

  // Cursor moves to click "Withdraw to UPI" button
  const cursorX = interpolate(frame, [0, 50, 110, 160], [300, 780, 780, 780], { extrapolateRight: 'clamp' });
  const cursorY = interpolate(frame, [0, 50, 110, 160], [300, 470, 470, 470], { extrapolateRight: 'clamp' });
  const isClicking = frame >= 120 && frame <= 135;

  // Balance ticking up
  const balance = Math.min(540, Math.floor(150 + (frame / fps) * 70));
  const payoutConfirmed = frame >= 135;

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#070B14] p-10 text-white font-sans">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-emerald-500/20 blur-[150px]" />

      {/* Top Banner: Kinetic Pop Typography */}
      <div className="relative z-10 flex items-center justify-between pb-4">
        <div style={{ transform: `scale(${titleSpring})` }} className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-950/70 px-4 py-1 text-xs font-mono font-black uppercase text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            STEP 05 • THE TRUTH ECONOMY
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Protect Society. <span className="text-emerald-400">Earn Daily UPI Cash</span>.
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-slate-900/90 px-4 py-2 font-mono">
          <span className="text-xs text-slate-400">DAILY POOL:</span>
          <span className="text-sm font-black text-emerald-400">₹10,000 SENTINEL FUND</span>
        </div>
      </div>

      {/* Main UI Simulation: Earn Hub, Quests & Instant UPI Wallet */}
      <div className="relative z-10 flex-1 my-2">
        <BrowserFrame activeTab="Wallet & Bounties • UPI Payout" url="veripulse.in/wallet">
          <AnimatedCursor x={cursorX} y={cursorY} clicking={isClicking} label={payoutConfirmed ? 'UPI Sent' : 'Withdraw Now'} />

          <div className="grid grid-cols-12 gap-6 h-full items-center">
            {/* Left Column: Active Citizen Bounties */}
            <div className="col-span-6 rounded-2xl border border-slate-700/80 bg-[#0B132B]/90 p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="font-mono text-xs font-bold text-amber-400">ACTIVE CITIZEN BOUNTIES</span>
                <span className="font-mono text-[10px] text-slate-400">3 OPEN QUESTS</span>
              </div>

              <div className="space-y-2.5">
                <div className="rounded-xl border border-emerald-500/30 bg-black/40 p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-xs">Verify local Sealdah flyover traffic diversion</div>
                    <div className="text-[10px] text-slate-400">Proof: Geotagged photo proof needed</div>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2.5 py-1 font-mono text-xs font-bold">
                    +₹40.00
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-black/40 p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-xs">Ather 450X real winter fog range audit</div>
                    <div className="text-[10px] text-slate-400">Proof: Odometer screenshot after ride</div>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2.5 py-1 font-mono text-xs font-bold">
                    +₹200.00
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Wallet Balance & UPI Payout Interaction */}
            <div className="col-span-6 rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-black p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-slate-400 uppercase">AVAILABLE WALLET BALANCE</div>
                  <div className="font-mono text-4xl font-black text-emerald-400 mt-1">
                    ₹{balance}.00
                  </div>
                </div>
                <div className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 font-mono text-xs font-bold text-emerald-300">
                  7-DAY STREAK: 1.5x
                </div>
              </div>

              {/* Linked UPI Account */}
              <div className="rounded-xl bg-black/60 p-3 border border-white/5 flex items-center justify-between font-mono text-xs">
                <span className="text-slate-400">UPI VPA:</span>
                <span className="text-white font-bold">sayantan@okhdfc</span>
              </div>

              {/* Payout Action Button */}
              {payoutConfirmed ? (
                <div className="rounded-2xl border border-emerald-400 bg-emerald-950/90 p-4 text-center space-y-1 animate-slide-up">
                  <div className="text-emerald-400 font-black text-sm flex items-center justify-center gap-1.5">
                    <span>✓</span> Instant UPI Transfer Successful
                  </div>
                  <div className="font-mono text-xs text-slate-300">
                    ₹250.00 credited to bank account via RazorpayX
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-400 p-3.5 text-center font-bold text-black text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer">
                  <span>⚡</span> Withdraw Instant to UPI (0% Fee)
                </div>
              )}
            </div>
          </div>
        </BrowserFrame>
      </div>

      {/* Footer Strip */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-white/10">
        <span>CITIZEN BOUNTY PROTOCOL</span>
        <span className="text-emerald-400 font-bold">Monetize Fact-Checking & On-Ground Eyewitness Proof</span>
      </div>
    </div>
  );
};
