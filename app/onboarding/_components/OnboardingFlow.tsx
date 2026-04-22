"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Integration } from "@/lib/integrations/catalog";

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
      "Total revenue & MRR aggregates",
      "New customer count per day",
      "Subscription & charge events (count, amount)",
      "Refund totals",
    ],
    stores: [
      "Daily revenue snapshots (aggregate numbers only)",
      "Customer count per period",
      "Currency code",
    ],
    never: [
      "Card numbers, CVVs or bank details",
      "Customer personal details (name, email, address)",
      "Individual transaction IDs",
      "Webhook secret or restricted API keys",
    ],
    docsUrl: "https://stripe.com/docs/security",
  },
  ga4: {
    reads: [
      "Session counts per day",
      "Unique user / visitor counts",
      "Bounce rate & average session duration",
      "Top traffic sources (channel grouping)",
      "Conversion event totals",
    ],
    stores: [
      "Daily aggregated traffic metrics",
      "Traffic source breakdown (percentage)",
    ],
    never: [
      "Individual user identifiers or User IDs",
      "IP addresses",
      "Raw event streams",
      "Cookie data",
    ],
    docsUrl: "https://support.google.com/analytics/answer/6004245",
  },
  meta: {
    reads: [
      "Total ad spend per campaign per day",
      "Impressions & reach (aggregate)",
      "Click-through rate",
      "ROAS (return on ad spend)",
    ],
    stores: [
      "Daily spend & performance snapshots",
      "Campaign-level aggregated metrics",
    ],
    never: [
      "Audience demographics or personal data",
      "Custom audience lists",
      "Pixel data or retargeting data",
      "Individual ad account billing info",
    ],
    docsUrl: "https://www.facebook.com/privacy/policy",
  },
  "lemon-squeezy": {
    reads: [
      "Total revenue & order counts",
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
      "Your Lemon Squeezy store API secret (stored encrypted, never logged)",
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
      "Daily revenue snapshots",
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
      "Your Paddle vendor auth code (stored encrypted)",
    ],
    docsUrl: "https://www.paddle.com/legal/privacy",
  },
  plausible: {
    reads: [
      "Total pageviews per day",
      "Unique visitor counts",
      "Bounce rate",
      "Top pages (aggregated)",
      "Traffic sources (aggregated)",
    ],
    stores: [
      "Daily traffic metric snapshots",
    ],
    never: [
      "Individual visitor data (Plausible itself doesn't collect this)",
      "Cookies or user tracking identifiers",
      "Your site content",
    ],
    docsUrl: "https://plausible.io/privacy",
  },
  mailchimp: {
    reads: [
      "Total subscriber count per list",
      "New subscriber & unsubscribe counts per day",
      "Campaign open rate & click rate (aggregate)",
    ],
    stores: [
      "Daily subscriber count snapshots",
      "Aggregate campaign engagement metrics",
    ],
    never: [
      "Individual subscriber emails or names",
      "Subscriber tags or merge fields",
      "Email content or templates",
      "Your Mailchimp audience data",
    ],
    docsUrl: "https://mailchimp.com/legal/privacy/",
  },
  klaviyo: {
    reads: [
      "Total active profiles (subscriber count)",
      "Email campaign open & click rates (aggregate)",
      "Flow revenue attributed (aggregate totals)",
    ],
    stores: [
      "Daily subscriber & engagement snapshots",
    ],
    never: [
      "Individual subscriber profiles or emails",
      "Customer purchase history",
      "Segment membership data",
    ],
    docsUrl: "https://www.klaviyo.com/legal/privacy-notice",
  },
  beehiiv: {
    reads: [
      "Total subscriber count",
      "New subscriber count per period",
      "Paid upgrade counts",
      "Open rate (aggregate)",
    ],
    stores: [
      "Daily newsletter metric snapshots",
    ],
    never: [
      "Individual subscriber emails or names",
      "Email content",
      "Payment details of paid subscribers",
    ],
    docsUrl: "https://www.beehiiv.com/privacy",
  },
  shopify: {
    reads: [
      "Total orders & GMV per day",
      "Refund totals",
      "Product count (aggregate)",
      "New customer count per day",
    ],
    stores: [
      "Daily revenue & order snapshots",
      "Customer acquisition count",
    ],
    never: [
      "Customer names, emails or addresses",
      "Credit card or payment details",
      "Individual order line items",
      "Inventory or supplier data",
    ],
    docsUrl: "https://www.shopify.com/legal/privacy",
  },
  woocommerce: {
    reads: [
      "Total orders & revenue per day",
      "Refund totals",
      "New customer count",
    ],
    stores: [
      "Daily revenue & order snapshots",
    ],
    never: [
      "Customer personal data",
      "Payment method information",
      "WordPress database credentials",
      "Individual order details",
    ],
    docsUrl: "https://automattic.com/privacy/",
  },
};

// ── Platforms that require API key input instead of OAuth ─────────────────────
const API_KEY_PLATFORMS: Record<string, { fields: { name: string; label: string; placeholder: string; type?: string }[] }> = {
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

  const [selected, setSelected] = useState<Integration | null>(null);
  const [apiKeyFields, setApiKeyFields] = useState<Record<string, string>>({});
  const [shopDomain, setShopDomain] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(
    oauthError
      ? `Could not connect ${oauthError.replace(/-/g, " ")} — please try again.`
      : ""
  );
  const [success, setSuccess] = useState("");

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
      if (!val) {
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
      <header className="border-b border-[#1e1e30] bg-[#0d0d1a]/80 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/fold-primary-dark.svg" alt="Fold" className="h-7 w-auto" />
            <span className="hidden font-mono text-xs text-[#58588a] sm:block">/ Setup</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[11px] text-[#58588a] sm:block">{userEmail}</span>
            <button
              onClick={skipToDashboard}
              className="rounded-lg border border-[#363650] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8585aa] transition hover:text-[#bcbcd8]"
            >
              Skip for now
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
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
        <div className="mb-10 text-center">
          <h1 className="mb-3 font-mono text-3xl font-bold text-[#f8f8fc] sm:text-4xl">
            Connect your first integration
          </h1>
          <p className="mx-auto max-w-xl text-sm text-[#8585aa]">
            Fold pulls <strong className="text-[#bcbcd8]">aggregated metrics only</strong>, revenue totals,
            traffic counts, subscriber growth. No customer data. No personal info.
            Click any integration to see exactly what we read.
          </p>
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

          {/* LEFT — integration grid */}
          <div className="space-y-8">
            {grouped.map(({ category, integrations }) => (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[#8585aa]">{CATEGORY_ICONS[category] ?? (
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  )}</span>
                  <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa]">
                    {category}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {integrations.map((integration) => {
                    const isSelected = selected?.id === integration.id;
                    return (
                      <button
                        key={integration.id}
                        onClick={() => handleSelect(integration)}
                        className={`group relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? "border-[#00d4aa]/50 bg-[#00d4aa]/8 shadow-[0_0_0_1px_rgba(0,212,170,0.2)]"
                            : "border-[#363650] bg-[#1c1c2a]/60 hover:border-[#454560] hover:bg-[#222235]"
                        }`}
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: isSelected ? `${integration.color}20` : `${integration.color}12`,
                          }}
                        >
                          <img
                            src={integration.icon}
                            alt={integration.name}
                            width={22}
                            height={22}
                            className="object-contain"
                          />
                        </div>
                        <div>
                          <p className="font-mono text-[13px] font-semibold leading-snug text-[#f8f8fc]">
                            {integration.name}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-[#8585aa]">
                            {integration.description}
                          </p>
                        </div>
                        {isSelected && (
                          <span
                            className="absolute right-3 top-3 h-2 w-2 rounded-full"
                            style={{ backgroundColor: "#00d4aa" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT — detail panel */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            {!selected ? (
              /* Empty state */
              <div className="flex h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[#363650] bg-[#13131f] p-8 text-center lg:h-full lg:min-h-125">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#363650] bg-[#1c1c2a] opacity-40">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <p className="font-mono text-sm font-semibold text-[#f8f8fc] opacity-50">
                  Select an integration
                </p>
                <p className="mt-2 text-xs text-[#58588a]">
                  Click any card on the left to see what data we read and how to connect.
                </p>
              </div>
            ) : (
              /* Detail panel */
              <div className="rounded-2xl border border-[#363650] bg-[#13131f] overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center gap-4 p-5"
                  style={{ background: `linear-gradient(135deg, ${selected.color}12 0%, transparent 100%)` }}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${selected.color}20` }}
                  >
                    <img
                      src={selected.icon}
                      alt={selected.name}
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h2 className="font-mono text-base font-bold text-[#f8f8fc]">{selected.name}</h2>
                    <p className="text-xs text-[#8585aa]">{selected.description}</p>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Privacy breakdown */}
                  {privacy && (
                    <>
                      <PrivacyBlock
                        icon={
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        }
                        title="What we read"
                        color="#3b82f6"
                        items={privacy.reads}
                      />
                      <PrivacyBlock
                        icon={
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#8b5cf6" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125S3.75 11.278 3.75 9m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125S3.75 13.903 3.75 11.625" />
                          </svg>
                        }
                        title="What we store"
                        color="#8b5cf6"
                        items={privacy.stores}
                      />
                      <PrivacyBlock
                        icon={
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        }
                        title="What we never access"
                        color="#ef4444"
                        items={privacy.never}
                      />
                      {privacy.docsUrl && (
                        <a
                          href={privacy.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center font-mono text-[10px] text-[#58588a] underline-offset-2 hover:text-[#8585aa] hover:underline"
                        >
                          {selected.name} privacy policy →
                        </a>
                      )}
                    </>
                  )}

                  <div className="border-t border-[#1e1e30]" />

                  {/* Connect area */}
                  {success ? (
                    <div className="rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-4 py-3 text-center font-mono text-sm text-[#00d4aa]">
                      ✓ {success}
                    </div>
                  ) : isApiKey ? (
                    <ApiKeyForm
                      integration={selected}
                      fields={API_KEY_PLATFORMS[selected.id].fields}
                      values={apiKeyFields}
                      onChange={(name, val) =>
                        setApiKeyFields((prev) => ({ ...prev, [name]: val }))
                      }
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
            )}
          </div>
        </div>

        {/* ── Footer note ─────────────────────────────────────────────── */}
        <p className="mt-12 text-center font-mono text-[10px] text-[#3a3a55]">
          Fold is SOC 2-aligned. All data is encrypted at rest and in transit. We never sell or share your data.
          <button
            onClick={skipToDashboard}
            className="ml-2 text-[#58588a] underline underline-offset-2 hover:text-[#8585aa]"
          >
            Skip setup
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PrivacyBlock({
  icon,
  title,
  color,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="flex shrink-0 items-center">{icon}</span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>
          {title}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[12px] text-[#8585aa]">
            <span className="mt-0.5 shrink-0 text-[10px]" style={{ color: `${color}99` }}>
              ·
            </span>
            {item}
          </li>
        ))}
      </ul>
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
      <p className="text-[11px] text-[#8585aa]">
        You&apos;ll be redirected to <strong className="text-[#bcbcd8]">{integration.name}</strong> to
        authorize read-only access. You can revoke it at any time.
      </p>
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
          {error}
        </p>
      )}
      <button
        onClick={onConnect}
        className="w-full rounded-xl border px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-wider transition-all"
        style={{
          borderColor: `${integration.color}40`,
          backgroundColor: `${integration.color}12`,
          color: integration.color,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${integration.color}20`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${integration.color}12`;
        }}
      >
        Connect {integration.name} →
      </button>
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
  fields: { name: string; label: string; placeholder: string; type?: string }[];
  values: Record<string, string>;
  onChange: (name: string, val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-[11px] text-[#8585aa]">
        Enter your <strong className="text-[#bcbcd8]">{integration.name}</strong> credentials below.
        They are stored encrypted and never shared.
      </p>
      {fields.map((field) => (
        <div key={field.name}>
          <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8585aa]">
            {field.label}
          </label>
          <input
            type={field.type ?? "text"}
            value={values[field.name] ?? ""}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            autoComplete="off"
            className="w-full rounded-lg border border-[#363650] bg-[#1c1c2a] px-3 py-2 font-mono text-[12px] text-[#f8f8fc] placeholder-[#3a3a55] outline-none transition focus:border-[#00d4aa]/40 focus:ring-1 focus:ring-[#00d4aa]/20"
          />
        </div>
      ))}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl border px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
        style={{
          borderColor: `${integration.color}40`,
          backgroundColor: loading ? `${integration.color}08` : `${integration.color}12`,
          color: integration.color,
        }}
      >
        {loading ? "Connecting…" : `Connect ${integration.name} →`}
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
      <p className="text-[11px] text-[#8585aa]">
        Enter your Shopify store domain to start the connection. You&apos;ll be redirected to
        Shopify to authorize read-only access.
      </p>
      <div>
        <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8585aa]">
          Store domain
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="yourstore.myshopify.com"
          className="w-full rounded-lg border border-[#363650] bg-[#1c1c2a] px-3 py-2 font-mono text-[12px] text-[#f8f8fc] placeholder-[#3a3a55] outline-none transition focus:border-[#96bf48]/40 focus:ring-1 focus:ring-[#96bf48]/20"
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
      </div>
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
          {error}
        </p>
      )}
      <button
        onClick={onSubmit}
        className="w-full rounded-xl border px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-wider transition-all"
        style={{
          borderColor: `${integration.color}40`,
          backgroundColor: `${integration.color}12`,
          color: integration.color,
        }}
      >
        Connect Shopify →
      </button>
    </div>
  );
}
