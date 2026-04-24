// ── Demo snapshot data for users with no connected platforms ──────────────
// Simulates a growing SaaS business over the past 14 days

import type { Snapshot } from "./DashboardShell";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Realistic daily data for a ~$3K MRR SaaS growing at ~12% MoM
const DEMO_DAYS: Array<{
  offset: number;
  revenue: number; // cents
  transactions: number;
  newCustomers: number;
  sessions: number;
  conversions: number;
  bounceRate: number;
  spend: number; // cents
  clicks: number;
  impressions: number;
}> = [
  { offset: 13, revenue: 29400, transactions: 3, newCustomers: 2, sessions: 310, conversions: 4, bounceRate: 61, spend: 5200, clicks: 142, impressions: 4800 },
  { offset: 12, revenue: 31800, transactions: 4, newCustomers: 3, sessions: 345, conversions: 5, bounceRate: 58, spend: 5400, clicks: 158, impressions: 5100 },
  { offset: 11, revenue: 28700, transactions: 3, newCustomers: 1, sessions: 298, conversions: 3, bounceRate: 64, spend: 4900, clicks: 131, impressions: 4500 },
  { offset: 10, revenue: 45200, transactions: 5, newCustomers: 4, sessions: 412, conversions: 7, bounceRate: 54, spend: 6800, clicks: 201, impressions: 6200 },
  { offset: 9,  revenue: 38600, transactions: 4, newCustomers: 3, sessions: 389, conversions: 6, bounceRate: 56, spend: 6100, clicks: 178, impressions: 5800 },
  { offset: 8,  revenue: 52100, transactions: 6, newCustomers: 5, sessions: 456, conversions: 8, bounceRate: 51, spend: 7200, clicks: 223, impressions: 6900 },
  { offset: 7,  revenue: 41300, transactions: 5, newCustomers: 3, sessions: 401, conversions: 6, bounceRate: 55, spend: 6500, clicks: 189, impressions: 6100 },
  { offset: 6,  revenue: 36900, transactions: 4, newCustomers: 2, sessions: 367, conversions: 5, bounceRate: 59, spend: 5800, clicks: 161, impressions: 5400 },
  { offset: 5,  revenue: 48700, transactions: 6, newCustomers: 4, sessions: 443, conversions: 7, bounceRate: 52, spend: 7100, clicks: 214, impressions: 6700 },
  { offset: 4,  revenue: 57300, transactions: 7, newCustomers: 6, sessions: 498, conversions: 9, bounceRate: 48, spend: 8200, clicks: 247, impressions: 7400 },
  { offset: 3,  revenue: 43800, transactions: 5, newCustomers: 4, sessions: 421, conversions: 7, bounceRate: 53, spend: 6900, clicks: 203, impressions: 6300 },
  { offset: 2,  revenue: 61500, transactions: 8, newCustomers: 6, sessions: 531, conversions: 10, bounceRate: 46, spend: 8900, clicks: 268, impressions: 7900 },
  { offset: 1,  revenue: 54200, transactions: 7, newCustomers: 5, sessions: 487, conversions: 9, bounceRate: 49, spend: 8100, clicks: 239, impressions: 7200 },
  { offset: 0,  revenue: 39100, transactions: 5, newCustomers: 3, sessions: 374, conversions: 6, bounceRate: 57, spend: 6300, clicks: 172, impressions: 5600 },
];

let _idCounter = 0;
function makeId() { return `demo-${++_idCounter}`; }

// Seeded pseudo-random to get stable but varied demo data
function v(base: number, pct = 0.25, offset = 0) {
  const seed = (base * 31 + offset * 17) % 100;
  return Math.round(base * (1 + ((seed / 100) - 0.5) * pct));
}

export const DEMO_SNAPSHOTS: Snapshot[] = DEMO_DAYS.flatMap((day) => [
  // ── Stripe ────────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "stripe", date: daysAgo(day.offset),
    data: { revenue: day.revenue, transactions: day.transactions, newCustomers: day.newCustomers, refunds: Math.round(day.revenue * 0.03) },
  },

  // ── GA4 ───────────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "ga4", date: daysAgo(day.offset),
    data: { sessions: day.sessions, users: Math.round(day.sessions * 0.78), conversions: day.conversions, bounceRate: day.bounceRate },
  },

  // ── Meta Ads ─────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "meta", date: daysAgo(day.offset),
    data: { spend: day.spend, clicks: day.clicks, impressions: day.impressions, conversions: Math.round(day.conversions * 0.6) },
  },

  // ── Paddle ────────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "paddle", date: daysAgo(day.offset),
    data: {
      revenue:    v(day.revenue * 0.4, 0.2, day.offset),
      fees:       v(day.revenue * 0.02, 0.1, day.offset),
      netRevenue: v(day.revenue * 0.38, 0.2, day.offset),
      txCount:    v(day.transactions, 0.3, day.offset),
    },
  },

  // ── Lemon Squeezy ─────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "lemon-squeezy", date: daysAgo(day.offset),
    data: {
      revenue:    v(day.revenue * 0.25, 0.25, day.offset + 1),
      fees:       v(day.revenue * 0.025, 0.1, day.offset + 1),
      netRevenue: v(day.revenue * 0.225, 0.25, day.offset + 1),
      txCount:    v(day.transactions - 1, 0.4, day.offset + 1),
    },
  },

  // ── Gumroad ───────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "gumroad", date: daysAgo(day.offset),
    data: {
      revenue:    v(day.revenue * 0.15, 0.3, day.offset + 2),
      fees:       v(day.revenue * 0.015, 0.1, day.offset + 2),
      netRevenue: v(day.revenue * 0.135, 0.3, day.offset + 2),
      txCount:    v(Math.max(1, day.transactions - 2), 0.4, day.offset + 2),
    },
  },

  // ── Plausible ─────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "plausible", date: daysAgo(day.offset),
    data: {
      visitors:      v(day.sessions * 0.72, 0.15, day.offset + 3),
      pageviews:     v(day.sessions * 1.9, 0.15, day.offset + 3),
      bounceRate:    v(day.bounceRate, 0.1, day.offset + 3),
      visitDuration: v(142, 0.3, day.offset + 3),
    },
  },

  // ── PostHog ───────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "posthog", date: daysAgo(day.offset),
    data: {
      pageviews:   v(day.sessions * 1.6, 0.2, day.offset + 4),
      uniqueUsers: v(day.sessions * 0.65, 0.2, day.offset + 4),
      sessions:    v(day.sessions * 0.9, 0.15, day.offset + 4),
    },
  },

  // ── Mailchimp ─────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "mailchimp", date: daysAgo(day.offset),
    data: {
      emailsSent:   day.offset % 3 === 0 ? v(2400, 0.2, day.offset + 5) : 0,
      opens:        day.offset % 3 === 0 ? v(680, 0.25, day.offset + 5) : 0,
      clicks:       day.offset % 3 === 0 ? v(92, 0.3, day.offset + 5) : 0,
      subscribers:  v(1840 + (13 - day.offset) * 12, 0.02, day.offset + 5),
      unsubscribes: v(3, 0.5, day.offset + 5),
    },
  },

  // ── Klaviyo ───────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "klaviyo", date: daysAgo(day.offset),
    data: {
      emailsSent: day.offset % 2 === 0 ? v(1800, 0.2, day.offset + 6) : 0,
      opens:      day.offset % 2 === 0 ? v(630, 0.25, day.offset + 6) : 0,
      clicks:     day.offset % 2 === 0 ? v(88, 0.3, day.offset + 6) : 0,
      revenue:    v(day.revenue * 0.12, 0.3, day.offset + 6),
    },
  },

  // ── Beehiiv ───────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "beehiiv", date: daysAgo(day.offset),
    data: {
      totalSubscribers:   v(3200 + (13 - day.offset) * 18, 0.01, day.offset + 7),
      newSubscribers:     v(18, 0.4, day.offset + 7),
      postsPublished:     day.offset % 7 === 0 ? 1 : 0,
      premiumSubscribers: v(210 + (13 - day.offset) * 2, 0.03, day.offset + 7),
    },
  },

  // ── Shopify ───────────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "shopify", date: daysAgo(day.offset),
    data: {
      revenue:      v(day.revenue * 0.55, 0.25, day.offset + 8),
      orders:       v(day.transactions + 2, 0.3, day.offset + 8),
      refunds:      v(1, 0.8, day.offset + 8),
      newCustomers: v(day.newCustomers, 0.4, day.offset + 8),
    },
  },

  // ── WooCommerce ───────────────────────────────────────────────────────────
  {
    id: makeId(), provider: "woocommerce", date: daysAgo(day.offset),
    data: {
      revenue:      v(day.revenue * 0.3, 0.25, day.offset + 9),
      orders:       v(day.transactions, 0.3, day.offset + 9),
      refunds:      v(1, 0.7, day.offset + 9),
      newCustomers: v(Math.max(1, day.newCustomers - 1), 0.5, day.offset + 9),
    },
  },
]);

export const DEMO_CONNECTED_PLATFORMS = [
  "stripe",
  "ga4",
  "meta",
  "paddle",
  "lemon-squeezy",
  "gumroad",
  "plausible",
  "posthog",
  "mailchimp",
  "klaviyo",
  "beehiiv",
  "shopify",
  "woocommerce",
];
