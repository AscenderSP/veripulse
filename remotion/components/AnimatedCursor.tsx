import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const AnimatedCursor: React.FC<{
  x: number;
  y: number;
  clicking?: boolean;
  label?: string;
}> = ({ x, y, clicking = false, label }) => {
  return (
    <div
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
      className="pointer-events-none absolute z-50 flex items-center gap-1.5"
    >
      {/* SVG Neon Cursor pointer */}
      <svg
        className={`h-7 w-7 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] transition-transform duration-150 ${
          clicking ? 'scale-75' : 'scale-100'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
          fill="#10B981"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>

      {/* Ripple Wave on Click */}
      {clicking && (
        <span className="absolute -left-1 -top-1 h-9 w-9 rounded-full border-2 border-emerald-400 bg-emerald-400/30 animate-ping" />
      )}

      {/* Label Tooltip if provided */}
      {label && (
        <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 font-mono text-[11px] font-black uppercase text-black shadow-lg">
          {label}
        </span>
      )}
    </div>
  );
};
