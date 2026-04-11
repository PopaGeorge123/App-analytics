"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LIVE_INTEGRATIONS, INTEGRATION_CATEGORIES } from "@/lib/integrations/catalog";

const REVENUE_PROVIDERS_LOCAL = ["stripe", "lemon-squeezy", "paddle", "shopify", "woocommerce", "gumroad"];
const ADS_PROVIDERS_LOCAL = ["meta", "google-ads", "tiktok-ads"];

interface SettingsTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  /** platform → ISO currency code. e.g. { stripe: "EUR", meta: "USD" } */
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

function AlertsSection({ currencies }: { currencies: Record<string, string> }) {
  const [rules, setRules] = useState<AlertRules>(DEFAULT_ALERTS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Derive the ads currency from connected ad platforms
  const adsCurrency = ADS_PROVIDERS_LOCAL.map((p) => currencies[p]).find(Boolean) ?? "USD";
  const adsLabel = adsCurrency; // always show ISO code (e.g. "RON", "USD", "EUR")

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
            <p className="font-mono text-[9px] text-[#8585aa]">Alert if a single day&apos;s ad spend exceeds {adsLabel} X</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[10px] text-[#8585aa]">{adsLabel}</span>
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

// ── Goals & KPIs Section ─────────────────────────────────────────────────

interface Goals {
  revenueTarget: number;   // cents per month
  sessionsTarget: number;  // sessions per month
  subscribersTarget: number; // email subscribers per month
  adSpendBudget: number;   // cents per month (ad budget cap)
}

const DEFAULT_GOALS: Goals = {
  revenueTarget: 0,
  sessionsTarget: 0,
  subscribersTarget: 0,
  adSpendBudget: 0,
};

function GoalsSection({ currencies }: { currencies: Record<string, string> }) {
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.goals) setGoals({ ...DEFAULT_GOALS, ...d.goals });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
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
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  }

  function clearGoals() {
    setGoals(DEFAULT_GOALS);
    fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals: DEFAULT_GOALS }),
    }).catch(() => {});
  }

  const hasAny =
    goals.revenueTarget > 0 ||
    goals.sessionsTarget > 0 ||
    goals.subscribersTarget > 0 ||
    goals.adSpendBudget > 0;

  // Derive currency symbols from the connected platforms
  const revCurrency = REVENUE_PROVIDERS_LOCAL.map((p) => currencies[p]).find(Boolean) ?? "USD";
  const adsCurrency = ADS_PROVIDERS_LOCAL.map((p) => currencies[p]).find(Boolean) ?? "USD";

  // Always use the ISO code as the label (e.g. "RON", "USD", "EUR").
  // This is unambiguous for every currency, including those without a short symbol.
  const revSymbol = revCurrency;
  const adsSymbol = adsCurrency;

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
  }[] = [
    {
      key: "revenueTarget",
      label: "Monthly revenue target",
      sublabel: `Shown as goal line on Overview & AI advisor · ${revCurrency}`,
      unit: revSymbol,
      unitPos: "left",
      placeholder: "e.g. 10000",
      color: "#635bff",
      icon: (
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
      toDisplay: (v) => (v ? (v / 100).toFixed(0) : ""),
      toStorage: (s) => (s ? Math.round(parseFloat(s) * 100) : 0),
    },
    {
      key: "sessionsTarget",
      label: "Monthly sessions target",
      sublabel: "Web traffic goal from GA4 / Plausible / PostHog",
      unit: "sessions",
      unitPos: "right",
      placeholder: "e.g. 20000",
      color: "#4285F4",
      icon: (
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      toDisplay: (v) => (v ? String(v) : ""),
      toStorage: (s) => (s ? parseInt(s) || 0 : 0),
    },
    {
      key: "subscribersTarget",
      label: "Monthly subscribers target",
      sublabel: "Email list growth goal from Mailchimp / Beehiiv / Klaviyo",
      unit: "subs",
      unitPos: "right",
      placeholder: "e.g. 500",
      color: "#FF6B35",
      icon: (
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      toDisplay: (v) => (v ? String(v) : ""),
      toStorage: (s) => (s ? parseInt(s) || 0 : 0),
    },
    {
      key: "adSpendBudget",
      label: "Monthly ad spend budget",
      sublabel: `Max budget cap across Meta / Google Ads / TikTok Ads · ${adsCurrency}`,
      unit: adsSymbol,
      unitPos: "left",
      placeholder: "e.g. 2000",
      color: "#f59e0b",
      icon: (
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
        </svg>
      ),
      toDisplay: (v) => (v ? (v / 100).toFixed(0) : ""),
      toStorage: (s) => (s ? Math.round(parseFloat(s) * 100) : 0),
    },
  ];

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 py-2 text-[#58588a]">
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="font-mono text-[10px]">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#bcbcd8]">
        Set your monthly KPI targets. These power the forecast bars on your Overview, the AI advisor&apos;s analysis, and your email digest.
      </p>

      <div className="space-y-3">
        {KPI_ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-4 py-3"
          >
            {/* Icon */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${row.color}15`, color: row.color }}
            >
              {row.icon}
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[11px] font-semibold text-[#e0e0f0]">{row.label}</p>
              <p className="font-mono text-[9px] text-[#8585aa]">{row.sublabel}</p>
            </div>

            {/* Input */}
            <div className="flex shrink-0 items-center gap-1.5">
              {row.unitPos === "left" && (
                <span className="font-mono text-[10px] text-[#8585aa]">{row.unit}</span>
              )}
              <input
                type="number"
                min={0}
                placeholder={row.placeholder.replace("e.g. ", "")}
                value={row.toDisplay(goals[row.key])}
                onChange={(e) =>
                  setGoals((g) => ({ ...g, [row.key]: row.toStorage(e.target.value) }))
                }
                className="w-24 rounded-lg border border-[#363650] bg-[#1c1c2a] px-2 py-1.5 font-mono text-xs text-[#f8f8fc] text-right placeholder:text-[#58588a] focus:outline-none focus:border-[#00d4aa]/30 transition-colors"
              />
              {row.unitPos === "right" && (
                <span className="font-mono text-[10px] text-[#8585aa]">{row.unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveGoals}
          disabled={saving}
          className="rounded-xl bg-[#00d4aa] px-5 py-2 font-mono text-xs font-bold text-[#13131f] hover:bg-[#00bfa0] transition disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save goals"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-[#00d4aa]">
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
        {hasAny && (
          <button
            onClick={clearGoals}
            className="font-mono text-[10px] text-[#8585aa] hover:text-red-400 transition"
          >
            Clear all
          </button>
        )}
      </div>
      <p className="font-mono text-[9px] text-[#58588a]">
        Goals are used for forecast projections and AI-powered recommendations — they are never shared.
      </p>
    </div>
  );
}

// ── Email Digest Inline (used inside the Settings grid section) ─────────────

function DigestSectionInline({ email }: { email: string }) {
  const [subscribed, setSubscribed] = useState(false);
  const [digestDay, setDigestDay]   = useState(1); // 0=Sun … 6=Sat
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [sending, setSending]       = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "sent" | "error">("idle");
  const [sendError, setSendError]   = useState("");

  const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Load current prefs on mount
  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.digestSubscribed === "boolean") setSubscribed(d.digestSubscribed);
        if (typeof d.digestDay === "number") setDigestDay(d.digestDay);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function savePrefs(nextSubscribed: boolean, nextDay: number) {
    setSaving(true);
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestSubscribed: nextSubscribed, digestDay: nextDay }),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleToggle() {
    const next = !subscribed;
    setSubscribed(next);
    savePrefs(next, digestDay);
  }

  function handleDayChange(day: number) {
    setDigestDay(day);
    savePrefs(subscribed, day);
  }

  async function sendDigest() {
    setSending(true);
    setSendStatus("idle");
    setSendError("");
    try {
      const res = await fetch("/api/digest/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Failed to send digest.");
        setSendStatus("error");
      } else {
        setSendStatus("sent");
      }
    } catch {
      setSendError("Network error.");
      setSendStatus("error");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="h-20 animate-pulse rounded-xl bg-[#222235]" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[#bcbcd8]">
        Get an AI-powered summary delivered to{" "}
        <span className="font-medium text-[#e0e0f0]">{email}</span> every week.
        Includes revenue highlights, anomalies, cross-platform insights, and a top action.
      </p>

      {/* ── Enable toggle ── */}
      <div className="flex items-center justify-between rounded-xl border border-[#363650] bg-[#222235] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold text-[#f8f8fc]">Weekly email digest</p>
          <p className="mt-0.5 font-mono text-[10px] text-[#8585aa]">
            {subscribed ? "Enabled — digest sent automatically" : "Disabled — no automatic emails"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          aria-pressed={subscribed}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            subscribed ? "bg-[#00d4aa]" : "bg-[#363650]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
              subscribed ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* ── Day of week picker — only visible when enabled ── */}
      {subscribed && (
        <div className="rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">Send every</p>
          <div className="flex flex-wrap gap-1.5">
            {DOW_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => handleDayChange(i)}
                disabled={saving}
                className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition-all disabled:opacity-50 ${
                  digestDay === i
                    ? "bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa]"
                    : "border border-[#363650] text-[#8585aa] hover:text-[#bcbcd8] hover:border-[#454560]"
                }`}
              >
                {label.slice(0, 3)}
              </button>
            ))}
          </div>
          <p className="font-mono text-[9px] text-[#58588a]">
            Next digest: <span className="text-[#bcbcd8]">{DOW_LABELS[digestDay]}</span>
            {saving && <span className="ml-2 text-[#00d4aa]">Saving…</span>}
          </p>
        </div>
      )}

      {/* ── Send now ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={sendDigest}
          disabled={sending}
          className="flex items-center gap-2 rounded-xl border border-[#363650] px-4 py-2 font-mono text-xs text-[#8585aa] hover:text-[#bcbcd8] hover:border-[#454560] disabled:opacity-50 disabled:cursor-not-allowed transition"
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
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send digest now
            </>
          )}
        </button>
        {sendStatus === "sent"  && <span className="font-mono text-[11px] text-[#00d4aa]">✓ Sent to {email}</span>}
        {sendStatus === "error" && <span className="font-mono text-[11px] text-red-400">{sendError}</span>}
      </div>
    </div>
  );
}

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

export default function SettingsTab({ email, isPremium, connectedPlatforms, currencies }: SettingsTabProps) {
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
    <div className="w-full space-y-6">

      {/* ── Page header ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">Settings</h1>
          <p className="mt-1 text-sm text-[#8585aa]">Manage your account, integrations and subscription.</p>
        </div>
        {/* Plan badge in header — quick at-a-glance */}
        <div className={`mt-1 shrink-0 rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
          isPremium
            ? "border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]"
            : "border border-[#363650] bg-[#222235] text-[#8585aa]"
        }`}>
          {isPremium ? "✦ Premium" : "Free plan"}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          Row 1: Account + Subscription side-by-side on md+
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* ── Account ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5">
          <p className="mb-4 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">Account</p>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00d4aa]/15 font-mono text-base font-bold uppercase text-[#00d4aa] select-none">
              {email.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#f8f8fc]">{email}</p>
              <p className="mt-0.5 font-mono text-[10px] text-[#8585aa]">Signed-in email</p>
            </div>
          </div>
        </section>

        {/* ── Subscription ────────────────────────────────── */}
        <section className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5">
          <p className="mb-4 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">Subscription</p>

          {isPremium ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#00d4aa]/20 bg-[#00d4aa]/10">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#f8f8fc]">Premium — Active</p>
                  <p className="text-xs text-[#8585aa]">Manage billing or cancel via Stripe.</p>
                </div>
              </div>
              {portalError && <p className="text-xs text-red-400">{portalError}</p>}
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 self-start rounded-xl border border-[#363650] bg-[#222235] px-4 py-2 text-sm font-semibold text-[#f8f8fc] transition-all hover:border-[#00d4aa]/30 hover:text-[#00d4aa] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {portalLoading ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Opening…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Manage Subscription
                  </>
                )}
              </button>
              <p className="font-mono text-[9px] text-[#58588a]">Redirects to Stripe&apos;s secure billing portal.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-[#a78bfa]/15 bg-[#a78bfa]/5 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#a78bfa]/10 text-[#a78bfa]">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#f8f8fc]">Upgrade to Premium</p>
                    <p className="mt-0.5 text-xs text-[#bcbcd8]">Analytics, AI advisor, website optimizer & all integrations.</p>
                    <p className="mt-1 font-mono text-xs font-bold text-[#f8f8fc]">
                      $29<span className="font-normal text-[#8585aa]">/month</span>
                      <span className="ml-2 rounded-full bg-[#00d4aa]/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#00d4aa]">3-day free trial</span>
                    </p>
                  </div>
                </div>
              </div>
              <a
                href="/api/stripe/checkout"
                className="inline-flex items-center gap-2 self-start rounded-xl bg-[#00d4aa] px-5 py-2 font-mono text-sm font-bold text-[#13131f] hover:bg-[#00bfa0] transition"
              >
                Start free trial →
              </a>
              <p className="font-mono text-[9px] text-[#58588a]">Card required · $29/mo after 3 days · cancel anytime</p>
            </div>
          )}
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════
          Row 2: Integrations + Goals & KPIs side-by-side
          3fr / 2fr split — integrations gets more room
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">

        {/* ── Integrations ──────────────────────────────── */}
        <section className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
        {/* Section header + search */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">Integrations</p>
            <p className="text-sm text-[#bcbcd8]">
              Connect your data sources. Syncs automatically every day.
            </p>
          </div>
          <div className="relative shrink-0 sm:w-52">
            <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#58588a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search platform..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value && activeCategory === "Popular") setActiveCategory("All");
              }}
              className="w-full rounded-xl border border-[#363650] bg-[#222235] py-2 pl-9 pr-3 font-mono text-xs text-[#f8f8fc] placeholder:text-[#58588a] focus:border-[#00d4aa]/50 focus:outline-none focus:ring-1 focus:ring-[#00d4aa]/20 transition-all"
            />
          </div>
        </div>

        {/* Category pills */}
        {!searchQuery && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["Popular", ...INTEGRATION_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  activeCategory === cat
                    ? "bg-[#00d4aa] text-[#13131f] border border-[#00d4aa]"
                    : "border border-[#363650] bg-[#222235] text-[#8585aa] hover:border-[#00d4aa]/30 hover:text-[#e0e0f0]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Integration list */}
        <div className="flex flex-col gap-8">
          {UI_INTEGRATIONS.filter(
            (i) =>
              i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              i.description.toLowerCase().includes(searchQuery.toLowerCase())
          ).length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#8585aa]">No integrations match <span className="text-[#f8f8fc]">&ldquo;{searchQuery}&rdquo;</span></p>
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
            INTEGRATION_CATEGORIES.filter((cat) =>
              !searchQuery ? activeCategory === cat || activeCategory === "All" : true
            ).map((cat) => {
              const categoryIntegrations = UI_INTEGRATIONS.filter(
                (i) =>
                  i.category === cat &&
                  (i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    i.description.toLowerCase().includes(searchQuery.toLowerCase()))
              );
              if (categoryIntegrations.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#f8f8fc]">{cat}</h3>
                    <div className="h-px flex-1 bg-[#363650]" />
                  </div>
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

        {/* ── Goals & KPIs ──────────────────────────────── */}
        <section className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#635bff]/10 text-[#635bff]">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" />
              </svg>
            </div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">Goals &amp; KPIs</p>
          </div>
          <GoalsSection currencies={currencies} />
        </section>

      </div>{/* end Row 2 grid */}

      {/* ═══════════════════════════════════════════════════
          Row 3: Alert Rules + Email Digest (premium only)
          Side-by-side on lg+, stacked on smaller
      ═══════════════════════════════════════════════════ */}
      {isPremium && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Alert Rules */}
          <section className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f87171]/10 text-[#f87171]">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              </div>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">Alert Rules</p>
            </div>
            <AlertsSection currencies={currencies} />
          </section>

          {/* Email Digest */}
          <section className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00d4aa]/10 text-[#00d4aa]">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#8585aa]">Email Digest</p>
            </div>
            {/* Inline digest content (replaces the separate DigestSection wrapper) */}
            <DigestSectionInline email={email} />
          </section>
        </div>
      )}

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


