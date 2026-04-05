"use client";

/**
 * OnboardingModal
 * ──────────────────────────────────────────────────────────────────────────────
 * Shown once to new users who have zero connected platforms.
 * Walks them through:
 *   Step 1 → Connect Stripe (most common first revenue signal)
 *   Step 2 → Connect Google Analytics 4
 *   Step 3 → Done — celebrate & close
 *
 * Dismissal is persisted in localStorage so the modal never shows again
 * once the user either connects a platform or explicitly skips it.
 */

import { useState, useEffect } from "react";

const STORAGE_KEY = "fold_onboarding_dismissed";

interface Props {
  /** Whether the user currently has zero connected platforms */
  hasNoConnections: boolean;
  /** Called when the user wants to connect a platform — navigate to settings */
  onNavigateToSettings: () => void;
}

export default function OnboardingModal({ hasNoConnections, onNavigateToSettings }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1); // 1 | 2 | 3

  useEffect(() => {
    if (!hasNoConnections) return;
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      /* storage blocked */
    }
  }, [hasNoConnections]);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  function goToSettings() {
    dismiss();
    onNavigateToSettings();
  }

  if (!visible) return null;

  const steps = [
    {
      number: 1,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" fill="currentColor" />
        </svg>
      ),
      color: "#635bff",
      title: "Connect Stripe",
      description:
        "Link your Stripe account to instantly see revenue, new customers, refunds, and daily transaction trends — all in one place.",
      cta: "Connect Stripe →",
    },
    {
      number: 2,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ),
      color: "#f59e0b",
      title: "Connect Google Analytics",
      description:
        "Pull in sessions, bounce rate, and conversion data from GA4 so Fold can pair your traffic with revenue for a complete picture.",
      cta: "Connect GA4 →",
    },
    {
      number: 3,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "#00d4aa",
      title: "You're all set!",
      description:
        "Fold is syncing your data now. Your dashboard will be populated shortly. You can connect more platforms at any time from the Settings tab.",
      cta: "Go to dashboard",
    },
  ];

  const current = steps[step - 1]!;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Fold"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#363650] bg-[#1c1c2a] shadow-2xl overflow-hidden">

        {/* Top accent */}
        <div className="h-1 w-full bg-linear-to-r from-[#00d4aa] via-[#6366f1] to-[#00d4aa]" />

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-5">
          {steps.map((s) => (
            <span
              key={s.number}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s.number === step
                  ? "w-6 bg-[#00d4aa]"
                  : s.number < step
                  ? "w-3 bg-[#00d4aa]/50"
                  : "w-3 bg-[#363650]"
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-8 pt-6 pb-8">
          {/* Step label */}
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-4">
            {step < 3 ? `Step ${step} of 2` : "All done"}
          </p>

          {/* Icon + title */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{ color: current.color, borderColor: `${current.color}30`, backgroundColor: `${current.color}10` }}
            >
              {current.icon}
            </div>
            <h2 className="font-mono text-xl font-bold text-[#f8f8fc]">{current.title}</h2>
          </div>

          <p className="text-sm leading-relaxed text-[#bcbcd8] mb-8">{current.description}</p>

          {/* CTA */}
          {step < 3 ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={goToSettings}
                className="w-full rounded-xl py-3 font-mono text-sm font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:opacity-90"
                style={{ backgroundColor: current.color }}
              >
                {current.cta}
              </button>
              <button
                onClick={() => setStep((s) => s + 1)}
                className="w-full rounded-xl border border-[#363650] py-2.5 font-mono text-xs uppercase tracking-wider text-[#8585aa] transition-all hover:border-[#8585aa] hover:text-[#bcbcd8]"
              >
                Skip this step
              </button>
            </div>
          ) : (
            <button
              onClick={dismiss}
              className="w-full rounded-xl py-3 font-mono text-sm font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:opacity-90 bg-[#00d4aa]"
            >
              {current.cta}
            </button>
          )}
        </div>

        {/* Dismiss X */}
        <button
          onClick={dismiss}
          aria-label="Dismiss onboarding"
          className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-lg text-[#8585aa] hover:bg-[#363650] hover:text-[#f8f8fc] transition-colors"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
