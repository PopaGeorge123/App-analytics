"use client";

/**
 * TabErrorBoundary
 * ──────────────────────────────────────────────────────────────────────────────
 * React class error boundary that catches render/lifecycle errors inside any
 * dashboard tab so one broken tab cannot crash the entire shell.
 *
 * Usage (wraps a single tab):
 *   <TabErrorBoundary tabName="Analytics">
 *     <AnalyticsTab ... />
 *   </TabErrorBoundary>
 */

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  /** Display name shown in the fallback UI ("Analytics", "Overview", …) */
  tabName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class TabErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: unknown): State {
    const msg =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Log to console — swap for Sentry/PostHog capture when ready
    console.error(`[TabErrorBoundary][${this.props.tabName}]`, error, info);
  }

  reset = () => this.setState({ hasError: false, errorMessage: "" });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/8 text-red-400">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-widest text-red-400 mb-2">
          {this.props.tabName} tab error
        </p>
        <h2 className="font-mono text-base font-bold text-[#f8f8fc] mb-2">
          Something went wrong
        </h2>
        <p className="max-w-sm text-sm text-[#8585aa] leading-relaxed mb-6">
          {this.state.errorMessage}
        </p>

        <button
          onClick={this.reset}
          className="inline-flex items-center gap-2 rounded-xl border border-[#363650] bg-[#222235] px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-[#00d4aa]/40 hover:text-[#00d4aa]"
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Try again
        </button>
      </div>
    );
  }
}
