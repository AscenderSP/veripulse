import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const BrowserFrame: React.FC<{
  children: React.ReactNode;
  activeTab?: string;
  url?: string;
}> = ({ children, activeTab = 'Live Circle', url = 'veripulse.in' }) => {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border-2 border-slate-700/60 bg-[#070B14] shadow-[0_25px_80px_rgba(0,0,0,0.8)] backdrop-blur-xl">
      {/* Top Browser Chrome Bar */}
      <div className="flex h-12 w-full shrink-0 items-center justify-between border-b border-slate-800 bg-[#0B1120] px-4">
        {/* Window Traffic Lights */}
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-500/90 shadow-sm" />
          <span className="h-3 w-3 rounded-full bg-amber-500/90 shadow-sm" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/90 shadow-sm" />
        </div>

        {/* Address Bar */}
        <div className="flex items-center gap-2 rounded-full border border-slate-700/50 bg-[#070B14] px-5 py-1 text-xs font-mono text-slate-300">
          <span className="text-emerald-400 font-bold">🔒 https://</span>
          <span>{url}</span>
          <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            C2PA SECURE
          </span>
        </div>

        {/* Navigation Indicator */}
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="rounded bg-slate-800 px-2 py-0.5 text-emerald-400 font-bold">{activeTab}</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
      </div>

      {/* Main Inner Content Canvas */}
      <div className="relative flex-1 overflow-hidden p-6">
        {children}
      </div>
    </div>
  );
};
