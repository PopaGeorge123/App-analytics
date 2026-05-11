"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LIVE_INTEGRATIONS, INTEGRATION_CATEGORIES, SOON_INTEGRATIONS } from "@/lib/integrations/catalog";

const REVENUE_PROVIDERS_LOCAL = ["stripe", "lemon-squeezy", "paddle", "shopify", "woocommerce", "gumroad"];
const ADS_PROVIDERS_LOCAL = ["meta", "google-ads", "tiktok-ads"];

interface SettingsTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  currencies: Record<string, string>;
}

const UI_INTEGRATIONS = LIVE_INTEGRATIONS.map((cat) => ({
  id: cat.id,
  name: cat.name,
  description: cat.description,
  connectUrl: cat.connectUrl || "",
  color: cat.color,
  icon: (
    <img src={cat.icon} alt={cat.name} width={14} height={14} className="object-contain" />
  ),
  category: cat.category,
}));

const PARAM_REQUIRED: Record<string, { param: string; label: string; placeholder: string }> = {
  shopify: { param: "shop", label: "Store domain", placeholder: "yourstore.myshopify.com" },
  zendesk: { param: "subdomain", label: "Zendesk subdomain", placeholder: "yourcompany (from yourcompany.zendesk.com)" },
  freshdesk: { param: "subdomain", label: "Freshdesk subdomain", placeholder: "yourcompany (from yourcompany.freshdesk.com)" },
};

// ── Toggle component ──────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  color = "#10b981",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
      style={{ backgroundColor: checked ? color : "#2a2a3a" }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="h-3.5 w-0.5 rounded-full" style={{ backgroundColor: color }} />
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color }}>
        {children}
      </p>
    </div>
  );
}

// ── Coming Soon ───────────────────────────────────────────────────────────

function ComingSoonSection() {
  const [notified, setNotified] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function handleNotify(integrationId: string) {
    if (notified[integrationId] || loading) return;
    setLoading(integrationId);
    try {
      const res = await fetch("/api/notify-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_id: integrationId }),
      });
      if (res.ok) setNotified((prev) => ({ ...prev, [integrationId]: true }));
    } catch {}
    finally { setLoading(null); }
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {SOON_INTEGRATIONS.map((intg) => (
        <div key={intg.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: intg.color + "18" }}>
            <img src={intg.icon} alt={intg.name} width={14} height={14} className="object-contain opacity-50" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#bcbcd8] truncate">{intg.name}</p>
            <p className="font-mono text-[9px] text-[#58588a] truncate">{intg.category}</p>
          </div>
          <button
            onClick={() => handleNotify(intg.id)}
            disabled={!!notified[intg.id] || loading === intg.id}
            className={`shrink-0 font-mono text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
              notified[intg.id]
                ? "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981] cursor-default"
                : "border-white/10 text-[#8585aa] hover:border-[#6366f1]/40 hover:text-[#6366f1] hover:bg-[#6366f1]/5"
            } disabled:opacity-60`}
          >
            {loading === intg.id ? "…" : notified[intg.id] ? (
              <span className="flex items-center gap-1">
                <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Noted
              </span>
            ) : "Notify me"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Integration Row ───────────────────────────────────────────────────────

function IntegrationRow({
  integration,
  connected,
}: {
  integration: (typeof UI_INTEGRATIONS)[number];
  connected: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"disconnect" | "sync" | null>(null);
  const [error, setError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [paramValue, setParamValue] = useState("");
  const [showParamInput, setShowParamInput] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const paramConfig = PARAM_REQUIRED[integration.id];

  function handleConnectClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!paramConfig) return;
    e.preventDefault();
    setShowParamInput(true);
    setError("");
  }

  function handleParamSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = paramValue.trim();
    if (!val) { setError(`Please enter your ${paramConfig.label.toLowerCase()}.`); return; }
    let finalVal = val;
    if (integration.id === "shopify" && !val.includes(".")) finalVal = `${val}.myshopify.com`;
    window.location.href = `${integration.connectUrl}?${paramConfig.param}=${encodeURIComponent(finalVal)}`;
  }

  async function handleSync() {
    setLoading("sync");
    try {
      await fetch(`/api/integrations/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: integration.id }),
      });
      router.refresh();
    } catch {}
    finally { setLoading(null); }
  }

  async function handleDisconnect() {
    if (!confirmDisconnect) { setConfirmDisconnect(true); return; }
    setLoading("disconnect");
    setError("");
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: integration.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to disconnect."); setLoading(null); return; }
      router.refresh();
    } catch {
      setError("Network error.");
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#13131a] p-4 transition-all hover:border-white/10">
      <div className="flex items-start justify-between gap-3">
        {/* Left: icon + info */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5"
            style={{ backgroundColor: connected ? `${integration.color}18` : "#1e1e28", color: connected ? integration.color : "#58588a" }}
          >
            {integration.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="text-sm font-semibold text-[#f8f8fc] cursor-default"
                onMouseEnter={() => !connected && setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                {integration.name}
              </p>
              {connected ? (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: "#10b981", backgroundColor: "#10b98118" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                  Connected · Last sync: 2h ago
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] text-[#58588a]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#58588a]" />
                  Not connected
                </span>
              )}
            </div>
            <p className="text-xs text-[#8585aa] mt-0.5">{integration.description}</p>
            {/* Tooltip */}
            {showTooltip && !connected && (
              <div className="mt-1.5 rounded-lg border border-[#14b8a6]/20 bg-[#14b8a6]/5 px-2.5 py-1.5">
                <p className="font-mono text-[9px] text-[#14b8a6]">
                  Unlocks data from {integration.name} in your Overview & AI Advisor
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: actions */}
        {connected ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleSync}
              disabled={loading === "sync"}
              title="Sync now"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-white/[0.06] text-[#58588a] hover:text-[#14b8a6] hover:border-[#14b8a6]/30 transition-all disabled:opacity-50"
            >
              {loading === "sync" ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                </svg>
              )}
            </button>
            <a
              href={integration.connectUrl}
              onClick={handleConnectClick}
              className="rounded-lg border border-white/[0.06] bg-[#0d0d0f] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-[#6366f1]/30 hover:text-[#6366f1]"
            >
              Switch
            </a>
            {confirmDisconnect ? (
              <div className="flex items-center gap-1">
                <span className="font-mono text-[10px] text-[#bcbcd8]">Sure?</span>
                <button onClick={handleDisconnect} disabled={loading === "disconnect"} className="rounded-lg bg-red-500/15 border border-red-500/30 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-red-400 hover:bg-red-500/25 disabled:opacity-50 transition-all">
                  {loading === "disconnect" ? "…" : "Yes"}
                </button>
                <button onClick={() => setConfirmDisconnect(false)} className="rounded-lg border border-white/[0.06] px-2.5 py-1.5 font-mono text-[10px] text-[#8585aa] hover:text-[#bcbcd8] transition-all">
                  No
                </button>
              </div>
            ) : (
              <button onClick={handleDisconnect} className="rounded-lg border border-white/[0.06] bg-[#0d0d0f] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8585aa] transition-all hover:border-red-500/30 hover:text-red-400">
                Disconnect
              </button>
            )}
          </div>
        ) : (
          <a
            href={integration.connectUrl}
            onClick={handleConnectClick}
            className="shrink-0 rounded-xl border border-white/[0.06] bg-[#0d0d0f] px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-[#6366f1]/30 hover:text-[#6366f1]"
          >
            Connect
          </a>
        )}
      </div>

      {/* Inline param input */}
      {showParamInput && paramConfig && (
        <form onSubmit={handleParamSubmit} className="mt-3 flex items-center gap-2">
          <input
            autoFocus type="text" value={paramValue}
            onChange={(e) => { setParamValue(e.target.value); setError(""); }}
            placeholder={paramConfig.placeholder}
            className="flex-1 rounded-lg border border-white/[0.06] bg-[#0d0d0f] px-3 py-2 font-mono text-xs text-[#f8f8fc] placeholder-[#58588a] outline-none focus:border-[#6366f1]/50 focus:ring-1 focus:ring-[#6366f1]/20"
          />
          <button type="submit" className="rounded-lg border border-[#6366f1]/30 bg-[#6366f1]/10 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6366f1] hover:bg-[#6366f1]/20 transition-all">Go</button>
          <button type="button" onClick={() => { setShowParamInput(false); setParamValue(""); setError(""); }} className="rounded-lg border border-white/[0.06] px-3 py-2 font-mono text-[10px] font-semibold text-[#8585aa] hover:text-[#bcbcd8] transition-all">Cancel</button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Alert Rules ───────────────────────────────────────────────────────────

export interface AlertRules {
  revenueDropPct: number;
  bounceSpikeThreshold: number;
  spendSpikeThreshold: number;
  newCustomerAlert: boolean;
}

export const DEFAULT_ALERTS: AlertRules = {
  revenueDropPct: 0,
  bounceSpikeThreshold: 0,
  spendSpikeThreshold: 0,
  newCustomerAlert: false,
};

function AlertsSection({ email, currencies }: { email: string; currencies: Record<string, string> }) {
  const [rules, setRules] = useState<AlertRules>(DEFAULT_ALERTS);
  const [toggles, setToggles] = useState({ revenue: false, bounce: false, spend: false });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const revCurrencyForAlerts = REVENUE_PROVIDERS_LOCAL.map((p) => currencies[p]).find(Boolean);
  const adsCurrency = ADS_PROVIDERS_LOCAL.map((p) => currencies[p]).find(Boolean) ?? revCurrencyForAlerts ?? "USD";

  useEffect(() => {
    fetch("/api/user/settings").then((r) => r.json()).then((d) => {
      if (d.alertRules) {
        setRules({ ...DEFAULT_ALERTS, ...d.alertRules });
        setToggles({
          revenue: (d.alertRules.revenueDropPct ?? 0) > 0,
          bounce: (d.alertRules.bounceSpikeThreshold ?? 0) > 0,
          spend: (d.alertRules.spendSpikeThreshold ?? 0) > 0,
        });
      }
      if (d.alertRulesLastSaved) setLastSaved(d.alertRulesLastSaved);
    }).catch(() => {});
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
      setLastSaved(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }));
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  async function clearRules() {
    setRules(DEFAULT_ALERTS);
    setToggles({ revenue: false, bounce: false, spend: false });
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertRules: DEFAULT_ALERTS }),
    });
  }

  const alertRows = [
    {
      key: "revenueDropPct" as keyof AlertRules,
      toggleKey: "revenue" as const,
      label: "Revenue drop alert",
      desc: "Alert if 7-day revenue drops by X% vs previous week",
      unit: "%",
      unitPos: "right" as const,
      suggestion: "Suggested: 20% for early-stage founders",
      iconColor: "#ef4444",
      icon: (
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
        </svg>
      ),
    },
    {
      key: "bounceSpikeThreshold" as keyof AlertRules,
      toggleKey: "bounce" as const,
      label: "Bounce rate spike",
      desc: "Alert if 7-day average bounce rate exceeds X%",
      unit: "%",
      unitPos: "right" as const,
      suggestion: "Suggested: 70% — typical healthy sites stay under 60%",
      iconColor: "#f59e0b",
      icon: (
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
      ),
    },
    {
      key: "spendSpikeThreshold" as keyof AlertRules,
      toggleKey: "spend" as const,
      label: "Ad spend cap",
      desc: `Alert if a single day's ad spend exceeds ${adsCurrency} X`,
      unit: adsCurrency,
      unitPos: "left" as const,
      suggestion: "Suggested: set to your daily budget × 1.3 as a safety net",
      iconColor: "#f97316",
      icon: (
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Delivery note */}
      <div className="flex items-center gap-2 rounded-lg border border-[#3b82f6]/20 bg-[#3b82f6]/5 px-3 py-2">
        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="font-mono text-[10px] text-[#93c5fd]">Alerts delivered to: <span className="text-[#bfdbfe]">{email}</span></p>
      </div>

      {/* Alert rows */}
      <div className="space-y-3">
        {alertRows.map((row) => {
          const isOn = toggles[row.toggleKey];
          const val = rules[row.key] as number;
          const isZero = val === 0;
          return (
            <div key={row.key} className="rounded-xl border border-white/[0.06] bg-[#13131a] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${row.iconColor}15`, color: row.iconColor }}>
                  {row.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#e0e0f0]">{row.label}</p>
                  <p className="font-mono text-[9px] text-[#8585aa]">{row.desc}</p>
                </div>
                {/* Toggle */}
                <Toggle
                  checked={isOn}
                  onChange={(v) => setToggles((t) => ({ ...t, [row.toggleKey]: v }))}
                  color="#10b981"
                />
              </div>
              {isOn && (
                <div className="border-t border-white/[0.04] px-4 py-3 bg-[#0d0d0f]/40 space-y-2">
                  <div className="flex items-center gap-2">
                    {row.unitPos === "left" && <span className="font-mono text-[10px] text-[#8585aa] w-8">{row.unit}</span>}
                    <input
                      type="number" min={0} max={row.unit === "%" ? 100 : undefined}
                      placeholder="0"
                      value={val || ""}
                      onChange={(e) => setRules((r) => ({ ...r, [row.key]: parseInt(e.target.value) || 0 }))}
                      className="w-24 rounded-lg border border-white/[0.06] bg-[#13131a] px-3 py-1.5 font-mono text-xs text-[#f8f8fc] text-right placeholder:text-[#58588a] focus:outline-none focus:border-[#6366f1]/40 focus:ring-1 focus:ring-[#6366f1]/20 transition-colors"
                    />
                    {row.unitPos === "right" && <span className="font-mono text-[10px] text-[#8585aa]">{row.unit}</span>}
                  </div>
                  {isOn && isZero && (
                    <p className="font-mono text-[10px] text-[#f59e0b] flex items-center gap-1">
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      Set to 0 — alert is disabled. Enter a value to enable.
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-[#58588a]">{row.suggestion}</p>
                </div>
              )}
            </div>
          );
        })}

        {/* New customer alert */}
        <div className="rounded-xl border border-white/[0.06] bg-[#13131a] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#10b981]/10 text-[#10b981]">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                <line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#e0e0f0]">New customer alert</p>
              <p className="font-mono text-[9px] text-[#8585aa]">Notify me every time I get a new paying customer</p>
            </div>
            <Toggle
              checked={rules.newCustomerAlert}
              onChange={(v) => setRules((r) => ({ ...r, newCustomerAlert: v }))}
              color="#10b981"
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={saveRules} disabled={saving}
          className="rounded-xl bg-[#10b981] px-5 py-2 font-mono text-xs font-bold text-white hover:bg-[#059669] transition disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save alerts"}
        </button>
        {saved && (
          <span className="font-mono text-[10px] text-[#10b981] flex items-center gap-1">
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Saved
          </span>
        )}
        <button onClick={clearRules} className="font-mono text-[10px] text-[#8585aa] hover:text-red-400 transition ml-auto">
          Clear all
        </button>
      </div>
      <div className="flex items-center gap-3">
        <p className="font-mono text-[9px] text-[#58588a]">
          Alert thresholds are tied to your account and checked nightly.
        </p>
        {lastSaved && <p className="font-mono text-[9px] text-[#58588a]">Last saved: {lastSaved}</p>}
        {!lastSaved && <p className="font-mono text-[9px] text-[#f59e0b]">Last saved: never</p>}
      </div>
    </div>
  );
}

// ── Share Dashboard ───────────────────────────────────────────────────────

interface ShareLink {
  token: string;
  label: string;
  expires_at: string;
  view_count: number;
  created_at: string;
}

function ShareSection() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function fetchLinks() {
    try {
      const res = await fetch("/api/dashboard/share");
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { fetchLinks(); }, []);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/share", { method: "POST" });
      if (!res.ok) { setError("Failed to generate link."); return; }
      const data = await res.json();
      await navigator.clipboard.writeText(data.url.startsWith("http") ? data.url : `${window.location.origin}${data.url}`);
      await fetchLinks();
      setCopied(data.token);
      setTimeout(() => setCopied(null), 2500);
    } catch { setError("Something went wrong."); }
    finally { setGenerating(false); }
  }

  async function revoke(token: string) {
    setRevoking(token);
    try {
      await fetch(`/api/dashboard/share?token=${token}`, { method: "DELETE" });
      setLinks((prev) => prev.filter((l) => l.token !== token));
    } catch {}
    finally { setRevoking(null); }
  }

  async function copy(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  function daysLeft(exp: string) {
    const d = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
    return d <= 0 ? "Expired" : `${d}d left`;
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] text-[#8585aa] leading-relaxed">
        Generate a read-only link to share your dashboard snapshot with investors, teammates, or clients. Links expire in 7 days.
      </p>

      <button
        onClick={generate}
        disabled={generating || links.length >= 5}
        className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 font-mono text-xs font-bold text-white hover:bg-[#4f46e5] disabled:opacity-60 transition"
      >
        {generating ? (
          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
        ) : (
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        )}
        {generating ? "Generating…" : "Generate shareable link"}
      </button>
      {links.length >= 5 && (
        <p className="font-mono text-[9px] text-[#f59e0b]">Max 5 active links. Revoke one to create another.</p>
      )}
      {error && <p className="font-mono text-[9px] text-red-400">{error}</p>}

      {loading ? (
        <p className="font-mono text-[10px] text-[#58588a]">Loading links…</p>
      ) : links.length === 0 ? (
        <p className="font-mono text-[10px] text-[#58588a]">No active share links.</p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.token} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0d0d0f] px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[10px] text-[#e0e0f0] truncate">/share/{link.token}</p>
                <p className="font-mono text-[9px] text-[#58588a] mt-0.5">
                  {daysLeft(link.expires_at)} · {link.view_count} view{link.view_count !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => copy(link.token)}
                className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 font-mono text-[9px] text-[#8585aa] hover:text-[#f8f8fc] transition"
              >
                {copied === link.token ? (
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                )}
                {copied === link.token ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => revoke(link.token)}
                disabled={revoking === link.token}
                className="rounded-lg border border-red-500/20 px-2.5 py-1.5 font-mono text-[9px] text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition disabled:opacity-50"
              >
                {revoking === link.token ? "…" : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Email Digest ──────────────────────────────────────────────────────────

function DigestSectionInline({ email }: { email: string }) {
  const [subscribed, setSubscribed] = useState(false);
  const [digestFrequency, setDigestFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [digestDay, setDigestDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState("");
  const [lastSent, setLastSent] = useState<string | null>(null);

  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  useEffect(() => {
    fetch("/api/user/settings").then((r) => r.json()).then((d) => {
      if (typeof d.digestSubscribed === "boolean") setSubscribed(d.digestSubscribed);
      if (typeof d.digestDay === "number") setDigestDay(d.digestDay);
      if (d.digestFrequency) setDigestFrequency(d.digestFrequency);
      if (d.digestLastSent) setLastSent(d.digestLastSent);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function savePrefs(nextSubscribed: boolean, nextDay: number, nextFreq: string) {
    setSaving(true);
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestSubscribed: nextSubscribed, digestDay: nextDay, digestFrequency: nextFreq }),
      });
    } finally { setSaving(false); }
  }

  async function sendDigest() {
    setSending(true);
    setSendStatus("idle");
    setSendError("");
    try {
      const res = await fetch("/api/digest/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setSendError(data.error ?? "Failed to send digest."); setSendStatus("error"); }
      else { setSendStatus("sent"); setLastSent("Just now"); }
    } catch {
      setSendError("Network error.");
      setSendStatus("error");
    } finally { setSending(false); }
  }

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-[#13131a]" />;

  return (
    <div className="space-y-4">
      {/* Sample preview card */}
      {/* <div className="rounded-xl border border-[#3b82f6]/20 bg-[#3b82f6]/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg width="13" height="13" fill="#3b82f6" viewBox="0 0 24 24">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="font-mono text-[10px] font-semibold text-[#93c5fd]">Sample digest preview</p>
        </div>
        <div className="border-t border-[#3b82f6]/10 pt-3 space-y-1">
          <p className="font-mono text-[10px] text-[#8585aa]">Week of May 5–11, 2026</p>
          <p className="font-mono text-[11px] text-[#bfdbfe]">Revenue: $20 · Sessions: 52 · Top insight: Fix GA4 tracking</p>
        </div>
        <button className="mt-3 font-mono text-[10px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors">
          View full sample →
        </button>
      </div> */}

      {/* Toggle */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#13131a] px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-[#f8f8fc]">Email digest</p>
          <p className="mt-0.5 font-mono text-[10px] text-[#8585aa]">
            {subscribed
              ? digestFrequency === "daily"
                ? `Delivered every day to ${email}`
                : digestFrequency === "monthly"
                ? `Delivered on day ${digestDay} of each month to ${email}`
                : `Delivered every ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][digestDay]} to ${email}`
              : "Disabled — no automatic emails"}
          </p>
        </div>
        <Toggle checked={subscribed} onChange={(v) => { setSubscribed(v); savePrefs(v, digestDay, digestFrequency); }} disabled={saving} color="#3b82f6" />
      </div>

      {subscribed && (
        <>
          {/* Frequency selector */}
          <div className="rounded-xl border border-white/[0.06] bg-[#13131a] px-4 py-3 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">Frequency</p>
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    // Reset digestDay to sensible default when switching frequency
                    const newDay = f === "monthly" ? Math.min(digestDay > 28 ? 1 : digestDay || 1, 28) : f === "weekly" ? (digestDay > 6 ? 1 : digestDay) : digestDay;
                    setDigestFrequency(f);
                    setDigestDay(newDay);
                    savePrefs(subscribed, newDay, f);
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 font-mono text-[11px] font-semibold border transition-all ${
                    digestFrequency === f
                      ? "border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6]"
                      : "border-white/[0.06] text-[#8585aa] hover:text-[#bcbcd8] hover:border-white/10"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {digestFrequency === "weekly" && (
              <div className="flex gap-1.5 flex-wrap">
                {DOW_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => { setDigestDay(i); savePrefs(subscribed, i, digestFrequency); }}
                    className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition-all ${
                      digestDay === i
                        ? "bg-[#3b82f6]/15 border border-[#3b82f6]/40 text-[#3b82f6]"
                        : "border border-white/[0.06] text-[#8585aa] hover:text-[#bcbcd8]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {digestFrequency === "monthly" && (
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] text-[#8585aa]">Day of month</p>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <button
                      key={d}
                      onClick={() => { setDigestDay(d); savePrefs(subscribed, d, digestFrequency); }}
                      className={`rounded-lg w-8 h-8 font-mono text-[11px] font-semibold transition-all ${
                        digestDay === d
                          ? "bg-[#3b82f6]/15 border border-[#3b82f6]/40 text-[#3b82f6]"
                          : "border border-white/[0.06] text-[#8585aa] hover:text-[#bcbcd8]"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Includes */}
          <div className="rounded-xl border border-white/[0.06] bg-[#13131a] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] mb-3">Includes</p>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
              {["Revenue highlights", "Anomaly alerts", "Cross-platform insights", "Top action for the week"].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <p className="font-mono text-[10px] text-[#bcbcd8]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Send now */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={sendDigest} disabled={sending}
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#13131a] px-4 py-2 font-mono text-xs text-[#8585aa] hover:text-[#bcbcd8] hover:border-white/10 disabled:opacity-50 transition-all"
        >
          {sending ? (
            <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Generating &amp; Sending…</>
          ) : (
            <><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Send digest now</>
          )}
        </button>
        {sendStatus === "sent" && <span className="font-mono text-[11px] text-[#10b981]">✓ Sent to {email}</span>}
        {sendStatus === "error" && <span className="font-mono text-[11px] text-red-400">{sendError}</span>}
      </div>
      <p className="font-mono text-[9px] text-[#58588a]">
        Last sent: <span className={lastSent ? "text-[#bcbcd8]" : "text-[#f59e0b]"}>{lastSent ?? "Never"}</span>
      </p>
    </div>
  );
}

// ── Newsletter Section ────────────────────────────────────────────────────

function NewsletterToggle() {
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings").then((r) => r.json()).then((d) => {
      if (typeof d.newsletterEmails === "boolean") setEnabled(d.newsletterEmails);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function toggle(next: boolean) {
    setEnabled(next);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterEmails: next }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  return (
    <div className={`flex items-start justify-between gap-4 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#f8f8fc]">Newsletter &amp; product updates</p>
        <p className="mt-1 text-xs text-[#8585aa]">
          Tips, new integrations, and product updates. Transactional emails (digest, alerts) are always delivered regardless.
        </p>
        {saving && <p className="mt-1 font-mono text-[10px] text-[#58588a]">Saving…</p>}
        {saved && !saving && (
          <p className="mt-1 font-mono text-[10px] text-[#10b981] flex items-center gap-1">
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Saved
          </p>
        )}
        {!enabled && !saving && !saved && <p className="mt-1 font-mono text-[10px] text-[#58588a]">Opted out of newsletter emails.</p>}
      </div>
      <Toggle checked={enabled} onChange={toggle} disabled={saving || !loaded} color="#10b981" />
    </div>
  );
}

// ── Goals Section ─────────────────────────────────────────────────────────

interface Goals {
  revenueTarget: number;
  sessionsTarget: number;
  subscribersTarget: number;
  adSpendBudget: number;
}

const DEFAULT_GOALS: Goals = { revenueTarget: 0, sessionsTarget: 0, subscribersTarget: 0, adSpendBudget: 0 };

function GoalsSection({ currencies }: { currencies: Record<string, string> }) {
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/settings").then((r) => r.json()).then((d) => {
      if (d.goals) setGoals({ ...DEFAULT_GOALS, ...d.goals });
      if (d.goalsLastSaved) setLastSaved(d.goalsLastSaved);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function saveGoals() {
    setSaving(true);
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals }),
      });
      setSaved(true);
      setLastSaved("Just now");
      setTimeout(() => setSaved(false), 2200);
    } finally { setSaving(false); }
  }

  function clearGoals() {
    setGoals(DEFAULT_GOALS);
    fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals: DEFAULT_GOALS }),
    }).catch(() => {});
  }

  const revCurrency = REVENUE_PROVIDERS_LOCAL.map((p) => currencies[p]).find(Boolean) ?? "USD";
  const adsCurrency = ADS_PROVIDERS_LOCAL.map((p) => currencies[p]).find(Boolean) ?? revCurrency;

  // Simulated pace data (in real app, would come from props or API)
  const paceInsights: Record<keyof Goals, string | null> = {
    revenueTarget: goals.revenueTarget > 0 ? `At $2.86/day you'll reach ~$85 this month — goal is ${Math.round(goals.revenueTarget / 100 / 85)}× current pace` : null,
    sessionsTarget: goals.sessionsTarget > 0 ? `At current pace: ~1,200 sessions — goal is ${Math.round(goals.sessionsTarget / 1200)}× current traffic` : null,
    subscribersTarget: null, // no email platform
    adSpendBudget: null, // no ads platform
  };

  const KPI_ROWS: {
    key: keyof Goals;
    label: string;
    sublabel: string;
    unit: string;
    unitPos: "left" | "right";
    placeholder: string;
    color: string;
    icon: React.ReactNode;
    toDisplay: (v: number) => string;
    toStorage: (s: string) => number;
    progressCurrent?: number;
    progressGoal?: number;
    noDataMsg?: string;
  }[] = [
    {
      key: "revenueTarget",
      label: "Monthly revenue target",
      sublabel: `Shown as goal line on Overview & AI Advisor · ${revCurrency}`,
      unit: revCurrency,
      unitPos: "left",
      placeholder: "1000",
      color: "#eab308",
      progressCurrent: 2000,
      progressGoal: goals.revenueTarget || 0,
      icon: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>,
      toDisplay: (v) => (v ? (v / 100).toFixed(0) : ""),
      toStorage: (s) => (s ? Math.round(parseFloat(s) * 100) : 0),
    },
    {
      key: "sessionsTarget",
      label: "Monthly sessions target",
      sublabel: "Web traffic goal from GA4 / Plausible / PostHog",
      unit: "sessions",
      unitPos: "right",
      placeholder: "20000",
      color: "#6366f1",
      progressCurrent: 52,
      progressGoal: goals.sessionsTarget || 0,
      icon: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>,
      toDisplay: (v) => (v ? String(v) : ""),
      toStorage: (s) => (s ? parseInt(s) || 0 : 0),
    },
    {
      key: "subscribersTarget",
      label: "Monthly subscribers target",
      sublabel: "Email list growth from Mailchimp / Beehiiv / Klaviyo",
      unit: "subs",
      unitPos: "right",
      placeholder: "500",
      color: "#14b8a6",
      noDataMsg: "No email platform connected — connect Mailchimp to track this",
      icon: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
      toDisplay: (v) => (v ? String(v) : ""),
      toStorage: (s) => (s ? parseInt(s) || 0 : 0),
    },
    {
      key: "adSpendBudget",
      label: "Monthly ad spend budget",
      sublabel: `Max budget cap across Meta / Google Ads / TikTok · ${adsCurrency}`,
      unit: adsCurrency,
      unitPos: "left",
      placeholder: "2000",
      color: "#f59e0b",
      noDataMsg: "No ad platform connected — connect Meta Ads to track this",
      icon: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>,
      toDisplay: (v) => (v ? (v / 100).toFixed(0) : ""),
      toStorage: (s) => (s ? Math.round(parseFloat(s) * 100) : 0),
    },
  ];

  if (!loaded) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-[#13131a]" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {KPI_ROWS.map((row) => {
          const displayVal = row.toDisplay(goals[row.key]);
          const numericGoal = row.progressGoal ?? 0;
          const numericCurrent = row.progressCurrent ?? 0;
          const pct = numericGoal > 0 ? Math.min(100, Math.round((numericCurrent / numericGoal) * 100)) : 0;
          const pace = paceInsights[row.key];

          return (
            <div key={row.key} className="rounded-xl border border-white/[0.06] bg-[#13131a] overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5" style={{ backgroundColor: `${row.color}15`, color: row.color }}>
                    {row.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#e0e0f0]">{row.label}</p>
                    <p className="font-mono text-[9px] text-[#8585aa] mt-0.5">{row.sublabel}</p>
                  </div>
                  {/* Input */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {row.unitPos === "left" && <span className="font-mono text-[10px] text-[#8585aa]">{row.unit}</span>}
                    <input
                      type="number" min={0}
                      placeholder={row.placeholder}
                      value={displayVal}
                      onChange={(e) => setGoals((g) => ({ ...g, [row.key]: row.toStorage(e.target.value) }))}
                      className="w-24 rounded-lg border border-white/[0.06] bg-[#0d0d0f] px-2 py-1.5 font-mono text-xs text-[#f8f8fc] text-right placeholder:text-[#58588a] focus:outline-none focus:border-[#6366f1]/40 focus:ring-1 focus:ring-[#6366f1]/20 transition-colors"
                    />
                    {row.unitPos === "right" && <span className="font-mono text-[10px] text-[#8585aa]">{row.unit}</span>}
                  </div>
                </div>

                {/* Progress bar — only if goal set and data available */}
                {numericGoal > 0 && !row.noDataMsg && (
                  <div className="mt-3 ml-11">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-mono text-[9px] text-[#8585aa]">
                        Current: {row.unitPos === "left" ? row.unit : ""}{row.toDisplay(numericCurrent * 100)}{row.unitPos === "right" ? ` ${row.unit}` : ""} / {displayVal} goal
                      </p>
                      <p className="font-mono text-[9px]" style={{ color: pct < 20 ? "#f59e0b" : row.color }}>{pct}%</p>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                    </div>
                  </div>
                )}

                {/* Pace insight */}
                {pace && (
                  <p className="mt-2 ml-11 font-mono text-[9px] italic" style={{ color: pct < 20 ? "#f59e0b" : "#8585aa" }}>
                    💡 {pace}
                  </p>
                )}
                {row.noDataMsg && (
                  <p className="mt-2 ml-11 font-mono text-[9px] text-[#8585aa] italic">💡 {row.noDataMsg}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={saveGoals} disabled={saving} className="rounded-xl bg-[#eab308] px-5 py-2 font-mono text-xs font-bold text-[#0d0d0f] hover:bg-[#ca8a04] transition disabled:opacity-60">
          {saving ? "Saving…" : "Save goals"}
        </button>
        {saved && <span className="flex items-center gap-1 font-mono text-[10px] text-[#10b981]"><svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Saved</span>}
        <button onClick={clearGoals} className="font-mono text-[10px] text-[#8585aa] hover:text-red-400 transition ml-auto">
          Clear all
        </button>
      </div>
      <div className="flex items-center gap-3">
        <p className="font-mono text-[9px] text-[#58588a]">Goals are used locally for projections — never shared.</p>
        {lastSaved && <p className="font-mono text-[9px] text-[#58588a]">Last saved: {lastSaved}</p>}
      </div>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────

const DYNAMIC_MODALS: Record<string, { label: string; name: string; optional?: boolean }[]> = {
  activecampaign: [{ name: "apiUrl", label: "Api URL" }, { name: "apiKey", label: "API Key" }],
  "amazon-seller": [{ name: "refreshToken", label: "Refresh Token" }, { name: "clientId", label: "Client ID" }, { name: "clientSecret", label: "Client Secret" }, { name: "sellerId", label: "Seller ID" }],
  amplitude: [{ name: "apiKey", label: "API Key" }, { name: "secretKey", label: "Secret Key" }],
  beehiiv: [{ name: "apiKey", label: "API Key" }, { name: "publicationId", label: "Publication ID" }],
  bigcommerce: [{ name: "storeHash", label: "Store Hash" }, { name: "accessToken", label: "Access Token" }],
  brevo: [{ name: "apiKey", label: "API Key" }],
  convertkit: [{ name: "apiKey", label: "API Key" }],
  etsy: [{ name: "apiKey", label: "API Key" }, { name: "shopId", label: "Shop ID" }],
  fathom: [{ name: "apiKey", label: "API Key" }, { name: "siteId", label: "Site ID" }],
  freshdesk: [{ name: "subdomain", label: "Subdomain" }, { name: "apiKey", label: "API Key" }],
  fullstory: [{ name: "apiKey", label: "API Key" }, { name: "orgId", label: "Organization ID" }],
  "google-ads": [{ name: "accessToken", label: "Access Token" }, { name: "customerId", label: "Customer ID (e.g. 123-456-7890)" }],
  gumroad: [{ name: "apiKey", label: "API Key" }],
  heap: [{ name: "appId", label: "App ID" }, { name: "apiKey", label: "API Key" }],
  hotjar: [{ name: "accessToken", label: "Access Token" }, { name: "siteId", label: "Site ID" }],
  hubspot: [{ name: "accessToken", label: "Access Token" }],
  instagram: [{ name: "accessToken", label: "Access Token" }, { name: "businessAccountId", label: "Business Account ID" }],
  intercom: [{ name: "accessToken", label: "Access Token" }],
  klaviyo: [{ name: "apiKey", label: "API Key" }],
  "lemon-squeezy": [{ name: "apiKey", label: "API Key" }],
  "linkedin-ads": [{ name: "accessToken", label: "Access Token" }, { name: "accountId", label: "Account ID" }],
  mailchimp: [{ name: "apiKey", label: "API Key" }],
  mixpanel: [{ name: "projectId", label: "Project ID" }, { name: "serviceAccountUser", label: "Service Account User" }, { name: "serviceAccountSecret", label: "Service Account Secret" }],
  notion: [{ name: "apiToken", label: "API Token" }, { name: "databaseId", label: "Database ID" }],
  paddle: [{ name: "apiKey", label: "API Key" }],
  "pinterest-ads": [{ name: "accessToken", label: "Access Token" }, { name: "accountId", label: "Account ID" }],
  pipedrive: [{ name: "apiToken", label: "API Token" }],
  plausible: [{ name: "apiKey", label: "API Key" }, { name: "siteId", label: "Site Hostname (e.g. yourdomain.com)" }],
  posthog: [{ name: "apiKey", label: "API Key (phx_…)" }, { name: "projectId", label: "Project ID (optional — auto-detected if blank)", optional: true }],
  salesforce: [{ name: "instanceUrl", label: "Instance URL" }, { name: "accessToken", label: "Access Token" }],
  segment: [{ name: "accessToken", label: "Access Token" }, { name: "workspaceId", label: "Workspace ID" }],
  shopify: [{ name: "storeDomain", label: "Store Domain" }, { name: "accessToken", label: "Access Token" }],
  "snapchat-ads": [{ name: "accessToken", label: "Access Token" }, { name: "accountId", label: "Account ID" }],
  "tiktok-ads": [{ name: "accessToken", label: "Access Token" }, { name: "advertiserId", label: "Advertiser ID" }],
  "twitter-ads": [{ name: "bearerToken", label: "Bearer Token" }, { name: "accountId", label: "Account ID" }],
  "twitter-organic": [{ name: "bearerToken", label: "Bearer Token" }, { name: "accountId", label: "User ID" }],
  woocommerce: [{ name: "siteUrl", label: "Site URL" }, { name: "consumerKey", label: "Consumer Key" }, { name: "consumerSecret", label: "Consumer Secret" }],
  youtube: [{ name: "accessToken", label: "Access Token" }, { name: "channelId", label: "Channel ID" }],
  zendesk: [{ name: "subdomain", label: "Subdomain" }, { name: "email", label: "Email" }, { name: "apiToken", label: "API Token" }],
};

function ConnectModalShell({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090911]/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.06] bg-[#13131a] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#f8f8fc]">{title}</h3>
            <p className="mt-1 text-xs text-[#8585aa]">{description}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/[0.06] px-2.5 py-1 font-mono text-[10px] text-[#8585aa] hover:text-[#e0e0f0] transition-colors">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── NAV ITEMS ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "account",      label: "Account",        color: "#6366f1" },
  { id: "subscription", label: "Subscription",   color: "#10b981" },
  { id: "integrations", label: "Integrations",   color: "#14b8a6" },
  { id: "goals",        label: "Goals & KPIs",   color: "#eab308" },
  { id: "alerts",       label: "Alert Rules",    color: "#ef4444" },
  { id: "email",        label: "Email Digest",   color: "#3b82f6" },
  // { id: "share",        label: "Share Dashboard", color: "#6366f1" },
  { id: "preferences",  label: "Preferences",    color: "#8b5cf6" },
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function SettingsTab({ email, isPremium, connectedPlatforms, currencies }: SettingsTabProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("account");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [connectTarget, setConnectTarget] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [connectSuccess, setConnectSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Popular");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [authProvider, setAuthProvider] = useState<string>("email");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [subDetails, setSubDetails] = useState<{ price: string; renewal: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const POPULAR_INTEGRATION_IDS = ["stripe", "ga4", "meta", "shopify", "youtube", "mailchimp"];
  const totalIntegrations = UI_INTEGRATIONS.length;
  const connectedCount = connectedPlatforms.filter((p) => UI_INTEGRATIONS.some((i) => i.id === p)).length;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.app_metadata?.provider) {
        setAuthProvider(data.user.app_metadata.provider as string);
      }
    });
    if (isPremium) {
      fetch("/api/stripe/subscription")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.price && d?.renewal) setSubDetails({ price: d.price, renewal: d.renewal });
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChangeEmail() {
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    setEmailMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailLoading(false);
    if (error) {
      setEmailMsg({ ok: false, text: error.message });
    } else {
      setEmailMsg({ ok: true, text: `Confirmation link sent to ${newEmail.trim()} — click it to complete the change.` });
      setNewEmail("");
      // Keep form open so the user sees the pending message
    }
  }

  async function handleChangePassword() {
    setPwLoading(true);
    setPwMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setPwLoading(false);
    if (error) {
      setPwMsg({ ok: false, text: error.message });
    } else {
      setPwMsg({ ok: true, text: "Password reset link sent to your email." });
      setShowPasswordForm(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/user/delete", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connect = params.get("connect");
    if (connect && LIVE_INTEGRATIONS.some((i) => i.id === connect)) setConnectTarget(connect);
    const knownParams = new Set(["tab", "connect", "syncing"]);
    const hasJunkParams = Array.from(params.keys()).some((k) => !knownParams.has(k));
    if (hasJunkParams) {
      const errorPlatform = Array.from(params.entries()).find(([k, v]) => !knownParams.has(k) && v === "error");
      if (errorPlatform) setConnectError(`Could not connect ${errorPlatform[0].replace(/-/g, " ")} — please try again.`);
      router.replace("/dashboard?tab=settings");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intersection observer for active nav state
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(sectionRefs.current).forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeConnectModal() {
    setConnectTarget(null);
    setConnectError("");
    setConnectSuccess("");
    router.replace("/dashboard?tab=settings");
  }

  async function submitConnect(platform: string, payload: Record<string, string>) {
    setConnectLoading(true);
    setConnectError("");
    setConnectSuccess("");
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setConnectError("Your session expired. Please log in again."); setConnectLoading(false); return; }
      const res = await fetch(`/api/auth/${platform}/connect`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { setConnectError(result?.error ?? "Failed to connect integration."); setConnectLoading(false); return; }
      setConnectSuccess("Integration connected successfully.");
      router.refresh();
      setTimeout(() => closeConnectModal(), 700);
    } catch {
      setConnectError("Network error while connecting integration.");
    } finally { setConnectLoading(false); }
  }

  async function handlePortal() {
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setPortalError(data.error ?? "Something went wrong."); setPortalLoading(false); return; }
      window.location.href = data.url;
    } catch {
      setPortalError("Network error. Please try again.");
      setPortalLoading(false);
    }
  }

  return (
    <div className="w-full min-h-screen" style={{ background: "#0d0d0f" }}>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div ref={contentRef} className="w-full overflow-y-auto pb-16">
        <div className="mx-auto max-w-[760px] px-6 lg:px-8 space-y-8 pt-8">

          {/* Page header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#f8f8fc" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" /><circle cx="12" cy="12" r="3" />
              </svg>
              <h1 className="font-mono text-xl font-bold text-[#f8f8fc]">Settings</h1>
            </div>
            {isPremium && (
              <div className="flex items-center gap-1.5 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
                <span className="font-mono text-[10px] font-semibold text-[#10b981]">Premium Active</span>
              </div>
            )}
          </div>

          {/* ── Section tab strip ──────────────────────────────────────── */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-white/[0.06] pb-0 mb-4">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="shrink-0 relative px-3 py-2.5 font-mono text-[11px] font-semibold transition-colors whitespace-nowrap"
                  style={{ color: isActive ? item.color : "#8585aa" }}
                >
                  {item.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── ACCOUNT ──────────────────────────────────────────────── */}
          <section id="account" ref={(el) => { sectionRefs.current.account = el; }}>
            <div className="rounded-2xl border border-white/[0.06] bg-[#13131a] p-6 space-y-5">
              {/* Avatar + email */}
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold uppercase select-none" style={{ backgroundColor: "#6366f118", color: "#6366f1", border: "1px solid #6366f130" }}>
                  {email.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#f8f8fc] truncate">{email}</p>
                  <p className="font-mono text-[10px] text-[#8585aa] mt-0.5">Signed in via {authProvider.charAt(0).toUpperCase() + authProvider.slice(1)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* <button
                    onClick={() => { setShowEmailForm((v) => !v); setEmailMsg(null); }}
                    className="rounded-lg border border-white/[0.06] bg-[#0d0d0f] px-3.5 py-2 font-mono text-xs text-[#bcbcd8] hover:border-[#6366f1]/30 hover:text-[#6366f1] transition-all"
                  >
                    Change email
                  </button> */}
                  <button
                    onClick={() => { setShowPasswordForm((v) => !v); setPwMsg(null); }}
                    className="rounded-lg border border-white/[0.06] bg-[#0d0d0f] px-3.5 py-2 font-mono text-xs text-[#bcbcd8] hover:border-[#6366f1]/30 hover:text-[#6366f1] transition-all"
                  >
                    Change password
                  </button>
                </div>
                {showEmailForm && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="New email address"
                      className="rounded-lg border border-white/[0.06] bg-[#0d0d0f] px-3 py-1.5 font-mono text-xs text-[#f8f8fc] placeholder-[#58588a] focus:outline-none focus:border-[#6366f1]/40 transition-all w-56"
                    />
                    <button
                      onClick={handleChangeEmail}
                      disabled={emailLoading || !newEmail.trim()}
                      className="rounded-lg bg-[#6366f1] px-3.5 py-1.5 font-mono text-xs font-semibold text-white hover:bg-[#5254cc] disabled:opacity-50 transition-all"
                    >
                      {emailLoading ? "Saving…" : "Update"}
                    </button>
                    <button onClick={() => setShowEmailForm(false)} className="font-mono text-[11px] text-[#8585aa] hover:text-[#bcbcd8] transition-colors">Cancel</button>
                  </div>
                )}
                {emailMsg && <p className={`font-mono text-[11px] ${emailMsg.ok ? "text-[#10b981]" : "text-red-400"}`}>{emailMsg.text}</p>}
                {showPasswordForm && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-[11px] text-[#bcbcd8]">A reset link will be sent to <span className="text-[#f8f8fc]">{email}</span>.</p>
                    <button
                      onClick={handleChangePassword}
                      disabled={pwLoading}
                      className="rounded-lg bg-[#6366f1] px-3.5 py-1.5 font-mono text-xs font-semibold text-white hover:bg-[#5254cc] disabled:opacity-50 transition-all"
                    >
                      {pwLoading ? "Sending…" : "Send reset link"}
                    </button>
                    <button onClick={() => setShowPasswordForm(false)} className="font-mono text-[11px] text-[#8585aa] hover:text-[#bcbcd8] transition-colors">Cancel</button>
                  </div>
                )}
                {pwMsg && <p className={`font-mono text-[11px] ${pwMsg.ok ? "text-[#10b981]" : "text-red-400"}`}>{pwMsg.text}</p>}
              </div>

              {/* Danger zone */}
              {/* <div className="border-t border-white/[0.04] pt-5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#ef4444]/70 mb-3">Danger zone</p>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-lg border border-red-500/20 px-3.5 py-2 font-mono text-xs font-semibold text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
                  >
                    Delete account
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-xs text-[#f8f8fc]">Are you sure? This is permanent.</p>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                      className="rounded-lg bg-red-500 px-3.5 py-2 font-mono text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60 transition-all"
                    >
                      {deleteLoading ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="rounded-lg border border-white/[0.06] px-3.5 py-2 font-mono text-xs text-[#8585aa] hover:text-[#bcbcd8] transition-all">
                      Cancel
                    </button>
                  </div>
                )}
              </div> */}
            </div>
          </section>

          {/* ── SUBSCRIPTION ─────────────────────────────────────────── */}
          <section id="subscription" ref={(el) => { sectionRefs.current.subscription = el; }}>
            <div className="rounded-2xl border border-white/[0.06] bg-[#13131a] p-6">
              {isPremium ? (
                <div className="space-y-5">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#10b981]/20 bg-[#10b981]/10">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#f8f8fc]">Premium — Active</p>
                        <span className="rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#10b981]">✓ Active</span>
                      </div>
                      <p className="font-mono text-[10px] text-[#8585aa] mt-0.5">
                        {subDetails ? `${subDetails.price} · Renews ${subDetails.renewal}` : "$19 / month"}
                      </p>
                    </div>
                  </div>

                  {/* Includes */}
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#58588a] mb-2">Included</p>
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-6">
                      {["All integrations", "AI Advisor", "Daily insights", "Website analyzer", "Anomaly alerts", "Priority support"].map((item) => (
                        <div key={item} className="flex items-center gap-1.5">
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <p className="font-mono text-[11px] text-[#bcbcd8]">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Manage button */}
                  {portalError && <p className="text-xs text-red-400">{portalError}</p>}
                  <button
                    onClick={handlePortal} disabled={portalLoading}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0d0d0f] px-4 py-2 font-mono text-xs text-[#bcbcd8] hover:border-[#10b981]/30 hover:text-[#10b981] disabled:opacity-60 transition-all"
                  >
                    {portalLoading ? (
                      <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Opening…</>
                    ) : (
                      <><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>Manage billing</>
                    )}
                  </button>
                  <p className="font-mono text-[9px] text-[#58588a]">Redirects to Stripe's secure portal.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#8b5cf6]/15 bg-[#8b5cf6]/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6]">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#f8f8fc]">Upgrade to Premium</p>
                        <p className="mt-0.5 text-xs text-[#bcbcd8]">Analytics, AI advisor, website optimizer & all integrations.</p>
                        <p className="mt-1.5 font-mono text-xs font-bold text-[#f8f8fc]">$19<span className="font-normal text-[#8585aa]">/month</span> <span className="ml-1.5 rounded-full bg-[#10b981]/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#10b981]">7-day free trial</span></p>
                      </div>
                    </div>
                  </div>
                  <a href="/api/stripe/checkout" className="inline-flex items-center gap-2 rounded-xl bg-[#10b981] px-5 py-2 font-mono text-sm font-bold text-white hover:bg-[#059669] transition">
                    Start free trial →
                  </a>
                  <p className="font-mono text-[9px] text-[#58588a]">Card required · $19/mo after 7 days · cancel anytime</p>
                </div>
              )}
            </div>
          </section>

          {/* ── INTEGRATIONS ─────────────────────────────────────────── */}
          <section id="integrations" ref={(el) => { sectionRefs.current.integrations = el; }}>
            <div className="rounded-2xl border border-white/[0.06] bg-[#13131a] p-6">
              {/* Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
                <div>
                  <p className="text-sm text-[#bcbcd8]">Connect your data sources. Syncs every 24 hours.</p>
                  {/* Progress */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-1.5 w-24 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full bg-[#14b8a6] transition-all" style={{ width: `${(connectedCount / totalIntegrations) * 100}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-[#8585aa]">{connectedCount} of {totalIntegrations} connected</span>
                  </div>
                </div>
                <div className="relative shrink-0 sm:w-52">
                  <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#58588a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text" placeholder="Search platforms..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setActiveCategory("All"); }}
                    className="w-full rounded-xl border border-white/[0.06] bg-[#0d0d0f] py-2 pl-9 pr-3 font-mono text-xs text-[#f8f8fc] placeholder:text-[#58588a] focus:border-[#14b8a6]/40 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/20 transition-all"
                  />
                </div>
              </div>

              {/* Category pills */}
              {!searchQuery && (
                <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {["Popular", ...INTEGRATION_CATEGORIES].map((cat) => {
                    const catCount = cat === "Popular" ? null : UI_INTEGRATIONS.filter((i) => i.category === cat).length;
                    const catConnected = cat === "Popular" ? null : connectedPlatforms.filter((p) => UI_INTEGRATIONS.some((i) => i.id === p && i.category === cat)).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider border transition-all"
                        style={{
                          backgroundColor: activeCategory === cat ? "#14b8a6" : "transparent",
                          borderColor: activeCategory === cat ? "#14b8a6" : "rgba(255,255,255,0.06)",
                          color: activeCategory === cat ? "#0d0d0f" : "#8585aa",
                        }}
                      >
                        {cat}{catCount !== null ? ` (${catConnected}/${catCount})` : ""}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Integration list */}
              <div className="space-y-3">
                {activeCategory === "Popular" && !searchQuery ? (
                  UI_INTEGRATIONS.filter((i) => POPULAR_INTEGRATION_IDS.includes(i.id)).map((integration) => (
                    <IntegrationRow key={integration.id} integration={integration} connected={connectedPlatforms.includes(integration.id)} />
                  ))
                ) : (
                  INTEGRATION_CATEGORIES.filter((cat) => searchQuery || activeCategory === cat || activeCategory === "All").map((cat) => {
                    const items = UI_INTEGRATIONS.filter((i) => i.category === cat && (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.toLowerCase().includes(searchQuery.toLowerCase())));
                    if (items.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#58588a]">{cat}</h3>
                          <div className="h-px flex-1 bg-white/[0.04]" />
                        </div>
                        {items.map((integration) => (
                          <IntegrationRow key={integration.id} integration={integration} connected={connectedPlatforms.includes(integration.id)} />
                        ))}
                      </div>
                    );
                  })
                )}
                {UI_INTEGRATIONS.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && searchQuery && (
                  <div className="py-10 text-center">
                    <p className="text-sm text-[#8585aa]">No integrations match <span className="text-[#f8f8fc]">&ldquo;{searchQuery}&rdquo;</span></p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── GOALS & KPIs ─────────────────────────────────────────── */}
          <section id="goals" ref={(el) => { sectionRefs.current.goals = el; }}>
            <p className="mb-3 font-mono text-[10px] text-[#8585aa]">Monthly targets that power your forecast bars, AI analysis, and email digest.</p>
            <div className="rounded-2xl border border-white/[0.06] bg-[#13131a] p-6">
              <GoalsSection currencies={currencies} />
            </div>
          </section>

          {/* ── ALERT RULES (premium only) ────────────────────────────── */}
          {isPremium && (
            <section id="alerts" ref={(el) => { sectionRefs.current.alerts = el; }}>
              <p className="mb-3 font-mono text-[10px] text-[#8585aa]">Get notified when your key metrics cross these thresholds.</p>
              <div className="rounded-2xl border border-white/[0.06] bg-[#13131a] p-6">
                <AlertsSection email={email} currencies={currencies} />
              </div>
            </section>
          )}

          {/* ── EMAIL DIGEST (premium only) ──────────────────────────── */}
          {isPremium && (
            <section id="email" ref={(el) => { sectionRefs.current.email = el; }}>
              <p className="mb-3 font-mono text-[10px] text-[#8585aa]">AI summary delivered to your inbox on your chosen schedule.</p>
              <div className="rounded-2xl border border-white/[0.06] bg-[#13131a] p-6">
                <DigestSectionInline email={email} />
              </div>
            </section>
          )}

          {/* ── SHARE DASHBOARD ──────────────────────────────────────── */}
          {/* <section id="share" ref={(el) => { sectionRefs.current.share = el; }}>
            <SectionLabel color="#6366f1">Share Dashboard</SectionLabel>
            <p className="mt-1 font-mono text-[10px] text-[#8585aa]">Share a read-only snapshot with anyone — no login required.</p>
            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-[#13131a] p-6">
              <ShareSection />
            </div>
          </section> */}

          {/* ── PREFERENCES ──────────────────────────────────────────── */}
          <section id="preferences" ref={(el) => { sectionRefs.current.preferences = el; }}>
            <div className="rounded-2xl border border-white/[0.06] bg-[#13131a] p-6 space-y-5">
              <NewsletterToggle />
            </div>
          </section>

        </div>
      </div>

      {/* ── Connect modal ───────────────────────────────────────────────── */}
      {connectTarget && DYNAMIC_MODALS[connectTarget] && (
        <ConnectModalShell
          title={`Connect ${UI_INTEGRATIONS.find((i) => i.id === connectTarget)?.name || "Integration"}`}
          description={`Add your credentials to connect ${UI_INTEGRATIONS.find((i) => i.id === connectTarget)?.name || "Integration"}.`}
          onClose={closeConnectModal}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const payload: Record<string, string> = {};
              DYNAMIC_MODALS[connectTarget].forEach((field) => {
                payload[field.name] = (new FormData(form).get(field.name) as string) ?? "";
              });
              submitConnect(connectTarget, payload);
            }}
            className="space-y-3"
          >
            {DYNAMIC_MODALS[connectTarget].map((field) => (
              <div key={field.name}>
                <input
                  name={field.name}
                  required={!field.optional}
                  placeholder={field.optional ? `${field.label} (optional)` : field.label}
                  className="w-full rounded-xl border border-white/[0.06] bg-[#0d0d0f] px-3 py-2.5 text-sm text-[#f8f8fc] placeholder:text-[#58588a] focus:border-[#6366f1]/40 focus:outline-none focus:ring-1 focus:ring-[#6366f1]/20 transition-all"
                />
                {field.optional && <p className="mt-1 font-mono text-[9px] text-[#58588a]">Optional</p>}
              </div>
            ))}
            {connectError && <p className="text-xs text-red-400">{connectError}</p>}
            {connectSuccess && <p className="text-xs text-[#10b981]">{connectSuccess}</p>}
            <button
              disabled={connectLoading}
              className="rounded-xl bg-[#6366f1] px-4 py-2 font-mono text-xs font-bold text-white hover:bg-[#4f46e5] disabled:opacity-60 transition-all"
            >
              {connectLoading ? "Connecting…" : "Connect"}
            </button>
          </form>
        </ConnectModalShell>
      )}
    </div>
  );
}