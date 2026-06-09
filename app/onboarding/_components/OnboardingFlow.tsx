"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Integration } from "@/lib/integrations/catalog";

const POPULAR_IDS = new Set(["shopify"]);

// ── Privacy data per integration ──────────────────────────────────────────────
// Addresses the Reddit comment: "what gets sent, what gets stored, who has access"

interface PrivacyInfo {
  reads: string[];      // Data we pull from the API
  stores: string[];     // What we actually save to our DB
  never: string[];      // Explicitly what we never touch
  docsUrl?: string;
}

const PRIVACY: Record<string, PrivacyInfo> = {
  shopify: {
    reads: [
      "Orders per day — gross & net revenue, AOV, refunds, discounts, shipping & tax",
      "New vs. returning customer counts",
      "Abandoned checkouts & cart-abandonment rate",
      "Fulfillment time (order → first shipment)",
      "Top products by revenue & units sold",
      "Top countries by revenue & sales-channel breakdown",
      "Inventory levels (low-stock & out-of-stock alerts)",
      "Customer contact details (name, email, phone, city/country) for the Customers tab",
    ],
    stores: [
      "Daily snapshot: gross & net revenue, refunds, discounts, shipping, tax, orders, AOV, new/returning customers, cart-abandonment rate, avg. fulfillment time, top products, top countries, channel breakdown & low-stock alerts",
      "Product records: name, revenue & units sold",
      "Customer records: name, email, phone, city/country, lifetime spend, order count, recent orders (with line items), marketing consent & tags — in your Fold account only",
    ],
    never: [
      "Credit-card numbers or payment-method details",
      "Your Shopify admin password (the access token is stored encrypted and never logged)",
    ],
    docsUrl: "https://www.shopify.com/legal/privacy",
  },
};

// ── Dashboard preview metrics per integration ──────────────────────────────
// Shopify-only — every metric below maps to a field synced into `daily_snapshots.data`
// by syncShopifyDay() in cronscript/sync-all.mjs.
const PREVIEW_METRICS: Record<string, { label: string; value: string; trend?: string }[]> = {
  shopify: [
    { label: "GMV (7d)", value: "$6,120", trend: "↑ +15%" },
    { label: "Orders", value: "84" },
    { label: "Avg order value", value: "$72.86" },
    { label: "Refund rate", value: "1.9%" },
    { label: "New customers", value: "61" },
    { label: "Cart abandonment", value: "64%" },
  ],
};

const DEFAULT_PREVIEW_METRICS = [
  { label: "GMV (7d)", value: "$6,120", trend: "↑ +15%" },
  { label: "Orders", value: "84" },
  { label: "Avg order value", value: "$72.86" },
  { label: "Refund rate", value: "1.9%" },
];


// Shopify connects via OAuth after the store-domain prompt (see PARAM_REQUIRED),
// so there are no API-key platforms in this onboarding flow.
const API_KEY_PLATFORMS: Record<string, { fields: { name: string; label: string; placeholder: string; type?: string; optional?: boolean }[] }> = {};

// Platforms that need an extra param (shop domain) before OAuth redirect
const PARAM_REQUIRED: Record<string, { param: string; label: string; placeholder: string }> = {
  shopify: { param: "shop", label: "Store domain", placeholder: "yourstore.myshopify.com" },
};

// Category display order — Shopify only (matches the catalog category id)
const CATEGORY_ORDER = [
  "E-commerce Stores",
];

// SVG icons per category (inline, no emoji)
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "E-commerce Stores": (
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
  hideHeader?: boolean;
}

export default function OnboardingFlow({ liveIntegrations, userEmail, oauthError, hideHeader = false }: OnboardingFlowProps) {
  const router = useRouter();

  // Shopify is the only supported integration in this flow — ignore anything else
  // that might be passed in so the page never offers a connection we don't sync.
  const shopifyIntegrations = liveIntegrations.filter((i) => i.id === "shopify");

  // Auto-select Shopify so the connect CTA is visible on load
  const defaultIntegration = shopifyIntegrations[0] ?? null;

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

  useEffect(() => {
    //get the store url of user
    async function fetchStoreUrl() {
      try {
        const res = await fetch("/api/onboarding/profile");
        const data = await res.json();
        setShopDomain(data.storeUrl || "");
      } catch (error) {
        console.error("Error fetching store URL:", error);
      }
    }
    fetchStoreUrl();
  }, []);

  // Set a short-lived cookie so the middleware lets the user through to /dashboard
  // even if they have 0 integrations (explicit skip — expires after 24 hours)
  function skipToDashboard() {
    // Persist a short-lived cookie so middleware will allow access.
    document.cookie = "onboarding_skipped=1; path=/; max-age=86400; SameSite=Lax";

    // Fire a same-origin analytics beacon to avoid reading cross-origin responses
    // which can trigger CORB. Prefer navigator.sendBeacon for fire-and-forget.
    try {
      const payload = JSON.stringify({ event: 'onboarding_skip', ts: Date.now() });
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        navigator.sendBeacon('/api/beacon', new Blob([payload], { type: 'application/json' }));
      } else {
        // Fallback: send a keepalive fetch without reading the response
        fetch('/api/beacon', { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(()=>{});
      }
    } catch (e) {
      // ignore any errors from analytics beacon
    }

    router.push("/dashboard");
  }

  // Group integrations by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    integrations: shopifyIntegrations.filter((i) => i.category === cat),
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
    <div className="min-h-screen bg-[#f8f8fc] text-[#1a1a2e]">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      {!hideHeader && (
      <header className="border-b border-[#d4d4e8] bg-[#f4f4fc]/90 backdrop-blur-sm px-6 py-3.5 sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/fold-primary-light.svg" alt="Fold" className="h-7 w-auto" />
            <span className="hidden font-mono text-xs text-[#6868a0] sm:block select-none">/</span>
            {/* Step indicator */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#00d4aa]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#00d4aa] text-[8px] font-bold text-[#1a1a2e]">1</span>
                Choose integration
              </span>
              <span className="font-mono text-[11px] text-[#6868a0]">→</span>
              <span className={`flex items-center gap-1.5 font-mono text-[11px] transition-colors ${selected ? "text-[#6a6a90]" : "text-[#7878a8]"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold transition-colors ${selected ? "bg-[#d4d4e8] text-[#6a6a90]" : "border border-[#d0d0ec] text-[#7878a8]"}`}>2</span>
                Connect
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] text-[#7878a8] sm:block truncate max-w-45">{userEmail}</span>
            <button
              onClick={skipToDashboard}
              className="font-mono text-[11px] font-semibold text-[#1a1a2e] hover:text-[#1a1a2e] border border-[#b8b8d8] hover:border-[#8080b0] rounded-lg px-3 py-1.5 transition"
            >
              Skip
            </button>
          </div>
        </div>
      </header>
      )}

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
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-mono text-[10px] text-[#00d4aa]/80">142 founders connected Shopify this week</span>
          </div>
          <h1 className="mb-2 font-mono text-2xl font-bold text-[#1a1a2e] sm:text-3xl">
            Find your store bottlenecks in 30 seconds
          </h1>
          <p className="mx-auto max-w-lg text-sm text-[#6070a0] leading-relaxed">
            Connect Shopify and your store data will be analyzed instantly.
          </p>
        </div>

        {/* ── Quick-start strip ─────────────────────────────────────────── */}
        {/* <div className="mb-7">
          <p className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#7878a8]">
            Most popular starting points
          </p>
          <div className="flex flex-wrap gap-2">
            {shopifyIntegrations.filter((i) => POPULAR_IDS.has(i.id)).map((integration) => {
              const isSelected = selected?.id === integration.id;
              return (
                <button
                  key={integration.id}
                  onClick={() => handleSelect(integration)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-[11px] font-semibold transition-all duration-150 ${
                    isSelected
                      ? "border-[#00d4aa]/50 bg-[#00d4aa]/10 text-[#00d4aa]"
                      : "border-[#ccccec] bg-[#f0f0fc] text-[#6a6a90] hover:border-[#d4d4e8] hover:text-[#c0c0d8]"
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
            <span className="flex items-center px-1 font-mono text-[10px] text-[#6868a0]">or pick any below ↓</span>
          </div>
        </div> */}

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_480px]">

          {/* LEFT — integration grid */}
          <div className="space-y-7">
            {grouped.map(({ category, integrations }) => (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[#6070a0]">{CATEGORY_ICONS[category] ?? (
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  )}</span>
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#6070a0]">
                    {category}
                  </h2>
                  <span className="font-mono text-[10px] text-[#6868a0]">({integrations.length})</span>
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
                            : "border-[#ccccec] bg-[#f0f0fc] hover:border-[#d4d4e8] hover:bg-[#fafafa]"
                        }`}
                      >
                        {/* Popular badge */}
                        {isPopular && !isSelected && (
                          <span className="absolute right-2.5 top-2.5 rounded-full bg-[#ebebf8] border border-[#d0d0ec] px-1.5 py-0.5 font-mono text-[8px] font-semibold text-[#6070a0] uppercase tracking-wider">
                            Popular
                          </span>
                        )}
                        {/* Selected check */}
                        {isSelected && (
                          <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#00d4aa]">
                            <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="#1a1a2e" strokeWidth={3}>
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
                          <p className="font-mono text-[12px] font-semibold leading-snug text-[#393939]">
                            {integration.name}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-snug text-[#6070a0]">
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
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d4d4e8] bg-[#f3f3fc] p-8 text-center min-h-110">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4d4e8] bg-[#fafafa]">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#3a3a55" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <p className="font-mono text-sm font-semibold text-[#5a5a7a] mb-1">
                  Pick an integration
                </p>
                <p className="text-xs text-[#6868a0] mb-6">
                  We&apos;ll show you exactly what we read before you connect.
                </p>
                <div className="w-full space-y-2 text-left">
                  {[
                    { icon: "", text: "Aggregated data only — never personal info" },
                    { icon: "", text: "Daily snapshots synced automatically" },
                    { icon: "", text: "Revoke access any time from the provider" },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5 rounded-lg border border-[#c8c8ec] bg-[#f5f5fb] px-3 py-2">
                      <span className="text-sm">{icon}</span>
                      <span className="text-[11px] text-[#5a5a7a]">{text}</span>
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
        <p className="mt-10 text-center font-mono text-[10px] text-[#6060a0]">
          Fold is SOC 2-aligned · All data encrypted at rest and in transit · We never sell or share your data
          <button
            onClick={skipToDashboard}
            className="ml-2 text-[#6070a0] underline underline-offset-2 hover:text-[#c0c0e0] transition"
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
          <div className="relative z-10 max-h-[90dvh] overflow-y-auto rounded-t-3xl border-t border-[#d4d4e8] bg-[#f3f3fc]">
            {/* Handle */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#c8c8ec] bg-[#f3f3fc]/95 backdrop-blur-sm px-5 py-3.5">
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
                className="rounded-lg p-1.5 text-[#6070a0] hover:bg-[#ebebf5] hover:text-[#6a6a90] transition"
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
    <div className={`rounded-2xl border border-[#d4d4e8] bg-[#f3f3fc] overflow-hidden`}>
      {/* Header */}
      {!isMobile && (
        <div
          className="flex items-center gap-3 px-5 py-4 border-b border-[#c8c8ec]"
          style={{ background: `linear-gradient(135deg, ${selected.color}10 0%, transparent 70%)` }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${selected.color}18` }}
          >
            <img src={selected.icon} alt={selected.name} width={24} height={24} className="object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-mono text-sm font-bold text-[#4c4c4c]">{selected.name}</h2>
            <p className="text-[11px] text-[#5a5a7a] truncate">{selected.description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#7878a8] hover:bg-[#f0f0f8] hover:text-[#6070a0] transition shrink-0"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Dashboard preview — what you'll see after connecting */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#7878a8]">
              What you&apos;ll see after connecting
            </p>
            <span className="rounded-full border border-[#c8c8ec] bg-[#f4f4fc] px-2 py-0.5 font-mono text-[8px] text-[#7878a8]">
              sample data
            </span>
          </div>
          <div className="rounded-xl border border-[#ccccec] bg-[#f4f4fc] p-3">
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {(PREVIEW_METRICS[selected.id] ?? DEFAULT_PREVIEW_METRICS).map(({ label, value, trend }) => (
                <div key={label} className="rounded-lg border border-[#c8c8ec] bg-[#f0f0fc] px-2.5 py-2">
                  <p className="font-mono text-[9px] text-[#7878a8] truncate">{label}</p>
                  <p className="font-mono text-sm font-bold text-[#595959] mt-0.5">{value}</p>
                  {trend && (
                    <p className="font-mono text-[9px] mt-0.5" style={{ color: trend.startsWith("↓") ? "#f87171" : "#00d4aa" }}>
                      {trend}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {/* Mini sparkline placeholder */}
            <div className="rounded-lg border border-[#ccccec] bg-[#f3f3fc] px-3 py-2">
              <div className="flex items-end gap-1 h-8">
                {[30, 45, 35, 60, 52, 70, 65, 80, 72, 90, 84, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm opacity-60 transition-all"
                    style={{
                      height: `${h}%`,
                      backgroundColor: selected.color,
                    }}
                  />
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[8px] text-[#6060a0]">30-day revenue trend</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <a
              href={`/learn/${selected.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-[#7878a8] underline-offset-2 hover:text-[#5a5a8a] hover:underline transition"
            >
              What data do we read? →
            </a>
            {privacy?.docsUrl && (
              <a
                href={privacy.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-[#6060a0] underline-offset-2 hover:text-[#7878a8] hover:underline transition"
              >
                Privacy policy →
              </a>
            )}
          </div>
        </div>

        <div className="border-t border-[#ccccec]" />

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
      <p className="text-[11px] text-[#5a5a7a] leading-relaxed">
        You&apos;ll be redirected to <strong className="text-[#6a6a90]">{integration.name}</strong> to
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
      <p className="text-center font-mono text-[10px] text-[#6868a0]">~30 seconds · read-only · add more integrations later</p>
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
      <p className="text-[11px] text-[#5a5a7a] leading-relaxed">
        Enter your <strong className="text-[#6a6a90]">{integration.name + " "}</strong> credentials below.
        They&apos;re stored encrypted and never logged or shared.
      </p>
      {fields.map((field) => (
        <div key={field.name}>
          <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6070a0]">
            {field.label}
            {field.optional && (
              <span className="normal-case tracking-normal font-normal text-[#6868a0]">(optional)</span>
            )}
          </label>
          <input
            type={field.type ?? "text"}
            value={values[field.name] ?? ""}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            autoComplete="off"
            className="w-full rounded-lg border border-[#d4d4e8] bg-[#f4f4fc] px-3 py-2.5 font-mono text-[12px] text-[#3e3e3e] placeholder-[#636363] outline-none transition focus:border-[#00d4aa]/35 focus:ring-1 focus:ring-[#00d4aa]/15"
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
      <p className="text-[11px] text-[#5a5a7a] leading-relaxed">
        Enter your Shopify store domain to start the connection. You&apos;ll be redirected to
        Shopify to authorize read-only access.
      </p>
      <div>
        <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6070a0]">
          Store domain
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="yourstore.myshopify.com"
          className="w-full rounded-lg border border-[#d4d4e8] bg-[#f4f4fc] px-3 py-2.5 font-mono text-[12px] text-[#515151] placeholder-[#636363] outline-none transition focus:border-[#96bf48]/35 focus:ring-1 focus:ring-[#96bf48]/15"
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
