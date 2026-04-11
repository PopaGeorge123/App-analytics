"use client";

/**
 * OnboardingModal
 * ──────────────────────────────────────────────────────────────────────────────
 * Shown to new users who have zero connected platforms.
 *
 * Design: integration picker grid — user chooses the one that matters to them.
 * Soft-dismiss (24 h snooze) so it comes back the next day if still empty.
 */

import { useEffect, useState } from "react";

const DISMISS_STORAGE_KEY = "fold_onboarding_dismissed_until";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

interface Props {
  hasNoConnections: boolean;
  onNavigateToSettings: () => void;
}

const INTEGRATIONS = [
  {
    id: "stripe",
    label: "Stripe",
    url: "/api/auth/stripe/url",
    color: "#635bff",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "google",
    label: "Google Analytics",
    url: "/api/auth/google/url",
    color: "#4285F4",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: "meta",
    label: "Meta Ads",
    url: "/api/auth/meta/url",
    color: "#0082fb",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.41 2.87 8.16 6.84 9.46-.09-.78-.18-1.97.04-2.82.19-.76 1.28-5.43 1.28-5.43s-.33-.65-.33-1.62c0-1.52.88-2.66 1.98-2.66.93 0 1.38.7 1.38 1.54 0 .94-.6 2.34-.91 3.64-.26 1.09.54 1.97 1.6 1.97 1.92 0 3.4-2.02 3.4-4.94 0-2.58-1.86-4.39-4.51-4.39-3.07 0-4.87 2.3-4.87 4.68 0 .93.36 1.92.8 2.46a.32.32 0 0 1 .07.31c-.08.34-.27 1.09-.3 1.24-.05.2-.17.24-.38.15-1.41-.66-2.3-2.72-2.3-4.38 0-3.56 2.59-6.84 7.47-6.84 3.92 0 6.97 2.79 6.97 6.52 0 3.89-2.45 7.02-5.86 7.02-1.14 0-2.22-.6-2.59-1.3l-.7 2.62c-.26.98-.94 2.2-1.4 2.95.06.02.12.03.18.04C12 21.96 21.96 12 21.96 12c0-5.5-4.46-9.96-9.96-9.96z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "google-ads",
    label: "Google Ads",
    url: "/api/auth/google-ads/url",
    color: "#fbbc04",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.084 17.5l7-12.124A2 2 0 0 1 10.812 4.5h2.376a2 2 0 0 1 1.728 1l7 12.124A2 2 0 0 1 20.188 20.5H3.812a2 2 0 0 1-1.728-3z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "tiktok-ads",
    label: "TikTok Ads",
    url: "/api/auth/tiktok-ads/url",
    color: "#ff2d55",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "woocommerce",
    label: "WooCommerce",
    url: "/api/auth/woocommerce/url",
    color: "#96588a",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.26 4.5C1.01 4.5 0 5.51 0 6.76v9.1c0 1.25 1.01 2.26 2.26 2.26h12.9l3.62 2.88V18.12h2.96c1.25 0 2.26-1.01 2.26-2.26V6.76c0-1.25-1.01-2.26-2.26-2.26H2.26zm3.3 3.48c.36 0 .63.1.79.3.16.2.2.47.12.8l-.95 3.97c.52-.93 1-1.64 1.43-2.12.43-.48.84-.73 1.24-.73.27 0 .49.1.66.31.17.21.25.48.25.83 0 .36-.07.77-.22 1.23l-.5 1.57c-.1.31-.14.53-.12.65.02.11.07.17.16.17.1 0 .24-.07.42-.21.48-.37.98-1 1.5-1.87l.25.14c-.6 1.1-1.2 1.88-1.8 2.33-.36.27-.7.4-1.02.4-.26 0-.47-.08-.62-.25-.15-.17-.22-.4-.22-.7 0-.28.06-.62.19-1.02l.48-1.53c.1-.32.15-.57.15-.75 0-.12-.03-.21-.08-.28-.05-.07-.13-.1-.22-.1-.2 0-.43.14-.69.43-.44.49-.88 1.21-1.32 2.17-.18.41-.35.9-.51 1.47l-.21.83h-1.2l1.15-4.56c.07-.28.1-.48.1-.61 0-.23-.1-.34-.3-.34-.08 0-.2.02-.35.06l-.1-.29 1.5-.54h.47zm8.5 0c.46 0 .83.14 1.1.42.27.28.41.66.41 1.14 0 .64-.19 1.27-.57 1.89-.38.62-.85 1.1-1.42 1.44-.46.28-.9.42-1.33.42-.4 0-.72-.12-.95-.37-.24-.25-.36-.59-.36-1.02 0-.62.2-1.24.6-1.86.4-.62.88-1.1 1.44-1.44.4-.24.77-.37 1.08-.62zm-.14.57c-.2 0-.4.08-.59.24-.3.25-.56.67-.79 1.26-.23.6-.34 1.13-.34 1.6 0 .2.04.36.13.47.09.11.2.16.35.16.2 0 .41-.09.63-.28.32-.27.58-.71.8-1.3.2-.57.3-1.1.3-1.57 0-.2-.04-.36-.12-.46-.08-.08-.2-.12-.37-.12z" fill="currentColor"/>
      </svg>
    ),
  },
] as const;

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
    try { localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_DURATION_MS)); } catch { /* ignore */ }
    setVisible(false);
  }

  function goToSettings() { snooze(); onNavigateToSettings(); }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Connect your first integration"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[#363650] bg-[#1c1c2a] shadow-2xl overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-linear-to-r from-[#00d4aa] via-[#6366f1] to-[#00d4aa]" />

        {/* Header */}
        <div className="px-8 pt-7 pb-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#00d4aa] mb-2">
            Step 1 of 1 · connect your first integration
          </p>
          <h2 className="font-mono text-xl font-bold text-[#f8f8fc] leading-snug">
            What tool do you use to run your business?
          </h2>
          <p className="mt-2 text-sm text-[#8585aa]">
            Pick one — takes 60 seconds, read-only access.
          </p>
        </div>

        {/* Integration grid */}
        <div className="px-8 pb-2 grid grid-cols-2 gap-3">
          {INTEGRATIONS.map((integration) => (
            <a
              key={integration.id}
              href={integration.url}
              className="group flex items-center gap-3 rounded-xl border border-[#363650] bg-[#12121a] px-4 py-3.5 transition-all hover:border-[#4a4a6a] hover:bg-[#1e1e2e]"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors"
                style={{
                  color: integration.color,
                  borderColor: `${integration.color}30`,
                  backgroundColor: `${integration.color}12`,
                }}
              >
                {integration.icon}
              </span>
              <span className="font-mono text-xs font-semibold text-[#bcbcd8] group-hover:text-[#f8f8fc] transition-colors leading-tight">
                {integration.label}
              </span>
            </a>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 pt-4 pb-7 flex items-center justify-between">
          <button
            onClick={goToSettings}
            className="font-mono text-xs text-[#8585aa] underline underline-offset-2 hover:text-[#bcbcd8] transition-colors"
          >
            See all 30+ integrations →
          </button>
          <button
            onClick={snooze}
            className="font-mono text-xs text-[#4a4a6a] hover:text-[#8585aa] transition-colors"
          >
            Maybe later
          </button>
        </div>

        {/* X — soft dismiss */}
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
