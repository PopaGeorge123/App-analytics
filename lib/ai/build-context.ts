import { createServiceClient } from "@/lib/supabase/service";
import { daysAgo } from "@/lib/utils/dates";
import { sum, avg, calcTrend } from "@/lib/utils/math";

export interface StripeContext {
  connected: boolean;
  current7: {
    revenue: number;
    refunds: number;
    newCustomers: number;
    txCount: number;
    mrr: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    churnedToday: number;
    arpu: number;
  };
  prev7: {
    revenue: number;
    refunds: number;
    newCustomers: number;
    txCount: number;
    mrr: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    churnedToday: number;
    arpu: number;
  };
  revenueTrend: number;
  mrrTrend: number;
}

export interface GA4Context {
  connected: boolean;
  current7: { sessions: number; totalUsers: number; newUsers: number; bounceRate: number; conversions: number };
  prev7: { sessions: number; totalUsers: number; newUsers: number; bounceRate: number; conversions: number };
  sessionsTrend: number;
}

export interface MetaContext {
  connected: boolean;
  currency: string;
  current7: { spend: number; impressions: number; clicks: number; reach: number; conversions: number };
  prev7: { spend: number; impressions: number; clicks: number; reach: number; conversions: number };
  spendTrend: number;
}

export interface EmailContext {
  platform: string;
  connected: boolean;
  current7: { subscribers: number; openRate: number; clickRate: number; sent: number };
  prev7: { subscribers: number; openRate: number; clickRate: number; sent: number };
  subscribersTrend: number;
}

export interface EcommerceContext {
  platform: string;
  connected: boolean;
  current7: { revenue: number; orders: number; newCustomers: number };
  prev7: { revenue: number; orders: number; newCustomers: number };
  revenueTrend: number;
}

export interface AttributionContext {
  /** Blended CAC across all ad platforms (ad spend / new customers) */
  blendedCAC: number | null;
  /** Total ad spend across all connected ad platforms */
  totalAdSpend: number;
  /** Total new customers from revenue platforms */
  totalNewCustomers: number;
}

export interface DigestContext {
  userId: string;
  stripe: StripeContext;
  ga4: GA4Context;
  meta: MetaContext;
  /** Email marketing platforms (Mailchimp, Klaviyo, Beehiiv) */
  emailPlatforms: EmailContext[];
  /** Ecommerce platforms (Shopify, WooCommerce, Gumroad, Lemon Squeezy, Paddle) */
  ecommercePlatforms: EcommerceContext[];
  /** Cross-channel attribution summary */
  attribution: AttributionContext;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(rows: any[], key: string): number[] {
  return rows.map((r) => {
    const data = r.data as Record<string, number>;
    return data[key] ?? 0;
  });
}

// ── Email platform helper ─────────────────────────────────────────────────

const EMAIL_PLATFORMS = ["mailchimp", "klaviyo", "beehiiv", "convertkit", "brevo"];
const ECOMMERCE_PLATFORMS = ["shopify", "woocommerce", "gumroad", "lemon-squeezy", "paddle"];

async function buildEmailContexts(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  cur7Start: string, cur7End: string,
  prev7Start: string, prev7End: string,
  hasIntegration: (p: string) => Promise<boolean>,
  getSnapshots: (provider: string, start: string, end: string) => Promise<{ data: Record<string, number> }[]>
): Promise<EmailContext[]> {
  const results: EmailContext[] = [];

  for (const platform of EMAIL_PLATFORMS) {
    const connected = await hasIntegration(platform);
    if (!connected) continue;

    const curRows = await getSnapshots(platform, cur7Start, cur7End);
    const prevRows = await getSnapshots(platform, prev7Start, prev7End);

    const current7 = {
      subscribers: Math.max(...pick(curRows, "subscribers").filter((v) => v > 0), 0),
      openRate: pick(curRows, "openRate").reduce((a, b) => a + b, 0) / (curRows.length || 1),
      clickRate: pick(curRows, "clickRate").reduce((a, b) => a + b, 0) / (curRows.length || 1),
      sent: pick(curRows, "sent").reduce((a, b) => a + b, 0),
    };
    const prev7 = {
      subscribers: Math.max(...pick(prevRows, "subscribers").filter((v) => v > 0), 0),
      openRate: pick(prevRows, "openRate").reduce((a, b) => a + b, 0) / (prevRows.length || 1),
      clickRate: pick(prevRows, "clickRate").reduce((a, b) => a + b, 0) / (prevRows.length || 1),
      sent: pick(prevRows, "sent").reduce((a, b) => a + b, 0),
    };

    results.push({
      platform,
      connected: true,
      current7,
      prev7,
      subscribersTrend: prev7.subscribers > 0
        ? ((current7.subscribers - prev7.subscribers) / prev7.subscribers) * 100
        : 0,
    });
  }

  return results;
}

async function buildEcommerceContexts(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  cur7Start: string, cur7End: string,
  prev7Start: string, prev7End: string,
  hasIntegration: (p: string) => Promise<boolean>,
  getSnapshots: (provider: string, start: string, end: string) => Promise<{ data: Record<string, number> }[]>
): Promise<EcommerceContext[]> {
  // Suppress unused param warning
  void userId; void db;
  const results: EcommerceContext[] = [];

  for (const platform of ECOMMERCE_PLATFORMS) {
    const connected = await hasIntegration(platform);
    if (!connected) continue;

    const curRows = await getSnapshots(platform, cur7Start, cur7End);
    const prevRows = await getSnapshots(platform, prev7Start, prev7End);

    const sumOf = (rows: { data: Record<string, number> }[], key: string) =>
      rows.reduce((a, r) => a + (r.data[key] ?? 0), 0);

    const current7 = {
      revenue: sumOf(curRows, "revenue"),
      orders: sumOf(curRows, "orders"),
      newCustomers: sumOf(curRows, "newCustomers"),
    };
    const prev7 = {
      revenue: sumOf(prevRows, "revenue"),
      orders: sumOf(prevRows, "orders"),
      newCustomers: sumOf(prevRows, "newCustomers"),
    };

    results.push({
      platform,
      connected: true,
      current7,
      prev7,
      revenueTrend: prev7.revenue > 0
        ? ((current7.revenue - prev7.revenue) / prev7.revenue) * 100
        : 0,
    });
  }

  return results;
}

function buildAttribution(
  metaConnected: boolean,
  metaCurrent7: { spend: number; conversions: number },
  stripeCurrent7: { newCustomers: number }
): AttributionContext {
  const totalAdSpend = metaConnected ? metaCurrent7.spend : 0;
  const totalNewCustomers = stripeCurrent7.newCustomers;
  const blendedCAC = totalAdSpend > 0 && totalNewCustomers > 0
    ? totalAdSpend / totalNewCustomers
    : null;

  return { blendedCAC, totalAdSpend, totalNewCustomers };
}

export async function buildContext(userId: string): Promise<DigestContext> {
  const db = createServiceClient();

  const current7Start = daysAgo(7);
  const current7End = daysAgo(1);
  const prev7Start = daysAgo(14);
  const prev7End = daysAgo(8);

  // Helper: check integration exists
  async function hasIntegration(platform: string): Promise<boolean> {
    const { data } = await db
      .from("integrations")
      .select("user_id")
      .eq("user_id", userId)
      .eq("platform", platform)
      .single();
    return !!data;
  }

  // Helper: fetch snapshots for a provider within a date range
  async function getSnapshots(provider: string, startDate: string, endDate: string) {
    const { data } = await db
      .from("daily_snapshots")
      .select("data")
      .eq("user_id", userId)
      .eq("provider", provider)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });
    return data ?? [];
  }

  // ── Stripe ──────────────────────────────────────────────────────────────
  const stripeConnected = await hasIntegration("stripe");
  const stripeCurRows = stripeConnected ? await getSnapshots("stripe", current7Start, current7End) : [];
  const stripePrevRows = stripeConnected ? await getSnapshots("stripe", prev7Start, prev7End) : [];

  const stripeCurrent7 = {
    revenue: sum(pick(stripeCurRows, "revenue")),
    refunds: sum(pick(stripeCurRows, "refunds")),
    newCustomers: sum(pick(stripeCurRows, "newCustomers")),
    txCount: sum(pick(stripeCurRows, "txCount")),
    // Subscription / SaaS metrics — use latest day's value (point-in-time, not sum)
    mrr: Math.max(...pick(stripeCurRows, "mrr").filter(v => v > 0), 0),
    activeSubscriptions: Math.max(...pick(stripeCurRows, "activeSubscriptions").filter(v => v > 0), 0),
    trialingSubscriptions: Math.max(...pick(stripeCurRows, "trialingSubscriptions").filter(v => v > 0), 0),
    churnedToday: sum(pick(stripeCurRows, "churnedToday")),
    arpu: Math.max(...pick(stripeCurRows, "arpu").filter(v => v > 0), 0),
  };
  const stripePrev7 = {
    revenue: sum(pick(stripePrevRows, "revenue")),
    refunds: sum(pick(stripePrevRows, "refunds")),
    newCustomers: sum(pick(stripePrevRows, "newCustomers")),
    txCount: sum(pick(stripePrevRows, "txCount")),
    mrr: Math.max(...pick(stripePrevRows, "mrr").filter(v => v > 0), 0),
    activeSubscriptions: Math.max(...pick(stripePrevRows, "activeSubscriptions").filter(v => v > 0), 0),
    trialingSubscriptions: Math.max(...pick(stripePrevRows, "trialingSubscriptions").filter(v => v > 0), 0),
    churnedToday: sum(pick(stripePrevRows, "churnedToday")),
    arpu: Math.max(...pick(stripePrevRows, "arpu").filter(v => v > 0), 0),
  };

  // ── GA4 ─────────────────────────────────────────────────────────────────
  const ga4Connected = await hasIntegration("ga4");
  const ga4CurRows = ga4Connected ? await getSnapshots("ga4", current7Start, current7End) : [];
  const ga4PrevRows = ga4Connected ? await getSnapshots("ga4", prev7Start, prev7End) : [];

  const ga4Current7 = {
    sessions: sum(pick(ga4CurRows, "sessions")),
    totalUsers: sum(pick(ga4CurRows, "totalUsers")),
    newUsers: sum(pick(ga4CurRows, "newUsers")),
    bounceRate: avg(pick(ga4CurRows, "bounceRate")),
    conversions: sum(pick(ga4CurRows, "conversions")),
  };
  const ga4Prev7 = {
    sessions: sum(pick(ga4PrevRows, "sessions")),
    totalUsers: sum(pick(ga4PrevRows, "totalUsers")),
    newUsers: sum(pick(ga4PrevRows, "newUsers")),
    bounceRate: avg(pick(ga4PrevRows, "bounceRate")),
    conversions: sum(pick(ga4PrevRows, "conversions")),
  };

  // ── Meta ─────────────────────────────────────────────────────────────────
  const metaConnected = await hasIntegration("meta");
  const metaCurRows = metaConnected ? await getSnapshots("meta", current7Start, current7End) : [];
  const metaPrevRows = metaConnected ? await getSnapshots("meta", prev7Start, prev7End) : [];

  // Currency: read directly from integrations table (authoritative source —
  // updated every time the user reconnects Meta). Fall back to snapshot data,
  // then USD.
  const { data: metaIntegration } = metaConnected
    ? await db
        .from("integrations")
        .select("currency")
        .eq("user_id", userId)
        .eq("platform", "meta")
        .single()
    : { data: null };

  const metaCurrency: string =
    (metaIntegration?.currency as string | null) ??
    (([...metaCurRows].reverse().find((r) => (r.data as Record<string, unknown>)?.currency)
      ?.data as Record<string, unknown> | undefined)?.currency as string) ??
    "USD";

  const metaCurrent7 = {
    spend: sum(pick(metaCurRows, "spend")),
    impressions: sum(pick(metaCurRows, "impressions")),
    clicks: sum(pick(metaCurRows, "clicks")),
    reach: sum(pick(metaCurRows, "reach")),
    conversions: sum(pick(metaCurRows, "conversions")),
  };
  const metaPrev7 = {
    spend: sum(pick(metaPrevRows, "spend")),
    impressions: sum(pick(metaPrevRows, "impressions")),
    clicks: sum(pick(metaPrevRows, "clicks")),
    reach: sum(pick(metaPrevRows, "reach")),
    conversions: sum(pick(metaPrevRows, "conversions")),
  };

  return {
    userId,
    stripe: {
      connected: stripeConnected,
      current7: stripeCurrent7,
      prev7: stripePrev7,
      revenueTrend: calcTrend(stripeCurrent7.revenue, stripePrev7.revenue),
      mrrTrend: calcTrend(stripeCurrent7.mrr, stripePrev7.mrr),
    },
    ga4: {
      connected: ga4Connected,
      current7: ga4Current7,
      prev7: ga4Prev7,
      sessionsTrend: calcTrend(ga4Current7.sessions, ga4Prev7.sessions),
    },
    meta: {
      connected: metaConnected,
      currency: metaCurrency,
      current7: metaCurrent7,
      prev7: metaPrev7,
      spendTrend: calcTrend(metaCurrent7.spend, metaPrev7.spend),
    },
    emailPlatforms: await buildEmailContexts(userId, db, current7Start, current7End, prev7Start, prev7End, hasIntegration, getSnapshots),
    ecommercePlatforms: await buildEcommerceContexts(userId, db, current7Start, current7End, prev7Start, prev7End, hasIntegration, getSnapshots),
    attribution: buildAttribution(metaConnected, metaCurrent7, stripeCurrent7),
  };
}