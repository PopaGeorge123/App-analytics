"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import { DateRangeButton, PRESETS, today, daysAgo } from "./DateRangePicker";
import type { DateRange } from "./DateRangePicker";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ChartType = "area" | "bar" | "line";
type FieldType = "currency" | "number" | "percent";

interface Widget {
  id: string;
  title: string;
  chartType: ChartType;
  platform: string;
  field: string;
  color: string;
  width: 1 | 2;
}

const PLATFORM_LABELS: Record<string, string> = {
  shopify: "Shopify", woocommerce: "WooCommerce", bigcommerce: "BigCommerce",
  "amazon-seller": "Amazon", etsy: "Etsy",
  stripe: "Stripe", paypal: "PayPal", paddle: "Paddle",
  "lemon-squeezy": "LemonSqueezy", gumroad: "Gumroad",
  ga4: "GA4", plausible: "Plausible", mixpanel: "Mixpanel",
  amplitude: "Amplitude", posthog: "PostHog", fathom: "Fathom",
  meta: "Meta Ads", "google-ads": "Google Ads", "tiktok-ads": "TikTok Ads",
  "twitter-ads": "X Ads", "linkedin-ads": "LinkedIn Ads",
  "snapchat-ads": "Snapchat Ads", "pinterest-ads": "Pinterest Ads",
  mailchimp: "Mailchimp", klaviyo: "Klaviyo", convertkit: "ConvertKit",
  activecampaign: "ActiveCampaign", brevo: "Brevo", beehiiv: "Beehiiv",
  hubspot: "HubSpot", salesforce: "Salesforce", pipedrive: "Pipedrive",
  intercom: "Intercom", zendesk: "Zendesk", freshdesk: "Freshdesk",
  segment: "Segment", heap: "Heap", fullstory: "FullStory", hotjar: "Hotjar",
  instagram: "Instagram", youtube: "YouTube", "twitter-organic": "X (Organic)",
};

interface FieldDef { key: string; label: string; type: FieldType }
const PLATFORM_FIELDS: Record<string, FieldDef[]> = {
  shopify:         [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "orders",             label: "Orders",             type: "number"   }, { key: "aov",                label: "AOV",                type: "currency" }, { key: "newCustomers",       label: "New Customers",      type: "number"   }, { key: "refunds",            label: "Refunds (amt)",      type: "currency" }, { key: "cartAbandonmentRate",label: "Cart Abandonment %", type: "percent"  }, { key: "refundRate",         label: "Refund Rate %",      type: "percent"  }],
  woocommerce:     [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "orders",             label: "Orders",             type: "number"   }, { key: "aov",                label: "AOV",                type: "currency" }, { key: "newCustomers",       label: "New Customers",      type: "number"   }, { key: "refunds",            label: "Refunds",            type: "currency" }],
  bigcommerce:     [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "orders",             label: "Orders",             type: "number"   }, { key: "aov",                label: "AOV",                type: "currency" }, { key: "newCustomers",       label: "New Customers",      type: "number"   }],
  "amazon-seller": [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "orders",             label: "Orders",             type: "number"   }, { key: "units",              label: "Units Sold",         type: "number"   }, { key: "refunds",            label: "Refunds",            type: "currency" }],
  etsy:            [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "orders",             label: "Orders",             type: "number"   }, { key: "newCustomers",       label: "New Customers",      type: "number"   }],
  stripe:          [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "mrr",                label: "MRR",                type: "currency" }, { key: "newCustomers",       label: "New Customers",      type: "number"   }, { key: "churnRate",          label: "Churn Rate %",       type: "percent"  }, { key: "arpu",               label: "ARPU",               type: "currency" }, { key: "refunds",            label: "Refunds",            type: "currency" }],
  paypal:          [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "transactions",       label: "Transactions",       type: "number"   }, { key: "refunds",            label: "Refunds",            type: "currency" }],
  paddle:          [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "mrr",                label: "MRR",                type: "currency" }, { key: "newCustomers",       label: "New Customers",      type: "number"   }],
  "lemon-squeezy": [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "orders",             label: "Orders",             type: "number"   }, { key: "newCustomers",       label: "New Customers",      type: "number"   }],
  gumroad:         [{ key: "revenue",            label: "Revenue",            type: "currency" }, { key: "sales",              label: "Sales",              type: "number"   }],
  ga4:             [{ key: "sessions",           label: "Sessions",           type: "number"   }, { key: "pageviews",          label: "Pageviews",          type: "number"   }, { key: "newUsers",           label: "New Users",          type: "number"   }, { key: "bounceRate",         label: "Bounce Rate %",      type: "percent"  }, { key: "conversions",        label: "Conversions",        type: "number"   }],
  plausible:       [{ key: "visitors",           label: "Visitors",           type: "number"   }, { key: "pageviews",          label: "Pageviews",          type: "number"   }, { key: "bounceRate",         label: "Bounce Rate %",      type: "percent"  }],
  mixpanel:        [{ key: "activeUsers",        label: "Active Users",       type: "number"   }, { key: "events",             label: "Events",             type: "number"   }, { key: "sessions",           label: "Sessions",           type: "number"   }],
  amplitude:       [{ key: "activeUsers",        label: "Active Users",       type: "number"   }, { key: "events",             label: "Events",             type: "number"   }],
  posthog:         [{ key: "activeUsers",        label: "Active Users",       type: "number"   }, { key: "events",             label: "Events",             type: "number"   }, { key: "sessions",           label: "Sessions",           type: "number"   }],
  fathom:          [{ key: "visitors",           label: "Visitors",           type: "number"   }, { key: "pageviews",          label: "Pageviews",          type: "number"   }, { key: "bounceRate",         label: "Bounce Rate %",      type: "percent"  }],
  meta:            [{ key: "spend",              label: "Ad Spend",           type: "currency" }, { key: "impressions",        label: "Impressions",        type: "number"   }, { key: "clicks",             label: "Clicks",             type: "number"   }, { key: "roas",               label: "ROAS",               type: "number"   }, { key: "cpm",                label: "CPM",                type: "currency" }, { key: "cpc",                label: "CPC",                type: "currency" }],
  "google-ads":    [{ key: "spend",              label: "Ad Spend",           type: "currency" }, { key: "impressions",        label: "Impressions",        type: "number"   }, { key: "clicks",             label: "Clicks",             type: "number"   }, { key: "roas",               label: "ROAS",               type: "number"   }, { key: "conversions",        label: "Conversions",        type: "number"   }],
  "tiktok-ads":    [{ key: "spend",              label: "Ad Spend",           type: "currency" }, { key: "impressions",        label: "Impressions",        type: "number"   }, { key: "clicks",             label: "Clicks",             type: "number"   }],
  "twitter-ads":   [{ key: "spend",              label: "Ad Spend",           type: "currency" }, { key: "impressions",        label: "Impressions",        type: "number"   }, { key: "clicks",             label: "Clicks",             type: "number"   }],
  "linkedin-ads":  [{ key: "spend",              label: "Ad Spend",           type: "currency" }, { key: "impressions",        label: "Impressions",        type: "number"   }, { key: "clicks",             label: "Clicks",             type: "number"   }],
  mailchimp:       [{ key: "sends",              label: "Sends",              type: "number"   }, { key: "opens",              label: "Opens",              type: "number"   }, { key: "clicks",             label: "Clicks",             type: "number"   }, { key: "unsubscribes",       label: "Unsubscribes",       type: "number"   }],
  klaviyo:         [{ key: "sends",              label: "Sends",              type: "number"   }, { key: "opens",              label: "Opens",              type: "number"   }, { key: "clicks",             label: "Clicks",             type: "number"   }, { key: "revenue",            label: "Revenue",            type: "currency" }],
  convertkit:      [{ key: "subscribers",        label: "Subscribers",        type: "number"   }, { key: "sends",              label: "Sends",              type: "number"   }, { key: "opens",              label: "Opens",              type: "number"   }],
  activecampaign:  [{ key: "contacts",           label: "Contacts",           type: "number"   }, { key: "sends",              label: "Sends",              type: "number"   }, { key: "opens",              label: "Opens",              type: "number"   }],
  brevo:           [{ key: "sends",              label: "Sends",              type: "number"   }, { key: "opens",              label: "Opens",              type: "number"   }, { key: "clicks",             label: "Clicks",             type: "number"   }],
  beehiiv:         [{ key: "subscribers",        label: "Subscribers",        type: "number"   }, { key: "opens",              label: "Opens",              type: "number"   }, { key: "clicks",             label: "Clicks",             type: "number"   }],
  hubspot:         [{ key: "contacts",           label: "Contacts",           type: "number"   }, { key: "deals",              label: "Deals",              type: "number"   }, { key: "revenue",            label: "Revenue",            type: "currency" }],
  salesforce:      [{ key: "leads",              label: "Leads",              type: "number"   }, { key: "opportunities",      label: "Opportunities",      type: "number"   }, { key: "revenue",            label: "Revenue",            type: "currency" }],
  pipedrive:       [{ key: "deals",              label: "Deals",              type: "number"   }, { key: "revenue",            label: "Revenue",            type: "currency" }],
  intercom:        [{ key: "conversations",      label: "Conversations",      type: "number"   }, { key: "activeUsers",        label: "Active Users",       type: "number"   }],
  zendesk:         [{ key: "tickets",            label: "Tickets",            type: "number"   }, { key: "resolvedTickets",    label: "Resolved",           type: "number"   }],
  freshdesk:       [{ key: "tickets",            label: "Tickets",            type: "number"   }, { key: "resolvedTickets",    label: "Resolved",           type: "number"   }],
  segment:         [{ key: "events",             label: "Events",             type: "number"   }, { key: "activeUsers",        label: "Active Users",       type: "number"   }],
  heap:            [{ key: "events",             label: "Events",             type: "number"   }, { key: "sessions",           label: "Sessions",           type: "number"   }],
  fullstory:       [{ key: "sessions",           label: "Sessions",           type: "number"   }, { key: "pageviews",          label: "Pageviews",          type: "number"   }],
  hotjar:          [{ key: "pageviews",          label: "Pageviews",          type: "number"   }, { key: "sessions",           label: "Sessions",           type: "number"   }],
  instagram:       [{ key: "followers",          label: "Followers",          type: "number"   }, { key: "impressions",        label: "Impressions",        type: "number"   }, { key: "reach",              label: "Reach",              type: "number"   }, { key: "engagement",         label: "Engagements",        type: "number"   }],
  youtube:         [{ key: "views",              label: "Views",              type: "number"   }, { key: "subscribers",        label: "Subscribers",        type: "number"   }, { key: "watchTimeHours",     label: "Watch Hours",        type: "number"   }],
  "twitter-organic":[{ key: "impressions",       label: "Impressions",        type: "number"   }, { key: "engagements",        label: "Engagements",        type: "number"   }, { key: "followers",          label: "Followers",          type: "number"   }],
};

const COLOR_PALETTE = [
  "#00d4aa", "#635bff", "#f59e0b", "#f87171", "#a78bfa",
  "#34d399", "#60a5fa", "#fb7185", "#fbbf24", "#818cf8",
  "#96bf48", "#FF9900", "#7f54b3", "#06b6d4", "#ec4899",
  "#84cc16", "#f97316", "#14b8a6",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtShortDate(d: string): string {
  const [, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${parseInt(day)}`;
}

function fmtValue(v: number, type: FieldType, currency = "USD"): string {
  if (type === "currency") {
    // Values are stored in cents — divide by 100
    const dollars = v / 100;
    if (dollars >= 1_000_000) return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(dollars);
    if (dollars >= 1_000)     return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(dollars);
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(dollars);
  }
  if (type === "percent") return `${v.toFixed(1)}%`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function getFieldDef(platform: string, field: string): FieldDef | undefined {
  return PLATFORM_FIELDS[platform]?.find(f => f.key === field);
}

function extractSeries(
  snapshots: Snapshot[],
  platform: string,
  field: string,
  dateRange: DateRange,
): { date: string; value: number }[] {
  const filtered = snapshots.filter(
    s => s.provider === platform && s.date >= dateRange.from && s.date <= dateRange.to,
  );
  const byDate: Record<string, number[]> = {};
  for (const s of filtered) {
    const v = ((s.data as Record<string, number>)[field]) ?? 0;
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(v);
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, value: vals.reduce((a, b) => a + b, 0) }));
}



// ─── Widget Config Panel ────────────────────────────────────────────────────────
function ConfigPanel({ widget, connectedPlatforms, onUpdate, onClose }: {
  widget: Widget;
  connectedPlatforms: string[];
  onUpdate: (w: Widget) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Widget>({ ...widget });
  const supportedPlatforms = connectedPlatforms.filter(p => PLATFORM_FIELDS[p]?.length);
  const fields = PLATFORM_FIELDS[draft.platform] ?? [];

  // Reset field when platform changes
  useEffect(() => {
    if (!fields.find(f => f.key === draft.field)) {
      setDraft(d => ({ ...d, field: fields[0]?.key ?? "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.platform]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl border border-[#d4d4e8] bg-white p-6 shadow-2xl shadow-black/20 mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-mono text-sm font-bold text-[#1a1a2e]">Configure chart</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9a9ab8] hover:bg-[#f2f2f8] hover:text-[#1a1a2e] transition-colors"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-widest text-[#6a6a90]">Chart title</label>
            <input
              type="text"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              className="w-full rounded-xl border border-[#d4d4e8] bg-[#fafafa] px-3 py-2.5 font-mono text-xs text-[#1a1a2e] outline-none focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/10 transition-all"
            />
          </div>

          {/* Data source */}
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-widest text-[#6a6a90]">Data source</label>
            <select
              value={draft.platform}
              onChange={e => setDraft(d => ({ ...d, platform: e.target.value, field: PLATFORM_FIELDS[e.target.value]?.[0]?.key ?? "" }))}
              className="w-full rounded-xl border border-[#d4d4e8] bg-[#fafafa] px-3 py-2.5 font-mono text-xs text-[#1a1a2e] outline-none focus:border-[#00d4aa]/60 transition-all"
            >
              {supportedPlatforms.map(p => (
                <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>
              ))}
            </select>
          </div>

          {/* Metric */}
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-widest text-[#6a6a90]">Metric</label>
            <select
              value={draft.field}
              onChange={e => setDraft(d => ({ ...d, field: e.target.value }))}
              className="w-full rounded-xl border border-[#d4d4e8] bg-[#fafafa] px-3 py-2.5 font-mono text-xs text-[#1a1a2e] outline-none focus:border-[#00d4aa]/60 transition-all"
            >
              {fields.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Chart type */}
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-widest text-[#6a6a90]">Chart type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["area", "bar", "line"] as ChartType[]).map(t => {
                const icon = t === "area" ? 
                  (<svg className="w-5" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M0.5 14.5H0V15H0.5V14.5ZM2 11.5V12H3V11.5H2ZM15 2.5V2H14V2.5H15ZM0 0V14.5H1V0H0ZM0.5 15H15V14H0.5V15ZM3 11.5C3 10.0456 3.24378 8.6201 3.70691 7.57807C4.17757 6.51908 4.79814 6 5.5 6V5C4.20186 5 3.32243 5.98092 2.79309 7.17193C2.25622 8.3799 2 9.95441 2 11.5H3ZM5.5 6C5.82076 6 6.14191 6.15761 6.50461 6.4924C6.87081 6.83043 7.21786 7.29048 7.6 7.8C7.96786 8.29048 8.37081 8.83043 8.81711 9.2424C9.26691 9.65761 9.82076 10 10.5 10V9C10.1792 9 9.85809 8.84239 9.49539 8.5076C9.12919 8.16957 8.78214 7.70952 8.4 7.2C8.03214 6.70952 7.62919 6.16957 7.18289 5.7576C6.73309 5.34239 6.17924 5 5.5 5V6ZM10.5 10C11.7232 10 12.8626 9.23726 13.6727 7.9545C14.4853 6.66802 15 4.8191 15 2.5H14C14 4.6809 13.5147 6.33198 12.8273 7.4205C12.1374 8.51274 11.2768 9 10.5 9V10Z" fill="#000000"></path> </g></svg>) : t === "bar" ? 
                  (<svg className="w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M8 13V17M16 11V17M12 7V17M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>) 
                  : t === "line" ? (<svg className="w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M3 16.5L9 10L13 16L21 6.5" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>) : "◍";
                return (
                  <button
                    key={t}
                    onClick={() => setDraft(d => ({ ...d, chartType: t }))}
                    className={[
                      "flex flex-col items-center gap-1 rounded-xl border py-2.5 font-mono text-[9px] font-semibold transition-all",
                      draft.chartType === t
                        ? "border-[#00d4aa]/60 bg-[#00d4aa]/8 text-[#00d4aa]"
                        : "border-[#d4d4e8] text-[#6a6a90] hover:border-[#c4c4d8] hover:text-[#1a1a2e]",
                    ].join(" ")}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    <span className="capitalize">{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Width */}
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-widest text-[#6a6a90]">Width</label>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as const).map(w => (
                <button
                  key={w}
                  onClick={() => setDraft(d => ({ ...d, width: w }))}
                  className={[
                    "rounded-xl border py-2.5 font-mono text-[9px] font-semibold transition-all",
                    draft.width === w
                      ? "border-[#635bff]/60 bg-[#635bff]/8 text-[#635bff]"
                      : "border-[#d4d4e8] text-[#6a6a90] hover:border-[#c4c4d8]",
                  ].join(" ")}
                >
                  {w === 1 ? "Half width" : "Full width"}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-widest text-[#6a6a90]">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setDraft(d => ({ ...d, color: c }))}
                  style={{ backgroundColor: c }}
                  title={c}
                  className={[
                    "h-7 w-7 rounded-lg transition-all",
                    draft.color === c ? "ring-2 ring-offset-2 ring-[#1a1a2e] scale-110" : "hover:scale-105 opacity-80 hover:opacity-100",
                  ].join(" ")}
                />
              ))}
              {/* Custom color picker */}
              <label
                className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#d4d4e8] transition-colors hover:border-[#00d4aa]/60"
                title="Custom color"
              >
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-[#9a9ab8]"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <input
                  type="color"
                  value={draft.color}
                  onChange={e => setDraft(d => ({ ...d, color: e.target.value }))}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              {/* Current custom color preview (if not in palette) */}
              {!COLOR_PALETTE.includes(draft.color) && (
                <div
                  style={{ backgroundColor: draft.color }}
                  className="h-7 w-7 rounded-lg ring-2 ring-offset-2 ring-[#1a1a2e] scale-110"
                />
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#d4d4e8] py-2.5 font-mono text-xs font-semibold text-[#6a6a90] hover:text-[#1a1a2e] hover:border-[#c4c4d8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onUpdate(draft); onClose(); }}
            className="flex-1 rounded-xl bg-[#1a1a2e] py-2.5 font-mono text-xs font-semibold text-white hover:bg-[#2e2e5e] transition-colors"
          >
            Apply changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Widget Chart ──────────────────────────────────────────────────────────────
function WidgetChart({ data, chartType, color, fieldDef }: {
  data: { date: string; value: number }[];
  chartType: ChartType;
  color: string;
  fieldDef: FieldDef | undefined;
}) {
  const type = fieldDef?.type ?? "number";
  const fmt  = (v: number) => fmtValue(v, type);
  const gradId = `wg-${color.replace("#", "")}`;

  const chartData = data.map(d => ({ name: fmtShortDate(d.date), value: d.value }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-black/12 bg-[#f4f4f8] px-3 py-2 shadow-2xl">
        <p className="font-mono text-[9px] text-[#4a4a6a] mb-1">{label}</p>
        <p className="font-mono text-sm font-bold text-[#1a1a2e]">{fmt(payload[0].value)}</p>
      </div>
    );
  };

  const axisStyle = {
    tick: { fontFamily: "monospace", fontSize: 9, fill: "#3a3a5a" },
    tickLine: false as const, axisLine: false as const,
  };
  const margin = { top: 4, right: 0, left: 0, bottom: 0 };

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-mono text-[9px] text-[#b0b0c8]">No data in selected range</p>
      </div>
    );
  }

  

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={220} style={{ outline: "none" }}>
        <BarChart data={chartData} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
          <XAxis dataKey="name" {...axisStyle} interval="preserveStartEnd" tickMargin={8} />
          <YAxis {...axisStyle} tickFormatter={fmt} width={48} />
          <Tooltip content={CustomTooltip} />
          <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={220} style={{ outline: "none" }}>
        <LineChart data={chartData} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
          <XAxis dataKey="name" {...axisStyle} interval="preserveStartEnd" tickMargin={8} />
          <YAxis {...axisStyle} tickFormatter={fmt} width={48} />
          <Tooltip content={CustomTooltip} />
          <Line
            dataKey="value" stroke={color} strokeWidth={2}
            dot={false} activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // area (default)
  return (
    <ResponsiveContainer width="100%" height={220} style={{ outline: "none" }}>
      <AreaChart data={chartData} margin={margin}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
        <XAxis dataKey="name" {...axisStyle} interval="preserveStartEnd" tickMargin={8} />
        <YAxis {...axisStyle} tickFormatter={fmt} width={48} />
        <Tooltip content={CustomTooltip} />
        <Area
          type="monotone" dataKey="value" stroke={color} strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false} activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Draggable Widget Card ─────────────────────────────────────────────────────
function WidgetCard({ widget, snapshots, dateRange, onEdit, onRemove, onDragStart, onDragOver, onDrop, isDragOver }: {
  widget: Widget;
  snapshots: Snapshot[];
  dateRange: DateRange;
  onEdit: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const data     = useMemo(() => extractSeries(snapshots, widget.platform, widget.field, dateRange), [snapshots, widget.platform, widget.field, dateRange]);
  const fieldDef = getFieldDef(widget.platform, widget.field);
  const total    = data.reduce((a, b) => a + b.value, 0);
  const len      = data.length;
  const latest   = data[len - 1]?.value ?? 0;
  const prev     = data[len - 2]?.value ?? 0;
  const changePct = prev > 0 ? ((latest - prev) / prev) * 100 : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={[
        "group relative flex flex-col rounded-2xl border bg-white transition-all duration-150",
        isDragOver
          ? "border-[#00d4aa] shadow-lg shadow-[#00d4aa]/10 scale-[1.01]"
          : "border-[#ebebf5] shadow-sm hover:shadow-md hover:border-[#d8d8ee]",
      ].join(" ")}
      style={{ minHeight: 280 }}
    >
      {/* Drop indicator */}
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#00d4aa]/60 bg-[#00d4aa]/4 z-10" />
      )}

      {/* Header */}
      <div className="flex items-start gap-2.5 px-4 pt-4 pb-2">
        {/* Drag handle */}
        <div className="mt-0.5 cursor-grab active:cursor-grabbing text-[#c8c8de] transition-colors group-hover:text-[#9a9ab8]">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2.5" cy="2" r="1.5"/><circle cx="7.5" cy="2" r="1.5"/>
            <circle cx="2.5" cy="7" r="1.5"/><circle cx="7.5" cy="7" r="1.5"/>
            <circle cx="2.5" cy="12" r="1.5"/><circle cx="7.5" cy="12" r="1.5"/>
          </svg>
        </div>

        {/* Title + source */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] font-bold text-[#1a1a2e] truncate leading-tight">{widget.title}</p>
          <p className="font-mono text-[8px] text-[#b0b0c8] mt-0.5 truncate">
            {PLATFORM_LABELS[widget.platform] ?? widget.platform}
            <span className="mx-1 text-[#d4d4e8]">·</span>
            {fieldDef?.label ?? widget.field}
          </p>
        </div>

        {/* Total value */}
        <div className="text-right shrink-0">
          <p className="font-mono text-[13px] font-bold text-[#1a1a2e] leading-tight">
            {fmtValue(total, fieldDef?.type ?? "number")}
          </p>
          {changePct !== null && (
            <p className={`font-mono text-[9px] font-semibold mt-0.5 ${changePct >= 0 ? "text-[#00d4aa]" : "text-[#f87171]"}`}>
              {changePct >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(1)}%
            </p>
          )}
        </div>

        {/* Color dot */}
        <div className="mt-1 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white" style={{ backgroundColor: widget.color }} />

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {confirmDelete ? (
            <>
              <span className="text-[10px] font-medium text-[#f87171] mr-0.5 whitespace-nowrap">Delete?</span>
              <button
                onClick={() => { onRemove(); setConfirmDelete(false); }}
                title="Confirm delete"
                className="flex h-6 items-center px-1.5 rounded-lg text-[10px] font-semibold bg-[#fff4f4] text-[#f87171] hover:bg-[#f87171] hover:text-white transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                title="Cancel"
                className="flex h-6 items-center px-1.5 rounded-lg text-[10px] font-semibold bg-[#f2f2f8] text-[#8888aa] hover:bg-[#e8e8f0] transition-colors"
              >
                No
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                title="Edit"
                className="flex h-6 w-6 items-center justify-center rounded-lg text-[#b0b0c8] hover:bg-[#f2f2f8] hover:text-[#635bff] transition-colors"
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                title="Remove"
                className="flex h-6 w-6 items-center justify-center rounded-lg text-[#b0b0c8] hover:bg-[#fff4f4] hover:text-[#f87171] transition-colors"
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className="px-2 pb-4" style={{ height: 220 }}>
        <WidgetChart
          data={data}
          chartType={widget.chartType}
          color={widget.color}
          fieldDef={fieldDef}
        />
      </div>
    </div>
  );
}

// ─── Default widgets helper ────────────────────────────────────────────────────
function buildDefaultWidgets(connectedPlatforms: string[]): Widget[] {
  const widgets: Widget[] = [];
  let ci = 0;
  for (const platform of connectedPlatforms.slice(0, 6)) {
    const fields = PLATFORM_FIELDS[platform];
    if (!fields?.length) continue;
    widgets.push({
      id: `default-${platform}-${ci}`,
      title: `${PLATFORM_LABELS[platform] ?? platform} — ${fields[0].label}`,
      chartType: ci % 3 === 0 ? "area" : ci % 3 === 1 ? "bar" : "line",
      platform,
      field: fields[0].key,
      color: COLOR_PALETTE[ci % COLOR_PALETTE.length],
      width: 1,
    });
    ci++;
  }
  return widgets;
}

// ─── Custom Dashboard (default export) ────────────────────────────────────────
const WIDGETS_KEY   = "cd_widgets_v1";
const DATE_RANGE_KEY = "cd_date_range_v1";

export default function CustomDashboard({ snapshots, connectedPlatforms }: {
  snapshots: Snapshot[];
  connectedPlatforms: string[];
}) {
  // ── Date range ──
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    if (typeof window !== "undefined") {
      try {
        const s = localStorage.getItem(DATE_RANGE_KEY);
        if (s) return JSON.parse(s) as DateRange;
      } catch { /* ignore */ }
    }
    return { from: daysAgo(30), to: today() };
  });

  useEffect(() => {
    localStorage.setItem(DATE_RANGE_KEY, JSON.stringify(dateRange));
  }, [dateRange]);

  // ── Widgets ──
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const s = localStorage.getItem(WIDGETS_KEY);
        if (s) return JSON.parse(s) as Widget[];
      } catch { /* ignore */ }
    }
    return buildDefaultWidgets(connectedPlatforms);
  });

  useEffect(() => {
    localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets));
  }, [widgets]);

  // ── Edit state ──
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Drag state ──
  const dragFromRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, idx: number) {
    dragFromRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  }
  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragFromRef.current;
    if (from === null || from === idx) { setDragOverIdx(null); return; }
    setWidgets(ws => {
      const next = [...ws];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragFromRef.current = null;
    setDragOverIdx(null);
  }
  function handleDragEnd() {
    dragFromRef.current = null;
    setDragOverIdx(null);
  }

  function addWidget() {
    const platform = connectedPlatforms.find(p => PLATFORM_FIELDS[p]?.length) ?? connectedPlatforms[0] ?? "";
    const fields   = PLATFORM_FIELDS[platform] ?? [];
    const newW: Widget = {
      id: `w-${Date.now()}`,
      title: `${PLATFORM_LABELS[platform] ?? platform} — ${fields[0]?.label ?? "Metric"}`,
      chartType: "area",
      platform,
      field: fields[0]?.key ?? "revenue",
      color: COLOR_PALETTE[widgets.length % COLOR_PALETTE.length],
      width: 1,
    };
    setWidgets(ws => [...ws, newW]);
    setEditingId(newW.id);
  }

  function updateWidget(updated: Widget) {
    setWidgets(ws => ws.map(w => w.id === updated.id ? updated : w));
  }

  function removeWidget(id: string) {
    setWidgets(ws => ws.filter(w => w.id !== id));
  }

  const editingWidget = editingId ? widgets.find(w => w.id === editingId) ?? null : null;
  const supportedPlatforms = connectedPlatforms.filter(p => PLATFORM_FIELDS[p]?.length);

  // Adaugă un ref care ține minte dacă widget-ul curent e "nou"
const isNewWidgetRef = useRef(false);

function addWidget() {
  const platform = connectedPlatforms.find(p => PLATFORM_FIELDS[p]?.length) ?? connectedPlatforms[0] ?? "";
  const fields   = PLATFORM_FIELDS[platform] ?? [];
  const newW: Widget = {
    id: `w-${Date.now()}`,
    title: `${PLATFORM_LABELS[platform] ?? platform} — ${fields[0]?.label ?? "Metric"}`,
    chartType: "area",
    platform,
    field: fields[0]?.key ?? "revenue",
    color: COLOR_PALETTE[widgets.length % COLOR_PALETTE.length],
    width: 1,
  };
  setWidgets(ws => [...ws, newW]);
  isNewWidgetRef.current = true; // <-- marchează ca nou
  setEditingId(newW.id);
}

function handleClosePanel() {
  // Dacă era widget nou și s-a dat cancel, șterge-l
  if (isNewWidgetRef.current && editingId) {
    removeWidget(editingId);
  }
  isNewWidgetRef.current = false;
  setEditingId(null);
}

function handleUpdateWidget(updated: Widget) {
  updateWidget(updated);
  isNewWidgetRef.current = false; // s-a salvat, nu mai e "nou"
}

  if (supportedPlatforms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d4d4e8] py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2f2f8] text-3xl">📊</div>
        <p className="font-mono text-xs font-bold text-[#1a1a2e]">No integrations connected yet</p>
        <p className="mt-1 font-mono text-[10px] text-[#6a6a90]">Connect an integration from the Overview tab to start building your custom dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range picker — top left */}
        <DateRangeButton range={dateRange} onChange={setDateRange} />

        <div className="flex-1" />

        {/* Drag hint */}
        {widgets.length > 1 && (
          <p className="hidden font-mono text-[9px] text-[#b0b0c8] sm:block">
            ⠿ drag to reorder
          </p>
        )}

        {/* Add chart */}
        <button
          onClick={addWidget}
          className="flex items-center gap-2 rounded-xl bg-[#1a1a2e] px-4 py-2.5 font-mono text-xs font-semibold text-white transition-all hover:bg-[#2e2e52] active:scale-95"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add chart
        </button>
      </div>

      {/* ── Empty canvas ── */}
      {widgets.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d4d4e8] py-20 text-center transition-colors hover:border-[#00d4aa]/30"
          onClick={addWidget}
          role="button"
          tabIndex={0}
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f2f2f8]">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Grid lines */}
              <rect x="4" y="4" width="40" height="40" rx="5" fill="#eeeef8" />
              <line x1="4" y1="34" x2="44" y2="34" stroke="#d4d4e8" strokeWidth="1.2" />
              <line x1="4" y1="24" x2="44" y2="24" stroke="#d4d4e8" strokeWidth="1.2" />
              <line x1="4" y1="14" x2="44" y2="14" stroke="#d4d4e8" strokeWidth="1.2" />
              {/* Area fill */}
              <path d="M8 32 L16 22 L24 26 L33 13 L40 18 L40 34 L8 34 Z" fill="#635bff" fillOpacity="0.12" />
              {/* Line */}
              <polyline points="8,32 16,22 24,26 33,13 40,18" fill="none" stroke="#635bff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              {/* Dots */}
              <circle cx="8"  cy="32" r="2.2" fill="#635bff" />
              <circle cx="16" cy="22" r="2.2" fill="#635bff" />
              <circle cx="24" cy="26" r="2.2" fill="#635bff" />
              <circle cx="33" cy="13" r="2.2" fill="#635bff" />
              <circle cx="40" cy="18" r="2.2" fill="#635bff" />
              {/* X axis */}
              <line x1="8" y1="38" x2="40" y2="38" stroke="#b0b0c8" strokeWidth="1.4" strokeLinecap="round" />
              {/* Y axis */}
              <line x1="8" y1="10" x2="8" y2="38" stroke="#b0b0c8" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <p className="font-mono text-xs font-bold text-[#1a1a2e]">Your dashboard is empty</p>
          <p className="mt-1 font-mono text-[10px] text-[#6a6a90]">Click <strong className="text-[#1a1a2e]">Add chart</strong> to create your first visualisation</p>
        </div>
      )}

      {/* ── Grid ── */}
      {widgets.length > 0 && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onDragEnd={handleDragEnd}
        >
          {widgets.map((w, i) => (
            <div key={w.id} className={w.width === 2 ? "sm:col-span-2" : ""}>
              <WidgetCard
                widget={w}
                snapshots={snapshots}
                dateRange={dateRange}
                onEdit={() => { isNewWidgetRef.current = false; setEditingId(w.id); }}
                onRemove={() => removeWidget(w.id)}
                onDragStart={e => handleDragStart(e, i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={e => handleDrop(e, i)}
                isDragOver={dragOverIdx === i && dragFromRef.current !== i}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Config panel (modal) ── */}
      {editingWidget && (
        <ConfigPanel
          widget={editingWidget}
          connectedPlatforms={supportedPlatforms}
          onUpdate={handleUpdateWidget}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
