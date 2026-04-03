"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LIVE_INTEGRATIONS, INTEGRATION_CATEGORIES } from "@/lib/integrations/catalog";

interface SettingsTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
}

const UI_INTEGRATIONS = LIVE_INTEGRATIONS.map((cat) => ({
  id: cat.id,
  name: cat.name,
  description: cat.description,
  connectUrl: cat.connectUrl || "",
  color: cat.color,
  icon: (
    <svg width="14" height="14" viewBox={cat.iconViewBox || "0 0 24 24"} fill="currentColor" dangerouslySetInnerHTML={{ __html: cat.icon }} />
  ),
  category: cat.category,
}));

// Platforms that need an extra param collected before we can build the OAuth URL.
// key = platform id, value = { param: query param name, label, placeholder }
const PARAM_REQUIRED: Record<string, { param: string; label: string; placeholder: string }> = {
  shopify: { param: "shop", label: "Store domain", placeholder: "yourstore.myshopify.com" },
  zendesk: { param: "subdomain", label: "Zendesk subdomain", placeholder: "yourcompany (from yourcompany.zendesk.com)" },
  freshdesk: { param: "subdomain", label: "Freshdesk subdomain", placeholder: "yourcompany (from yourcompany.freshdesk.com)" },
};

function IntegrationRow({
  integration,
  connected,
}: {
  integration: (typeof UI_INTEGRATIONS)[number];
  connected: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"disconnect" | null>(null);
  const [error, setError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [paramValue, setParamValue] = useState("");
  const [showParamInput, setShowParamInput] = useState(false);

  const paramConfig = PARAM_REQUIRED[integration.id];

  function handleConnectClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!paramConfig) return; // no extra param needed — let the <a> navigate normally
    e.preventDefault();
    setShowParamInput(true);
    setError("");
  }

  function handleParamSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = paramValue.trim();
    if (!val) {
      setError(`Please enter your ${paramConfig.label.toLowerCase()}.`);
      return;
    }
    // For Shopify ensure it ends with .myshopify.com
    let finalVal = val;
    if (integration.id === "shopify" && !val.includes(".")) {
      finalVal = `${val}.myshopify.com`;
    }
    window.location.href = `${integration.connectUrl}?${paramConfig.param}=${encodeURIComponent(finalVal)}`;
  }

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
              onClick={handleConnectClick}
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
            onClick={handleConnectClick}
            className="rounded-xl border border-[#363650] bg-[#1c1c2a] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-[#00d4aa]/30 hover:bg-[#0f1420] hover:text-[#00d4aa]"
          >
            Connect →
          </a>
        )}
      </div>

      {/* Inline param input for platforms that need a shop/subdomain before OAuth */}
      {showParamInput && paramConfig && (
        <form onSubmit={handleParamSubmit} className="mt-3 flex items-center gap-2">
          <input
            autoFocus
            type="text"
            value={paramValue}
            onChange={(e) => { setParamValue(e.target.value); setError(""); }}
            placeholder={paramConfig.placeholder}
            className="flex-1 rounded-lg border border-[#363650] bg-[#1c1c2a] px-3 py-2 font-mono text-xs text-[#f8f8fc] placeholder-[#58588a] outline-none focus:border-[#00d4aa]/50 focus:ring-1 focus:ring-[#00d4aa]/20"
          />
          <button
            type="submit"
            className="rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#00d4aa] transition-all hover:bg-[#00d4aa]/20"
          >
            Go →
          </button>
          <button
            type="button"
            onClick={() => { setShowParamInput(false); setParamValue(""); setError(""); }}
            className="rounded-lg border border-[#363650] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8585aa] transition-all hover:text-[#bcbcd8]"
          >
            Cancel
          </button>
        </form>
      )}

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

function ConnectModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090911]/75 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#363650] bg-[#13131f] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-mono text-sm font-semibold text-[#f8f8fc]">{title}</h3>
            <p className="mt-1 text-xs text-[#8585aa]">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[#363650] px-2.5 py-1 font-mono text-[10px] text-[#8585aa] transition hover:text-[#e0e0f0]"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SettingsTab({ email, isPremium, connectedPlatforms }: SettingsTabProps) {
  const router = useRouter();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [connectTarget, setConnectTarget] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [connectSuccess, setConnectSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Popular");

  const POPULAR_INTEGRATION_IDS = ["stripe", "ga4", "meta", "shopify", "youtube", "mailchimp"];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connect = params.get("connect");
    if (connect && LIVE_INTEGRATIONS.some((i) => i.id === connect)) {
      setConnectTarget(connect);
    }

    // Detect OAuth error/result params like ?shopify=error or ?hubspot=connected
    // and immediately clean them from the URL so they don't interfere with navigation.
    const knownParams = new Set(["tab", "connect", "syncing"]);
    const hasJunkParams = Array.from(params.keys()).some((k) => !knownParams.has(k));
    if (hasJunkParams) {
      // Show error banner if any platform returned an error
      const errorPlatform = Array.from(params.entries()).find(
        ([k, v]) => !knownParams.has(k) && v === "error"
      );
      if (errorPlatform) {
        setConnectError(
          `Could not connect ${errorPlatform[0].replace(/-/g, " ")} — please try again or check your app credentials.`
        );
      }
      // Clean the URL — only keep tab=settings
      router.replace("/dashboard?tab=settings");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeConnectModal() {
    setConnectTarget(null);
    setConnectError("");
    setConnectSuccess("");
    // Always produce a clean URL — drops all OAuth result params (?platform=error/connected/missing_shop)
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
      if (!token) {
        setConnectError("Your session expired. Please log in again.");
        setConnectLoading(false);
        return;
      }

      const res = await fetch(`/api/auth/${platform}/connect`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConnectError(result?.error ?? "Failed to connect integration.");
        setConnectLoading(false);
        return;
      }

      setConnectSuccess("Integration connected successfully.");
      router.refresh();
      setTimeout(() => closeConnectModal(), 700);
    } catch {
      setConnectError("Network error while connecting integration.");
    } finally {
      setConnectLoading(false);
    }
  }

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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">
              Integrations
            </h2>
            <p className="text-sm text-[#bcbcd8]">
              Connect your data sources. Data syncs automatically every day — or sync manually from the Overview tab.
            </p>
          </div>
          <div className="relative shrink-0 sm:w-64">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#58588a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search platform..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value && activeCategory === "Popular") {
                  setActiveCategory("All"); // Switch from popular when typing to show all results
                }
              }}
              className="w-full rounded-xl border border-[#363650] bg-[#222235] py-2 pl-9 pr-3 text-sm text-[#f8f8fc] placeholder:text-[#58588a] focus:border-[#00d4aa]/50 focus:outline-none focus:ring-1 focus:ring-[#00d4aa]/50 transition-all font-mono"
            />
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────── */}
        {!searchQuery && (
          <div className="mb-6 flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
            {["Popular", ...INTEGRATION_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  activeCategory === cat
                    ? "bg-[#00d4aa] text-[#13131f] border border-[#00d4aa]"
                    : "bg-[#1c1c2a] text-[#8585aa] border border-[#363650] hover:border-[#00d4aa]/30 hover:text-[#e0e0f0]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-8">
          {UI_INTEGRATIONS.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
            <div className="py-8 text-center text-sm text-[#8585aa]">
              No integrations found matching <span className="text-[#f8f8fc]">"{searchQuery}"</span>
            </div>
          ) : activeCategory === "Popular" && !searchQuery ? (
            <div className="flex flex-col gap-3">
              {UI_INTEGRATIONS.filter((i) => POPULAR_INTEGRATION_IDS.includes(i.id)).map((integration) => (
                <IntegrationRow
                  key={integration.id}
                  integration={integration}
                  connected={connectedPlatforms.includes(integration.id)}
                />
              ))}
            </div>
          ) : (
            INTEGRATION_CATEGORIES.filter((cat) => !searchQuery ? activeCategory === cat || activeCategory === "All" : true).map((cat) => {
              const categoryIntegrations = UI_INTEGRATIONS.filter(
                (i) => i.category === cat && 
                       (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        i.description.toLowerCase().includes(searchQuery.toLowerCase()))
              );
              if (categoryIntegrations.length === 0) return null;
              return (
                <div key={cat}>
                  <h3 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#f8f8fc]">
                    {cat}
                  </h3>
                  <div className="flex flex-col gap-3">
                    {categoryIntegrations.map((integration) => (
                      <IntegrationRow
                        key={integration.id}
                        integration={integration}
                        connected={connectedPlatforms.includes(integration.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
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

      {connectTarget && DYNAMIC_MODALS[connectTarget] && (
        <ConnectModalShell
          title={`Connect ${UI_INTEGRATIONS.find(i => i.id === connectTarget)?.name || "Integration"}`}
          description={`Add your credentials to connect ${UI_INTEGRATIONS.find(i => i.id === connectTarget)?.name || "Integration"}.`}
          onClose={closeConnectModal}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const payload: Record<string, string> = {};
              DYNAMIC_MODALS[connectTarget].forEach(field => {
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
                  placeholder={field.optional ? `${field.label}` : field.label}
                  className="w-full rounded-xl border border-[#363650] bg-[#1c1c2a] px-3 py-2 text-sm text-[#f8f8fc] placeholder:text-[#58588a]"
                />
                {field.optional && (
                  <p className="mt-1 font-mono text-[9px] text-[#58588a]">Optional</p>
                )}
              </div>
            ))}
            {connectError && <p className="text-xs text-red-400">{connectError}</p>}
            {connectSuccess && <p className="text-xs text-[#00d4aa]">{connectSuccess}</p>}
            <button disabled={connectLoading} className="rounded-xl bg-[#00d4aa] px-4 py-2 font-mono text-xs font-bold text-[#13131f] disabled:opacity-60">
              {connectLoading ? "Connecting…" : "Connect"}
            </button>
          </form>
        </ConnectModalShell>
      )}
    </div>
  );
}


