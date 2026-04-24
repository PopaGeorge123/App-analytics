"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Integration } from "@/lib/integrations/catalog";

const POPULAR_IDS = new Set(["stripe", "ga4", "shopify", "mailchimp"]);

// ── Privacy data per integration ──────────────────────────────────────────────
// Addresses the Reddit comment: "what gets sent, what gets stored, who has access"

interface PrivacyInfo {
  reads: string[];      // Data we pull from the API
  stores: string[];     // What we actually save to our DB
  never: string[];      // Explicitly what we never touch
  docsUrl?: string;
}

const PRIVACY: Record<string, PrivacyInfo> = {
  stripe: {
    reads: [
      "Total revenue per day (sum of succeeded PaymentIntents)",
      "New customer count per day (unique customer IDs only)",
      "Transaction count per day",
      "Refund totals",
    ],
    stores: [
      "Daily revenue snapshot (aggregate number only)",
      "New customer count (number, not identities)",
      "Currency code",
    ],
    never: [
      "Card numbers, CVVs or bank details",
      "Customer names, emails or addresses",
      "Individual transaction IDs",
      "Subscription details or billing schedules",
    ],
    docsUrl: "https://stripe.com/docs/security",
  },
  ga4: {
    reads: [
      "Session count per day",
      "Total & new user counts",
      "Bounce rate & average session duration",
      "Conversion event totals",
    ],
    stores: [
      "Daily aggregated traffic metrics (counts only)",
    ],
    never: [
      "Individual user identifiers or User IDs",
      "IP addresses",
      "Raw event streams or page-level data",
      "Traffic source or referrer breakdown",
      "Cookie data",
    ],
    docsUrl: "https://support.google.com/analytics/answer/6004245",
  },
  meta: {
    reads: [
      "Total ad spend per day (account level)",
      "Impressions & reach (aggregate)",
      "Clicks",
      "Purchase conversions (count only)",
    ],
    stores: [
      "Daily spend & performance snapshot",
      "Currency code",
    ],
    never: [
      "Audience demographics or personal data",
      "Custom audience lists",
      "Pixel data or retargeting data",
      "Individual ad account billing info",
      "ROAS (not calculated — divide spend/revenue yourself)",
    ],
    docsUrl: "https://www.facebook.com/privacy/policy",
  },
  "lemon-squeezy": {
    reads: [
      "Total revenue & order counts per day",
      "Subscription MRR",
      "Refund totals",
    ],
    stores: [
      "Daily revenue snapshots",
      "Subscription counts",
    ],
    never: [
      "Customer personal information",
      "Payment method details",
      "Your API key (stored encrypted, never logged)",
    ],
    docsUrl: "https://www.lemonsqueezy.com/privacy",
  },
  gumroad: {
    reads: [
      "Total sales revenue per day",
      "Product sale counts",
      "Refund amounts",
    ],
    stores: [
      "Daily revenue snapshots (aggregate totals only)",
    ],
    never: [
      "Customer names or emails",
      "Payment details",
      "Individual purchase records",
    ],
    docsUrl: "https://gumroad.com/privacy",
  },
  paddle: {
    reads: [
      "Total revenue & MRR aggregates",
      "New subscription counts",
      "Churn events (count only)",
      "Refund totals",
    ],
    stores: [
      "Daily revenue & subscription snapshots",
      "Currency code",
    ],
    never: [
      "Customer billing addresses",
      "VAT / tax IDs",
      "Individual customer records",
      "Your API key (stored encrypted)",
    ],
    docsUrl: "https://www.paddle.com/legal/privacy",
  },
  plausible: {
    reads: [
      "Total pageviews per day",
      "Unique visitor count",
      "Bounce rate",
      "Average visit duration",
    ],
    stores: [
      "Daily traffic metric snapshot (4 numbers per day)",
    ],
    never: [
      "Individual visitor data (Plausible itself doesn't collect this)",
      "Top pages or referrer breakdown",
      "Traffic sources",
      "Cookies or user tracking identifiers",
      "Your site content",
    ],
    docsUrl: "https://plausible.io/privacy",
  },
  mailchimp: {
    reads: [
      "Emails sent, opens & clicks per campaign (aggregate)",
      "New subscribers & unsubscribes per list per day",
    ],
    stores: [
      "Daily campaign performance snapshot",
      "Daily subscriber growth counts",
    ],
    never: [
      "Individual subscriber emails or names",
      "Subscriber tags or merge fields",
      "Email content or templates",
      "Your audience list data",
    ],
    docsUrl: "https://mailchimp.com/legal/privacy/",
  },
  klaviyo: {
    reads: [
      "Emails sent, opens & clicks per day (aggregate event counts)",
      "Placed Order revenue attributed to Klaviyo events",
    ],
    stores: [
      "Daily email engagement snapshot",
      "Daily attributed revenue total",
    ],
    never: [
      "Individual subscriber profiles or emails",
      "Customer purchase history",
      "Segment membership data",
      "Flow or automation configurations",
    ],
    docsUrl: "https://www.klaviyo.com/legal/privacy-notice",
  },
  posthog: {
    reads: [
      "Total pageview event count per day",
      "Distinct person count (unique visitors)",
      "Session count per day",
    ],
    stores: [
      "Daily aggregated snapshot (3 numbers: pageviews, unique users, sessions)",
    ],
    never: [
      "Individual user identifiers or Person IDs",
      "Feature flag configurations",
      "Raw event streams or custom event properties",
      "Session recordings",
      "A/B test results or experiment data",
    ],
    docsUrl: "https://posthog.com/privacy",
  },
  beehiiv: {
    reads: [
      "Total active subscriber count",
      "Total premium subscriber count",
      "New subscribers created on a given day",
      "Posts published on a given day (count only)",
    ],
    stores: [
      "Daily newsletter snapshot (subscriber counts, posts published)",
    ],
    never: [
      "Individual subscriber emails or names",
      "Email content",
      "Payment details of paid subscribers",
      "Open rate (not fetched from the API)",
    ],
    docsUrl: "https://www.beehiiv.com/privacy",
  },
  shopify: {
    reads: [
      "Total orders & revenue per day",
      "Refund count per day",
      "Unique customer IDs per day (count only)",
    ],
    stores: [
      "Daily revenue & order snapshot",
      "New customer count (number, not identities)",
    ],
    never: [
      "Customer addresses",
      "Credit card or payment details",
      "Individual order line items",
      "Inventory or supplier data",
    ],
    docsUrl: "https://www.shopify.com/legal/privacy",
  },
  woocommerce: {
    reads: [
      "Total orders & revenue per day",
      "Refund count per day",
      "Customer billing email & name (for LTV tracking in the Customers tab)",
    ],
    stores: [
      "Daily revenue & order snapshot",
      "Customer records: email, name, lifetime spend (in your Fold account only)",
    ],
    never: [
      "Credit card or payment method details",
      "WordPress admin credentials",
      "Individual order line items or product details",
      "Shipping addresses",
    ],
    docsUrl: "https://automattic.com/privacy/",
  },
  hubspot: {
    reads: [
      "Deals closed (won) per day — count & revenue amount",
      "Active pipeline value (open deals, aggregate)",
      "New contacts created per day (count only)",
    ],
    stores: [
      "Daily CRM snapshot: deals won, closed revenue, pipeline value, new contacts",
    ],
    never: [
      "Individual contact names, emails or phone numbers",
      "Deal notes or activity history",
      "Company or association data",
      "Your HubSpot access token is stored encrypted and never logged",
    ],
    docsUrl: "https://legal.hubspot.com/privacy-policy",
  },
};

// ── Platforms that require API key input instead of OAuth ─────────────────────
const API_KEY_PLATFORMS: Record<string, { fields: { name: string; label: string; placeholder: string; type?: string; optional?: boolean }[] }> = {
  "lemon-squeezy": {
    fields: [{ name: "apiKey", label: "API Key", placeholder: "Your Lemon Squeezy API key" }],
  },
  paddle: {
    fields: [{ name: "apiKey", label: "API Key", placeholder: "Your Paddle API key" }],
  },
  plausible: {
    fields: [
      { name: "apiKey", label: "API Key", placeholder: "Your Plausible API key" },
      { name: "siteId", label: "Site Hostname", placeholder: "yourdomain.com" },
    ],
  },
  beehiiv: {
    fields: [
      { name: "apiKey", label: "API Key", placeholder: "Your Beehiiv API key" },
      { name: "publicationId", label: "Publication ID", placeholder: "pub_xxxxxxxx" },
    ],
  },
  posthog: {
    fields: [
      { name: "apiKey", label: "Personal API Key", placeholder: "phx_…" },
      { name: "projectId", label: "Project ID ", placeholder: "123456" },
    ],
  },
};

// Platforms that need an extra param (shop domain) before OAuth redirect
const PARAM_REQUIRED: Record<string, { param: string; label: string; placeholder: string }> = {
  shopify: { param: "shop", label: "Store domain", placeholder: "yourstore.myshopify.com" },
};

// Category display order
const CATEGORY_ORDER = [
  "Payments & Revenue",
  "Web Analytics",
  "Advertising",
  "Email & Marketing",
  "E-commerce",
];

// SVG icons per category (inline, no emoji)
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Payments & Revenue": (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  "Web Analytics": (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  "Advertising": (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
    </svg>
  ),
  "Email & Marketing": (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  "E-commerce": (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
};

// ── Component ─────────────────────────────────────────────────────────────────

interface OnboardingFlowProps {
  liveIntegrations: Integration[];
  userEmail: string;
  oauthError?: string | null;
}

export default function OnboardingFlow({ liveIntegrations, userEmail, oauthError }: OnboardingFlowProps) {
  const router = useRouter();

  // Auto-select Stripe (or first available) so the connect CTA is visible on load
  const defaultIntegration = liveIntegrations.find((i) => i.id === "stripe") ?? liveIntegrations[0] ?? null;

  const [selected, setSelected] = useState<Integration | null>(defaultIntegration);
  const [apiKeyFields, setApiKeyFields] = useState<Record<string, string>>({});
  const [shopDomain, setShopDomain] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(
    oauthError
      ? `Could not connect ${oauthError.replace(/-/g, " ")} — please try again.`
      : ""
  );
  const [success, setSuccess] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (sheetOpen && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sheetOpen]);

  // Set a short-lived cookie so the middleware lets the user through to /dashboard
  // even if they have 0 integrations (explicit skip — expires after 24 hours)
  function skipToDashboard() {
    document.cookie = "onboarding_skipped=1; path=/; max-age=86400; SameSite=Lax";
    router.push("/dashboard");
  }

  // Group integrations by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    integrations: liveIntegrations.filter((i) => i.category === cat),
  })).filter((g) => g.integrations.length > 0);

  const isApiKey = selected ? !!API_KEY_PLATFORMS[selected.id] : false;
  const isParamRequired = selected ? !!PARAM_REQUIRED[selected.id] : false;
  const privacy = selected ? PRIVACY[selected.id] : null;

  function handleSelect(integration: Integration) {
    setSelected(integration);
    setApiKeyFields({});
    setShopDomain("");
    setError("");
    setSuccess("");
    setConnecting(false);
    setSheetOpen(true);
  }

  function handleOAuthConnect() {
    if (!selected) return;

    if (isParamRequired) {
      const cfg = PARAM_REQUIRED[selected.id];
      if (!shopDomain.trim()) {
        setError(`Please enter your ${cfg.label.toLowerCase()}.`);
        return;
      }
      let finalDomain = shopDomain.trim();
      if (selected.id === "shopify" && !finalDomain.includes(".")) {
        finalDomain = `${finalDomain}.myshopify.com`;
      }
      window.location.href = `${selected.connectUrl}?${cfg.param}=${encodeURIComponent(finalDomain)}`;
      return;
    }

    // Direct OAuth redirect — after callback, middleware will route to /dashboard
    window.location.href = selected.connectUrl!;
  }

  async function handleApiKeyConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const cfg = API_KEY_PLATFORMS[selected.id];
    const payload: Record<string, string> = {};
    for (const field of cfg.fields) {
      const val = (apiKeyFields[field.name] ?? "").trim();
      if (!val && !field.optional) {
        setError(`Please fill in ${field.label}.`);
        return;
      }
      payload[field.name] = val;
    }

    setConnecting(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Session expired. Please refresh and try again.");
        setConnecting(false);
        return;
      }

      const res = await fetch(`/api/auth/${selected.id}/connect`, {
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
        setError(result?.error ?? "Failed to connect. Check your credentials and try again.");
        setConnecting(false);
        return;
      }

      setSuccess(`${selected.name} connected successfully! Redirecting to your dashboard…`);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      setError("Network error. Please try again.");
      setConnecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#090911] text-[#f8f8fc]">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="border-b border-[#1e1e30] bg-[#0d0d1a]/90 backdrop-blur-sm px-6 py-3.5 sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/fold-primary-dark.svg" alt="Fold" className="h-7 w-auto" />
            <span className="hidden font-mono text-xs text-[#2d2d44] sm:block select-none">/</span>
            {/* Step indicator */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#00d4aa]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#00d4aa] text-[8px] font-bold text-[#090911]">1</span>
                Choose integration
              </span>
              <span className="font-mono text-[11px] text-[#2d2d44]">→</span>
              <span className={`flex items-center gap-1.5 font-mono text-[11px] transition-colors ${selected ? "text-[#8585aa]" : "text-[#3a3a55]"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold transition-colors ${selected ? "bg-[#363650] text-[#8585aa]" : "border border-[#2d2d44] text-[#3a3a55]"}`}>2</span>
                Connect
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] text-[#3a3a55] sm:block truncate max-w-45">{userEmail}</span>
            <button
              onClick={skipToDashboard}
              className="font-mono text-[10px] text-[#2d2d44] hover:text-[#4a4a6a] transition underline-offset-2 hover:underline"
            >
              Skip
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* ── OAuth error banner ───────────────────────────────────────── */}
        {oauthError && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2} className="shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-400">
              Could not connect <strong className="text-red-300">{oauthError.replace(/-/g, " ")}</strong> — the authorization was denied or something went wrong. Please try again.
            </p>
          </div>
        )}

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1e1e30] bg-[#13131f] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-mono text-[10px] text-[#8585aa]">{liveIntegrations.length} integrations available</span>
          </div>
          <h1 className="mb-2 font-mono text-2xl font-bold text-[#f8f8fc] sm:text-3xl">
            Connect your first integration
          </h1>
          <p className="mx-auto max-w-lg text-sm text-[#58588a] leading-relaxed">
            Pick one below, you can add more later. Takes about <strong className="text-[#8585aa]">30 seconds</strong>.
          </p>
        </div>

        {/* ── Quick-start strip ─────────────────────────────────────────── */}
        <div className="mb-7">
          <p className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#3a3a55]">
            Most popular starting points
          </p>
          <div className="flex flex-wrap gap-2">
            {liveIntegrations.filter((i) => POPULAR_IDS.has(i.id)).map((integration) => {
              const isSelected = selected?.id === integration.id;
              return (
                <button
                  key={integration.id}
                  onClick={() => handleSelect(integration)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-[11px] font-semibold transition-all duration-150 ${
                    isSelected
                      ? "border-[#00d4aa]/50 bg-[#00d4aa]/10 text-[#00d4aa]"
                      : "border-[#222233] bg-[#0f0f1a] text-[#8585aa] hover:border-[#363650] hover:text-[#c0c0d8]"
                  }`}
                >
                  <img src={integration.icon} alt={integration.name} width={14} height={14} className="object-contain" />
                  {integration.name}
                  {isSelected && (
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
            <span className="flex items-center px-1 font-mono text-[10px] text-[#2d2d44]">or pick any below ↓</span>
          </div>
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

          {/* LEFT — integration grid */}
          <div className="space-y-7">
            {grouped.map(({ category, integrations }) => (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[#58588a]">{CATEGORY_ICONS[category] ?? (
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  )}</span>
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#58588a]">
                    {category}
                  </h2>
                  <span className="font-mono text-[10px] text-[#2d2d44]">({integrations.length})</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {integrations.map((integration) => {
                    const isSelected = selected?.id === integration.id;
                    const isPopular = POPULAR_IDS.has(integration.id);
                    return (
                      <button
                        key={integration.id}
                        onClick={() => handleSelect(integration)}
                        className={`group relative flex flex-col items-start gap-2.5 rounded-xl border p-3.5 text-left transition-all duration-150 ${
                          isSelected
                            ? "border-[#00d4aa]/50 bg-[#00d4aa]/8 shadow-[0_0_0_1px_rgba(0,212,170,0.15),0_4px_20px_rgba(0,212,170,0.06)]"
                            : "border-[#222233] bg-[#0f0f1a] hover:border-[#363650] hover:bg-[#13131f]"
                        }`}
                      >
                        {/* Popular badge */}
                        {isPopular && !isSelected && (
                          <span className="absolute right-2.5 top-2.5 rounded-full bg-[#1a1a2e] border border-[#2d2d44] px-1.5 py-0.5 font-mono text-[8px] font-semibold text-[#58588a] uppercase tracking-wider">
                            Popular
                          </span>
                        )}
                        {/* Selected check */}
                        {isSelected && (
                          <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#00d4aa]">
                            <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="#090911" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                        )}
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg transition-all"
                          style={{
                            backgroundColor: isSelected ? `${integration.color}25` : `${integration.color}10`,
                          }}
                        >
                          <img
                            src={integration.icon}
                            alt={integration.name}
                            width={20}
                            height={20}
                            className="object-contain"
                          />
                        </div>
                        <div className="pr-5">
                          <p className="font-mono text-[12px] font-semibold leading-snug text-[#e8e8f8]">
                            {integration.name}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-snug text-[#58588a]">
                            {integration.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT — detail panel (desktop only) */}
          <div className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
            {!selected ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#1e1e30] bg-[#0d0d18] p-8 text-center min-h-110">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1e1e30] bg-[#13131f]">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#3a3a55" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <p className="font-mono text-sm font-semibold text-[#4a4a6a] mb-1">
                  Pick an integration
                </p>
                <p className="text-xs text-[#2d2d44] mb-6">
                  We&apos;ll show you exactly what we read before you connect.
                </p>
                <div className="w-full space-y-2 text-left">
                  {[
                    { icon: "🔒", text: "Aggregated data only — never personal info" },
                    { icon: "⚡", text: "Daily snapshots synced automatically" },
                    { icon: "🔌", text: "Revoke access any time from the provider" },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5 rounded-lg border border-[#1a1a28] bg-[#111120] px-3 py-2">
                      <span className="text-sm">{icon}</span>
                      <span className="text-[11px] text-[#4a4a6a]">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <DetailPanel
                selected={selected}
                privacy={privacy}
                isApiKey={isApiKey}
                isParamRequired={isParamRequired}
                success={success}
                error={error}
                connecting={connecting}
                apiKeyFields={apiKeyFields}
                shopDomain={shopDomain}
                setApiKeyFields={setApiKeyFields}
                setShopDomain={setShopDomain}
                handleApiKeyConnect={handleApiKeyConnect}
                handleOAuthConnect={handleOAuthConnect}
                onClose={() => { setSelected(null); }}
              />
            )}
          </div>
        </div>

        {/* ── Footer note ─────────────────────────────────────────────── */}
        <p className="mt-10 text-center font-mono text-[10px] text-[#252535]">
          Fold is SOC 2-aligned · All data encrypted at rest and in transit · We never sell or share your data
          <button
            onClick={skipToDashboard}
            className="ml-2 text-[#3a3a55] underline underline-offset-2 hover:text-[#58588a]"
          >
            Skip setup
          </button>
        </p>
      </div>

      {/* ── Mobile bottom sheet ───────────────────────────────────────────── */}
      {sheetOpen && selected && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          {/* Sheet */}
          <div className="relative z-10 max-h-[90dvh] overflow-y-auto rounded-t-3xl border-t border-[#1e1e30] bg-[#0d0d18]">
            {/* Handle */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1a1a28] bg-[#0d0d18]/95 backdrop-blur-sm px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${selected.color}18` }}
                >
                  <img src={selected.icon} alt={selected.name} width={18} height={18} className="object-contain" />
                </div>
                <span className="font-mono text-sm font-semibold text-[#e8e8f8]">{selected.name}</span>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="rounded-lg p-1.5 text-[#58588a] hover:bg-[#1e1e30] hover:text-[#8585aa] transition"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <DetailPanel
                selected={selected}
                privacy={privacy}
                isApiKey={isApiKey}
                isParamRequired={isParamRequired}
                success={success}
                error={error}
                connecting={connecting}
                apiKeyFields={apiKeyFields}
                shopDomain={shopDomain}
                setApiKeyFields={setApiKeyFields}
                setShopDomain={setShopDomain}
                handleApiKeyConnect={handleApiKeyConnect}
                handleOAuthConnect={handleOAuthConnect}
                onClose={() => setSheetOpen(false)}
                isMobile
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailPanel({
  selected,
  privacy,
  isApiKey,
  isParamRequired,
  success,
  error,
  connecting,
  apiKeyFields,
  shopDomain,
  setApiKeyFields,
  setShopDomain,
  handleApiKeyConnect,
  handleOAuthConnect,
  onClose,
  isMobile,
}: {
  selected: Integration;
  privacy: PrivacyInfo | null;
  isApiKey: boolean;
  isParamRequired: boolean;
  success: string;
  error: string;
  connecting: boolean;
  apiKeyFields: Record<string, string>;
  shopDomain: string;
  setApiKeyFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setShopDomain: (v: string) => void;
  handleApiKeyConnect: (e: React.FormEvent) => void;
  handleOAuthConnect: () => void;
  onClose: () => void;
  isMobile?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-[#1e1e30] bg-[#0d0d18] overflow-hidden`}>
      {/* Header */}
      {!isMobile && (
        <div
          className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a28]"
          style={{ background: `linear-gradient(135deg, ${selected.color}10 0%, transparent 70%)` }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${selected.color}18` }}
          >
            <img src={selected.icon} alt={selected.name} width={24} height={24} className="object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-mono text-sm font-bold text-[#e8e8f8]">{selected.name}</h2>
            <p className="text-[11px] text-[#4a4a6a] truncate">{selected.description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#3a3a55] hover:bg-[#1a1a28] hover:text-[#58588a] transition shrink-0"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Privacy breakdown */}
        {privacy && (
          <div className="space-y-1">
            <PrivacyBlock
              icon={<svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}
              title="What we read"
              color="#3b82f6"
              items={privacy.reads}
              defaultOpen
            />
            <PrivacyBlock
              icon={<svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#8b5cf6" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125S3.75 11.278 3.75 9m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125S3.75 13.903 3.75 11.625" /></svg>}
              title="What we store"
              color="#8b5cf6"
              items={privacy.stores}
            />
            <PrivacyBlock
              icon={<svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
              title="Never accessed"
              color="#ef4444"
              items={privacy.never}
            />
            <div className="flex items-center justify-between pt-1">
              <a
                href={`/learn/${selected.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-[#5a5a8a] underline-offset-2 hover:text-[#8b8bff] hover:underline"
              >
                How we use {selected.name} data →
              </a>
              {privacy.docsUrl && (
                <a
                  href={privacy.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-[#3a3a55] underline-offset-2 hover:text-[#58588a] hover:underline"
                >
                  {selected.name} privacy policy →
                </a>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-[#141420]" />

        {/* Connect area */}
        {success ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-4 py-5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00d4aa]/20">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="font-mono text-sm font-semibold text-[#00d4aa]">Connected!</p>
            <p className="text-[11px] text-[#3d8c7a]">Redirecting to your dashboard…</p>
          </div>
        ) : isApiKey ? (
          <ApiKeyForm
            integration={selected}
            fields={API_KEY_PLATFORMS[selected.id].fields}
            values={apiKeyFields}
            onChange={(name, val) => setApiKeyFields((prev) => ({ ...prev, [name]: val }))}
            onSubmit={handleApiKeyConnect}
            loading={connecting}
            error={error}
          />
        ) : isParamRequired ? (
          <ShopifyForm
            integration={selected}
            value={shopDomain}
            onChange={setShopDomain}
            onSubmit={handleOAuthConnect}
            error={error}
          />
        ) : (
          <OAuthConnect
            integration={selected}
            onConnect={handleOAuthConnect}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

function PrivacyBlock({
  icon,
  title,
  color,
  items,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-[#141420] bg-[#0a0a14] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-[#111120] transition"
      >
        <div className="flex items-center gap-2">
          <span className="flex shrink-0 items-center">{icon}</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>
            {title}
          </span>
          <span className="font-mono text-[9px] text-[#2d2d44]">({items.length})</span>
        </div>
        <svg
          width="10"
          height="10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#3a3a55"
          strokeWidth={2.5}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <ul className="px-3 pb-3 space-y-1.5 border-t border-[#141420]">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 pt-1.5 text-[11px] text-[#58588a]">
              <span className="mt-0.5 shrink-0 text-[9px]" style={{ color: `${color}80` }}>▸</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OAuthConnect({
  integration,
  onConnect,
  error,
}: {
  integration: Integration;
  onConnect: () => void;
  error: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[#4a4a6a] leading-relaxed">
        You&apos;ll be redirected to <strong className="text-[#8585aa]">{integration.name}</strong> to
        authorize read-only access. You can revoke it from {integration.name}&apos;s dashboard at any time.
      </p>
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2 font-mono text-[11px] text-red-400">
          {error}
        </p>
      )}
      <button
        onClick={onConnect}
        className="group relative w-full overflow-hidden rounded-xl px-4 py-3.5 font-mono text-[12px] font-semibold uppercase tracking-wider transition-all duration-200"
        style={{
          border: `1px solid ${integration.color}35`,
          backgroundColor: `${integration.color}10`,
          color: integration.color,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${integration.color}1e`;
          (e.currentTarget as HTMLButtonElement).style.borderColor = `${integration.color}55`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${integration.color}10`;
          (e.currentTarget as HTMLButtonElement).style.borderColor = `${integration.color}35`;
        }}
      >
        <span className="flex items-center justify-center gap-2">
          <img src={integration.icon} alt="" width={14} height={14} className="object-contain opacity-80" />
          Connect {integration.name}
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </button>
      <p className="text-center font-mono text-[10px] text-[#2d2d44]">~30 seconds · read-only · add more integrations later</p>
    </div>
  );
}

function ApiKeyForm({
  integration,
  fields,
  values,
  onChange,
  onSubmit,
  loading,
  error,
}: {
  integration: Integration;
  fields: { name: string; label: string; placeholder: string; type?: string; optional?: boolean }[];
  values: Record<string, string>;
  onChange: (name: string, val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-[11px] text-[#4a4a6a] leading-relaxed">
        Enter your <strong className="text-[#8585aa]">{integration.name}</strong> credentials below.
        They&apos;re stored encrypted and never logged or shared.
      </p>
      {fields.map((field) => (
        <div key={field.name}>
          <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#58588a]">
            {field.label}
            {field.optional && (
              <span className="normal-case tracking-normal font-normal text-[#2d2d44]">(optional)</span>
            )}
          </label>
          <input
            type={field.type ?? "text"}
            value={values[field.name] ?? ""}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            autoComplete="off"
            className="w-full rounded-lg border border-[#1e1e30] bg-[#0a0a14] px-3 py-2.5 font-mono text-[12px] text-[#e8e8f8] placeholder-[#252535] outline-none transition focus:border-[#00d4aa]/35 focus:ring-1 focus:ring-[#00d4aa]/15"
          />
        </div>
      ))}
      {error && (
        <p className="rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 font-mono text-[11px] text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="group relative w-full overflow-hidden rounded-xl px-4 py-3.5 font-mono text-[12px] font-semibold uppercase tracking-wider transition-all duration-200 disabled:opacity-40"
        style={{
          border: `1px solid ${integration.color}35`,
          backgroundColor: loading ? `${integration.color}08` : `${integration.color}10`,
          color: integration.color,
        }}
        onMouseEnter={(e) => {
          if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${integration.color}1e`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = loading ? `${integration.color}08` : `${integration.color}10`;
        }}
      >
        <span className="flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="animate-spin">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Connecting…
            </>
          ) : (
            <>
              <img src={integration.icon} alt="" width={14} height={14} className="object-contain opacity-80" />
              Connect {integration.name}
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </>
          )}
        </span>
      </button>
    </form>
  );
}

function ShopifyForm({
  integration,
  value,
  onChange,
  onSubmit,
  error,
}: {
  integration: Integration;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[#4a4a6a] leading-relaxed">
        Enter your Shopify store domain to start the connection. You&apos;ll be redirected to
        Shopify to authorize read-only access.
      </p>
      <div>
        <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#58588a]">
          Store domain
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="yourstore.myshopify.com"
          className="w-full rounded-lg border border-[#1e1e30] bg-[#0a0a14] px-3 py-2.5 font-mono text-[12px] text-[#e8e8f8] placeholder-[#252535] outline-none transition focus:border-[#96bf48]/35 focus:ring-1 focus:ring-[#96bf48]/15"
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
      </div>
      {error && (
        <p className="rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 font-mono text-[11px] text-red-400">
          {error}
        </p>
      )}
      <button
        onClick={onSubmit}
        className="group w-full rounded-xl px-4 py-3.5 font-mono text-[12px] font-semibold uppercase tracking-wider transition-all duration-200"
        style={{
          border: `1px solid ${integration.color}35`,
          backgroundColor: `${integration.color}10`,
          color: integration.color,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${integration.color}1e`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${integration.color}10`;
        }}
      >
        <span className="flex items-center justify-center gap-2">
          <img src={integration.icon} alt="" width={14} height={14} className="object-contain opacity-80" />
          Connect Shopify
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </button>
    </div>
  );
}
