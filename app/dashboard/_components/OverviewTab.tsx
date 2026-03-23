"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Snapshot } from "./DashboardShell";

interface OverviewTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

// Filter snapshots to last N days client-side (dashboard fetches 30d for Analytics)
function last7Days(snaps: Snapshot[]): Snapshot[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return snaps.filter((s) => s.date >= cutoffStr);
}

function sumField(snaps: Snapshot[], provider: string, field: string): number {
  return snaps
    .filter((s) => s.provider === provider)
    .reduce((acc, s) => {
      const d = s.data as Record<string, number>;
      return acc + (d[field] ?? 0);
    }, 0);
}

function avgField(snaps: Snapshot[], provider: string, field: string): number {
  const rows = snaps.filter((s) => s.provider === provider);
  if (!rows.length) return 0;
  const total = rows.reduce((acc, s) => {
    const d = s.data as Record<string, number>;
    return acc + (d[field] ?? 0);
  }, 0);
  return total / rows.length;
}

function fmt(n: number, type: "currency" | "number" | "percent" = "number"): string {
  if (type === "currency") {
    if (n >= 100000) return `$${(n / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    return `$${(n / 100).toFixed(2)}`;
  }
  if (type === "percent") return `${n.toFixed(1)}%`;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function trendIcon(current: number, prev: number) {
  if (!prev || current === prev) return null;
  const pct = (((current - prev) / prev) * 100).toFixed(1);
  const up = current > prev;
  return (
    <span className={`flex items-center gap-1 font-mono text-[10px] ${up ? "text-[#00d4aa]" : "text-red-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(Number(pct))}%
    </span>
  );
}

// ── Integration connect card ───────────────────────────────────────────────

const INTEGRATIONS = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Revenue, customers & refunds",
    connectUrl: "/api/auth/stripe/url",
    color: "#635bff",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    ),
  },
  {
    id: "ga4",
    name: "Google Analytics",
    description: "Sessions, users & conversions",
    connectUrl: "/api/auth/google/url",
    color: "#f59e0b",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Ad spend, reach & conversions",
    connectUrl: "/api/auth/meta/url",
    color: "#1877f2",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────

export default function OverviewTab({ email, isPremium, connectedPlatforms, snapshots }: OverviewTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpgrade() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      router.push(data.url);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  // ── Compute metrics from snapshots (last 7 days only) ──────────────────
  const metrics = useMemo(() => {
    const snaps7 = last7Days(snapshots);
    const revenue = sumField(snaps7, "stripe", "revenue");
    const sessions = sumField(snaps7, "ga4", "sessions");
    const adSpend = sumField(snaps7, "meta", "spend");
    const newCustomers = sumField(snaps7, "stripe", "newCustomers");
    const cac = newCustomers > 0 ? adSpend / newCustomers : null;
    const bounceRate = avgField(snaps7, "ga4", "bounceRate");
    const conversions = sumField(snaps7, "ga4", "conversions");

    return [
      {
        label: "Revenue (7d)",
        value: connectedPlatforms.includes("stripe") ? fmt(revenue, "currency") : null,
        sub: connectedPlatforms.includes("stripe") ? `${sumField(snaps7, "stripe", "txCount")} transactions` : null,
      },
      {
        label: "Sessions (7d)",
        value: connectedPlatforms.includes("ga4") ? fmt(sessions) : null,
        sub: connectedPlatforms.includes("ga4") ? `${fmt(conversions)} conversions` : null,
      },
      {
        label: "Ad Spend (7d)",
        value: connectedPlatforms.includes("meta") ? `$${adSpend.toFixed(2)}` : null,
        sub: connectedPlatforms.includes("meta") ? `${fmt(sumField(snaps7, "meta", "clicks"))} clicks` : null,
      },
      {
        label: "CAC",
        value: connectedPlatforms.includes("meta") && connectedPlatforms.includes("stripe") && cac !== null
          ? `$${cac.toFixed(2)}`
          : null,
        sub: connectedPlatforms.includes("meta") && connectedPlatforms.includes("stripe") && cac !== null
          ? "ad spend / new customer"
          : null,
      },
    ];
  }, [snapshots, connectedPlatforms]);

  const hasAnyIntegration = connectedPlatforms.length > 0;
  const hasAllIntegrations = ["stripe", "ga4", "meta"].every((p) => connectedPlatforms.includes(p));

  return (
    <div className="max-w-4xl">
      {/* Page title */}
      <div className="mb-8">
        <h1 className="font-mono text-2xl font-bold text-[#f0f0f5]">Overview</h1>
        <p className="mt-1 text-sm text-[#8888aa]">
          Welcome back, <span className="text-[#f0f0f5]">{email}</span>
        </p>
      </div>

      {/* Premium upgrade banner */}
      {!isPremium && (
        <div className="mb-8 rounded-2xl border border-[#00d4aa]/25 bg-[#00d4aa]/5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa] mb-1">
                ✦ Upgrade to Premium
              </p>
              <p className="text-sm text-[#8888aa] max-w-sm">
                Unlock AI digests, anomaly detection, and full analytics across all integrations.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="whitespace-nowrap rounded-xl bg-[#00d4aa] px-6 py-3 font-semibold text-sm text-[#0a0a0f] transition-all hover:bg-[#00bfa0] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Redirecting…
                  </>
                ) : "Upgrade to Premium →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPremium && (
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-4 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">
            Premium — Active
          </span>
        </div>
      )}

      {/* ── Metric tiles ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[#4a4a6a]">
              {m.label}
            </p>
            {m.value !== null ? (
              <>
                <p className="font-mono text-2xl font-bold text-[#f0f0f5]">{m.value}</p>
                <p className="mt-1 font-mono text-[10px] text-[#4a4a6a]">{m.sub}</p>
              </>
            ) : (
              <>
                <p className="font-mono text-2xl font-bold text-[#2a2a4a]">—</p>
                <p className="mt-1 font-mono text-[10px] text-[#2a2a4a]">Not connected</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Integrations ─────────────────────────────────── */}
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/60 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#4a4a6a]">
              Integrations
            </p>
            <p className="mt-1 text-sm text-[#8888aa]">
              {hasAllIntegrations
                ? "All integrations connected. Data syncs daily at 02:00 UTC."
                : "Connect your tools to start seeing real data."}
            </p>
          </div>
          {hasAnyIntegration && (
            <span className="font-mono text-[10px] text-[#4a4a6a]">
              {connectedPlatforms.length}/3 connected
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {INTEGRATIONS.map((integration) => {
            const connected = connectedPlatforms.includes(integration.id);
            return (
              <div
                key={integration.id}
                className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
                  connected
                    ? "border-[#1e1e2e] bg-[#12121a]"
                    : "border-[#1e1e2e] bg-[#0d0d16]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${integration.color}18`, color: integration.color }}
                  >
                    {integration.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#f0f0f5]">{integration.name}</p>
                    <p className="text-xs text-[#4a4a6a]">{integration.description}</p>
                  </div>
                </div>

                {connected ? (
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa]" />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#00d4aa]">
                      Connected
                    </span>
                  </div>
                ) : (
                  <a
                    href={integration.connectUrl}
                    className="rounded-lg border border-[#1e1e2e] bg-[#12121a] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#8888aa] transition-all hover:border-[#00d4aa]/30 hover:text-[#00d4aa]"
                  >
                    Connect →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
