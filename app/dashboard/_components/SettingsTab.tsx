"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
}

const INTEGRATIONS = [
  {
    id: "stripe",
    name: "Stripe Connect",
    description: "Revenue, transactions & new customers",
    connectUrl: "/api/auth/stripe/url",
    color: "#635bff",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    ),
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    description: "Sessions, users, bounce rate & conversions",
    connectUrl: "/api/auth/google/url",
    color: "#f59e0b",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Ad spend, reach, clicks & conversions",
    connectUrl: "/api/auth/meta/url",
    color: "#1877f2",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
];

function IntegrationRow({
  integration,
  connected,
}: {
  integration: (typeof INTEGRATIONS)[number];
  connected: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"disconnect" | null>(null);
  const [error, setError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  async function handleDisconnect() {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setLoading("disconnect");
    setError("");
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: integration.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to disconnect.");
        setLoading(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4 transition-all hover:border-[#2a2a3e]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: connected ? `${integration.color}18` : "#1a1a28", color: connected ? integration.color : "#2a2a4a" }}
          >
            {integration.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#f0f0f5]">{integration.name}</p>
              {connected && (
                <span
                  className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{ color: integration.color, backgroundColor: `${integration.color}15` }}
                >
                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: integration.color }} />
                  Connected
                </span>
              )}
            </div>
            <p className="text-xs text-[#4a4a6a]">{integration.description}</p>
          </div>
        </div>

        {connected ? (
          <div className="flex items-center gap-2">
            {/* Switch account */}
            <a
              href={integration.connectUrl}
              className="rounded-lg border border-[#1e1e2e] bg-[#0d0d16] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8888aa] transition-all hover:border-[#00d4aa]/30 hover:text-[#00d4aa]"
              title="Connect a different account"
            >
              Switch
            </a>
            {/* Disconnect */}
            {confirmDisconnect ? (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-[#8888aa]">Sure?</span>
                <button
                  onClick={handleDisconnect}
                  disabled={loading === "disconnect"}
                  className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-red-400 transition-all hover:bg-red-500/25 disabled:opacity-50"
                >
                  {loading === "disconnect" ? "…" : "Yes, disconnect"}
                </button>
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  className="rounded-lg border border-[#1e1e2e] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#4a4a6a] transition-all hover:text-[#8888aa]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleDisconnect}
                className="rounded-lg border border-[#1e1e2e] bg-[#0d0d16] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#4a4a6a] transition-all hover:border-red-500/30 hover:text-red-400"
              >
                Disconnect
              </button>
            )}
          </div>
        ) : (
          <a
            href={integration.connectUrl}
            className="rounded-xl border border-[#1e1e2e] bg-[#0d0d16] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#8888aa] transition-all hover:border-[#00d4aa]/30 hover:bg-[#0f1420] hover:text-[#00d4aa]"
          >
            Connect →
          </a>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function SettingsTab({ email, isPremium, connectedPlatforms }: SettingsTabProps) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  async function handlePortal() {
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPortalError(data.error ?? "Something went wrong.");
        setPortalLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setPortalError("Network error. Please try again.");
      setPortalLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="font-mono text-2xl font-bold text-[#f0f0f5]">Settings</h1>
        <p className="mt-1 text-sm text-[#8888aa]">Manage your account, integrations and subscription.</p>
      </div>

      {/* ── Account info ─────────────────────────────────── */}
      <section className="mb-6 rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/60 p-6">
        <h2 className="mb-4 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#4a4a6a]">
          Account
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00d4aa]/15 text-[#00d4aa] font-mono text-sm font-bold uppercase select-none">
              {email.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-[#f0f0f5]">{email}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#4a4a6a]">
                Email address
              </p>
            </div>
          </div>
          <div
            className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
              isPremium
                ? "border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]"
                : "border border-[#1e1e2e] bg-[#12121a] text-[#4a4a6a]"
            }`}
          >
            {isPremium ? "✦ Premium" : "Free"}
          </div>
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────── */}
      <section className="mb-6 rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/60 p-6">
        <h2 className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#4a4a6a]">
          Integrations
        </h2>
        <p className="mb-5 text-sm text-[#8888aa]">
          Connect your data sources. Data syncs automatically every night at 02:00 UTC.
        </p>

        <div className="flex flex-col gap-3">
          {INTEGRATIONS.map((integration) => (
            <IntegrationRow
              key={integration.id}
              integration={integration}
              connected={connectedPlatforms.includes(integration.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Subscription ─────────────────────────────────── */}
      <section className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/60 p-6">
        <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-[#4a4a6a]">
          Subscription
        </h2>

        {isPremium ? (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00d4aa]/20 bg-[#00d4aa]/10">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f0f0f5]">Premium Plan — Active</p>
                <p className="text-xs text-[#8888aa]">
                  Manage billing, change plan, or cancel via the Stripe portal.
                </p>
              </div>
            </div>

            {portalError && (
              <p className="mb-3 text-xs text-red-400">{portalError}</p>
            )}

            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-2 rounded-xl border border-[#1e1e2e] bg-[#12121a] px-5 py-3 text-sm font-semibold text-[#f0f0f5] transition-all hover:border-[#00d4aa]/30 hover:text-[#00d4aa] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {portalLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Opening portal…
                </>
              ) : (
                <>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  Manage Subscription
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-[#4a4a6a]">
              You&apos;ll be redirected to Stripe&apos;s secure billing portal.
            </p>
          </div>
        ) : (
          <div>
            <div className="rounded-xl border border-[#a78bfa]/15 bg-[#a78bfa]/5 p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#a78bfa]/10 text-[#a78bfa]">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#f0f0f5]">Upgrade to Premium</p>
                  <p className="mt-1 text-xs text-[#8888aa]">
                    Unlock analytics, AI advisor, website optimizer and all integrations.
                  </p>
                  <p className="mt-1 font-mono text-xs font-bold text-[#f0f0f5]">
                    $29<span className="font-normal text-[#4a4a6a]">/month</span>
                    <span className="ml-2 font-mono text-[9px] font-semibold text-[#00d4aa] bg-[#00d4aa]/10 px-2 py-0.5 rounded-full">3-day free trial</span>
                  </p>
                </div>
              </div>
            </div>
            <a
              href="/api/stripe/checkout"
              className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-5 py-2.5 font-mono text-sm font-bold text-[#0a0a0f] hover:bg-[#00bfa0] transition"
            >
              Start free trial →
            </a>
            <p className="mt-2 font-mono text-[10px] text-[#4a4a6a]">No card required during trial · Cancel anytime</p>
          </div>
        )}
      </section>
    </div>
  );
}


