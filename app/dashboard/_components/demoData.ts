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
  offset: number; // days ago
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
function makeId() {
  return `demo-${++_idCounter}`;
}

export const DEMO_SNAPSHOTS: Snapshot[] = DEMO_DAYS.flatMap((day) => [
  {
    id: makeId(),
    provider: "stripe",
    date: daysAgo(day.offset),
    data: {
      revenue: day.revenue,
      transactions: day.transactions,
      newCustomers: day.newCustomers,
    },
  },
  {
    id: makeId(),
    provider: "ga4",
    date: daysAgo(day.offset),
    data: {
      sessions: day.sessions,
      conversions: day.conversions,
      bounceRate: day.bounceRate,
    },
  },
  {
    id: makeId(),
    provider: "meta",
    date: daysAgo(day.offset),
    data: {
      spend: day.spend,
      clicks: day.clicks,
      impressions: day.impressions,
    },
  },
]);

export const DEMO_CONNECTED_PLATFORMS = ["stripe", "ga4", "meta"];
