'use client';

// ════════════════════════════════════════════════════════════════════════
//  GlobalErrorBoundary — catches render-time errors so a single bad
//  component doesn't white-screen the whole app. Reports to errorTracker.
//  Also installs window.onerror / unhandledrejection sinks once on mount.
// ════════════════════════════════════════════════════════════════════════

import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { installGlobalErrorHandlers, reportError } from '@/lib/errorTracker';

interface State {
  error: Error | null;
}

class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { component: 'GlobalErrorBoundary', extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] p-6 text-center text-[var(--content-primary)]">
          <h1 className="text-xl font-bold">Something went wrong.</h1>
          <p className="max-w-md text-sm text-[var(--content-secondary)]">
            We&apos;ve logged this and the team is on it. Try reloading — your drafts are kept locally.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
            className="rounded-full bg-[var(--brand-emerald)] px-5 py-2 text-sm font-bold text-[#04110b]"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function InstallHandlers() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);
  return null;
}

export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Boundary>
      <InstallHandlers />
      {children}
    </Boundary>
  );
}
