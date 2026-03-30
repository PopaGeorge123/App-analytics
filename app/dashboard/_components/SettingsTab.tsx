"use client";

import { useState, useEffect } from "react";
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
        <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
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
    <div className="rounded-xl border border-[#363650] bg-[#222235] p-4 transition-all hover:border-[#454560]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: connected ? `${integration.color}18` : "#222235", color: connected ? integration.color : "#8585aa" }}
          >
            {integration.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#f8f8fc]">{integration.name}</p>
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
            <p className="text-xs text-[#8585aa]">{integration.description}</p>
          </div>
        </div>

        {connected ? (
          <div className="flex items-center gap-2">
            {/* Switch account */}
            <a
              href={integration.connectUrl}
              className="rounded-lg border border-[#363650] bg-[#1c1c2a] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-[#00d4aa]/30 hover:text-[#00d4aa]"
              title="Connect a different account"
            >
              Switch
            </a>
            {/* Disconnect */}
            {confirmDisconnect ? (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-[#bcbcd8]">Sure?</span>
                <button
                  onClick={handleDisconnect}
                  disabled={loading === "disconnect"}
                  className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-red-400 transition-all hover:bg-red-500/25 disabled:opacity-50"
                >
                  {loading === "disconnect" ? "…" : "Yes, disconnect"}
                </button>
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  className="rounded-lg border border-[#363650] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8585aa] transition-all hover:text-[#bcbcd8]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleDisconnect}
                className="rounded-lg border border-[#363650] bg-[#1c1c2a] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8585aa] transition-all hover:border-red-500/30 hover:text-red-400"
              >
                Disconnect
              </button>
            )}
          </div>
        ) : (
          <a
            href={integration.connectUrl}
            className="rounded-xl border border-[#363650] bg-[#1c1c2a] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-[#00d4aa]/30 hover:bg-[#0f1420] hover:text-[#00d4aa]"
          >
            Connect →
          </a>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Alert Rules ───────────────────────────────────────────────────────────

export interface AlertRules {
  revenueDropPct: number;  // alert if revenue drops by X% vs prev 7d (0 = disabled)
  bounceSpikeThreshold: number; // alert if bounce rate exceeds X% (0 = disabled)
  spendSpikeThreshold: number; // alert if ad spend > $X/day (0 = disabled)
}

export const DEFAULT_ALERTS: AlertRules = {
  revenueDropPct: 0,
  bounceSpikeThreshold: 0,
  spendSpikeThreshold: 0,
};

function AlertsSection() {
  const [rules, setRules] = useState<AlertRules>(DEFAULT_ALERTS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.alertRules) setRules(d.alertRules);
      })
      .catch(() => {});
  }, []);

  async function saveRules() {
    setSaving(true);
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertRules: rules }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function clearRules() {
    setRules(DEFAULT_ALERTS);
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertRules: DEFAULT_ALERTS }),
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#bcbcd8]">
        Get notified on your Overview dashboard when key metrics cross these thresholds.
      </p>

      <div className="space-y-3">
        {/* Revenue drop */}
        <div className="flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f87171]/10 text-[#f87171]">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[11px] font-semibold text-[#e0e0f0]">Revenue drop alert</p>
            <p className="font-mono text-[9px] text-[#8585aa]">Alert if 7d revenue drops by X% vs previous week</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              value={rules.revenueDropPct || ""}
              onChange={(e) => setRules((r) => ({ ...r, revenueDropPct: parseInt(e.target.value) || 0 }))}
              className="w-16 bg-[#1c1c2a] border border-[#363650] rounded-lg px-2 py-1.5 font-mono text-xs text-[#f8f8fc] text-right placeholder:text-[#58588a] focus:outline-none focus:border-[#00d4aa]/30"
            />
            <span className="font-mono text-[10px] text-[#8585aa]">%</span>
          </div>
        </div>

        {/* Bounce spike */}
        <div className="flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f59e0b]/10 text-[#f59e0b]">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[11px] font-semibold text-[#e0e0f0]">Bounce rate spike</p>
            <p className="font-mono text-[9px] text-[#8585aa]">Alert if 7d average bounce rate exceeds X%</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              value={rules.bounceSpikeThreshold || ""}
              onChange={(e) => setRules((r) => ({ ...r, bounceSpikeThreshold: parseInt(e.target.value) || 0 }))}
              className="w-16 bg-[#1c1c2a] border border-[#363650] rounded-lg px-2 py-1.5 font-mono text-xs text-[#f8f8fc] text-right placeholder:text-[#58588a] focus:outline-none focus:border-[#00d4aa]/30"
            />
            <span className="font-mono text-[10px] text-[#8585aa]">%</span>
          </div>
        </div>

        {/* Daily ad spend cap */}
        <div className="flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1877f2]/10 text-[#1877f2]">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[11px] font-semibold text-[#e0e0f0]">Ad spend cap</p>
            <p className="font-mono text-[9px] text-[#8585aa]">Alert if a single day&apos;s ad spend exceeds $X</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[10px] text-[#8585aa]">$</span>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={rules.spendSpikeThreshold || ""}
              onChange={(e) => setRules((r) => ({ ...r, spendSpikeThreshold: parseInt(e.target.value) || 0 }))}
              className="w-16 bg-[#1c1c2a] border border-[#363650] rounded-lg px-2 py-1.5 font-mono text-xs text-[#f8f8fc] text-right placeholder:text-[#58588a] focus:outline-none focus:border-[#00d4aa]/30"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={saveRules}
          disabled={saving}
          className="rounded-xl bg-[#00d4aa] px-5 py-2 font-mono text-xs font-bold text-[#13131f] hover:bg-[#00bfa0] transition disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save alert rules"}
        </button>
        {saved && <span className="font-mono text-[10px] text-[#00d4aa]">✓ Saved</span>}
        {(rules.revenueDropPct > 0 || rules.bounceSpikeThreshold > 0 || rules.spendSpikeThreshold > 0) && (
          <button
            onClick={clearRules}
            className="font-mono text-[10px] text-[#8585aa] hover:text-red-400 transition"
          >
            Clear all
          </button>
        )}
      </div>
      <p className="font-mono text-[9px] text-[#58588a]">
        Alert thresholds are saved to your account and checked on your Overview dashboard.
      </p>
    </div>
  );
}

// ── Email Digest Section ──────────────────────────────────────────────────

function DigestSection({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function sendDigest() {
    setSending(true);
    setStatus("idle");
    setErrorMsg("");
    try {
      const res = await fetch("/api/digest/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to send digest.");
        setStatus("error");
      } else {
        setStatus("sent");
      }
    } catch {
      setErrorMsg("Network error.");
      setStatus("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
      <h2 className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">
        Email Digest
      </h2>
      <p className="mb-4 text-sm text-[#bcbcd8]">
        Generate and send a full AI-powered weekly summary to <span className="text-[#e0e0f0]">{email}</span>. Includes revenue highlights, anomalies, cross-platform insights, and a top action.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={sendDigest}
          disabled={sending}
          className="flex items-center gap-2 rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-5 py-2.5 font-mono text-xs font-semibold text-[#00d4aa] hover:bg-[#00d4aa]/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {sending ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating &amp; Sending…
            </>
          ) : (
            <>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send digest now
            </>
          )}
        </button>
        {status === "sent" && <span className="font-mono text-[11px] text-[#00d4aa]">✓ Digest sent to {email}</span>}
        {status === "error" && <span className="font-mono text-[11px] text-red-400">{errorMsg}</span>}
      </div>
      <p className="mt-3 font-mono text-[9px] text-[#58588a]">
        Tip: Set up automated weekly sends via your cron script.
      </p>
    </section>
  );
}

export default function SettingsTab({ email, isPremium, connectedPlatforms }: SettingsTabProps) {
  const router = useRouter();
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
        <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">Settings</h1>
        <p className="mt-1 text-sm text-[#bcbcd8]">Manage your account, integrations and subscription.</p>
      </div>

      {/* ── Account info ─────────────────────────────────── */}
      <section className="mb-6 rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
        <h2 className="mb-4 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">
          Account
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00d4aa]/15 text-[#00d4aa] font-mono text-sm font-bold uppercase select-none">
              {email.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-[#f8f8fc]">{email}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8585aa]">
                Email address
              </p>
            </div>
          </div>
          <div
            className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
              isPremium
                ? "border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]"
                : "border border-[#363650] bg-[#222235] text-[#8585aa]"
            }`}
          >
            {isPremium ? "✦ Premium" : "Free"}
          </div>
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────── */}
      <section className="mb-6 rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
        <h2 className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">
          Integrations
        </h2>
        <p className="mb-5 text-sm text-[#bcbcd8]">
          Connect your data sources. Data syncs automatically every day — you can also trigger a manual sync anytime from the Overview tab.
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

      {/* ── Alert rules ──────────────────────────────────── */}
      {isPremium && (
        <section className="mb-6 rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
          <h2 className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">
            Alert Rules
          </h2>
          <AlertsSection />
        </section>
      )}

      {/* ── Email digest ─────────────────────────────────── */}
      {isPremium && <DigestSection email={email} />}

      {/* ── Subscription ─────────────────────────────────── */}
      <section className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
        <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa]">
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
                <p className="text-sm font-semibold text-[#f8f8fc]">Premium Plan — Active</p>
                <p className="text-xs text-[#bcbcd8]">
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
              className="flex items-center gap-2 rounded-xl border border-[#363650] bg-[#222235] px-5 py-3 text-sm font-semibold text-[#f8f8fc] transition-all hover:border-[#00d4aa]/30 hover:text-[#00d4aa] disabled:opacity-60 disabled:cursor-not-allowed"
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
            <p className="mt-2 text-xs text-[#8585aa]">
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
                  <p className="text-sm font-semibold text-[#f8f8fc]">Upgrade to Premium</p>
                  <p className="mt-1 text-xs text-[#bcbcd8]">
                    Unlock analytics, AI advisor, website optimizer and all integrations.
                  </p>
                  <p className="mt-1 font-mono text-xs font-bold text-[#f8f8fc]">
                    $29<span className="font-normal text-[#8585aa]">/month</span>
                    <span className="ml-2 font-mono text-[9px] font-semibold text-[#00d4aa] bg-[#00d4aa]/10 px-2 py-0.5 rounded-full">3-day free trial</span>
                  </p>
                </div>
              </div>
            </div>
            <a
              href="/api/stripe/checkout"
              className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-5 py-2.5 font-mono text-sm font-bold text-[#13131f] hover:bg-[#00bfa0] transition"
            >
              Start free trial →
            </a>
            <p className="mt-2 font-mono text-[10px] text-[#8585aa]">No card required during trial · Cancel anytime</p>
          </div>
        )}
      </section>
    </div>
  );
}


