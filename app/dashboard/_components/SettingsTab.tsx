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
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    description: "Sessions, users, bounce rate & conversions",
    connectUrl: "/api/auth/google/url",
    color: "#f59e0b",
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Ad spend, reach, clicks & conversions",
    connectUrl: "/api/auth/meta/url",
    color: "#1877f2",
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
    <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: connected ? "#00d4aa" : "#2a2a4a" }}
          />
          <div>
            <p className="text-sm font-semibold text-[#f0f0f5]">{integration.name}</p>
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
            className="rounded-lg border border-[#1e1e2e] bg-[#0d0d16] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#8888aa] transition-all hover:border-[#00d4aa]/30 hover:text-[#00d4aa]"
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
        <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-[#4a4a6a]">
          Account
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#f0f0f5]">{email}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#4a4a6a]">
              Email address
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
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
        <h2 className="mb-1 font-mono text-xs font-semibold uppercase tracking-widest text-[#4a4a6a]">
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
            <p className="mb-4 text-sm text-[#8888aa]">
              You&apos;re on the <span className="text-[#f0f0f5] font-medium">Free</span> plan.
              Upgrade to Premium to unlock all features.
            </p>
            <p className="text-xs text-[#4a4a6a]">
              Use the <span className="text-[#00d4aa]">Upgrade to Premium</span> button on the
              Overview tab to subscribe.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}


