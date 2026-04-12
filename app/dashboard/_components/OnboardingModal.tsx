"use client";

/**
 * OnboardingModal
 * ──────────────────────────────────────────────────────────────────────────────
 * Shown to new users who have zero connected platforms.
 *
 * Step 1: Connect Stripe (direct OAuth).
 * "Maybe later" → closes modal, navigates to Settings, and briefly
 * highlights the integrations section so the user knows where to go next.
 *
 * Soft-dismiss (24 h snooze) so it comes back the next day if still empty.
 */

import { useEffect, useState } from "react";

const DISMISS_STORAGE_KEY = "fold_onboarding_dismissed_until";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

interface Props {
  hasNoConnections: boolean;
  onNavigateToSettings: () => void;
}

export default function OnboardingModal({ hasNoConnections, onNavigateToSettings }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasNoConnections) { setVisible(false); return; }
    try {
      const until = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (Date.now() > (until ? parseInt(until, 10) : 0)) setVisible(true);
    } catch { setVisible(true); }
  }, [hasNoConnections]);

  function snooze() {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_DURATION_MS));
    } catch { /* ignore */ }
    setVisible(false);
  }

  function handleLater() {
    snooze();
    onNavigateToSettings();
    // After the Settings tab renders, scroll to and pulse the integrations section
    setTimeout(() => {
      const el = document.getElementById("integrations-section");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("integrations-highlight");
      setTimeout(() => el.classList.remove("integrations-highlight"), 2000);
    }, 350);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Connect Stripe"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#363650] bg-[#1c1c2a] shadow-2xl overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-linear-to-r from-[#00d4aa] via-[#6366f1] to-[#00d4aa]" />

        {/* Body */}
        <div className="px-8 pt-7 pb-8">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-4">
            Step 1 of 1 · connect your first integration
          </p>

          {/* Icon + title */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#635bff]/30 bg-[#635bff]/10 text-[#635bff]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" fill="currentColor" />
              </svg>
            </div>
            <h2 className="font-mono text-xl font-bold text-[#f8f8fc]">Connect Stripe</h2>
          </div>

          <p className="text-sm leading-relaxed text-[#bcbcd8] mb-6">
            Link your Stripe account to instantly see revenue, new customers, refunds, and daily transaction trends — all in one place.
          </p>

          {/* Value reminder */}
          <div className="mb-6 rounded-xl border border-[#00d4aa]/15 bg-[#00d4aa]/5 px-4 py-3">
            <p className="font-mono text-[10px] text-[#00d4aa] leading-relaxed">
              <span className="font-bold">Your dashboard is empty until you connect.</span>{" "}
              Takes under 60 seconds — no code, read-only access.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <a
              href="/api/auth/stripe/url"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#635bff] py-3 font-mono text-sm font-semibold uppercase tracking-wider text-white transition-all hover:opacity-90"
            >
              Connect Stripe
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>

            <button
              onClick={handleLater}
              className="w-full rounded-xl border border-[#363650] py-2.5 font-mono text-xs uppercase tracking-wider text-[#8585aa] transition-all hover:border-[#8585aa] hover:text-[#bcbcd8]"
            >
              Maybe later — show me where to connect
            </button>
          </div>
        </div>

        {/* X — soft dismiss only */}
        <button
          onClick={snooze}
          aria-label="Dismiss — remind me tomorrow"
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
