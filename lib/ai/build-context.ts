import { createServiceClient } from "@/lib/supabase/service";
import { daysAgo } from "@/lib/utils/dates";
import { sum, avg, calcTrend } from "@/lib/utils/math";

export interface StripeContext {
  connected: boolean;
  current7: {
    grossRevenue: number;   // cents
    netRevenue: number;     // cents (after refunds)
    refunds: number;        // cents
    refundRate: number;     // %
    txCount: number;
    avgTransactionValue: number; // cents (AOV)
    newCustomers: number;
    disputeCount: number;
    disputeAmount: number;  // cents
  };
  prev7: {
    grossRevenue: number;
    netRevenue: number;
    refunds: number;
    refundRate: number;
    txCount: number;
    avgTransactionValue: number;
    newCustomers: number;
    disputeCount: number;
    disputeAmount: number;
  };
  revenueTrend: number;
  aovTrend: number;
}

export interface GA4Context {
  connected: boolean;
  current7: {
    sessions: number;
    totalUsers: number;
    newUsers: number;
    bounceRate: number;
    conversions: number;
    ecommercePurchases: number;
    purchaseRevenue: number;
    addToCarts: number;
    checkouts: number;
    cartToCheckoutRate: number;
    checkoutToPurchaseRate: number;
  };
  prev7: {
    sessions: number;
    totalUsers: number;
    newUsers: number;
    bounceRate: number;
    conversions: number;
    ecommercePurchases: number;
    purchaseRevenue: number;
    addToCarts: number;
    checkouts: number;
  };
  sessionsTrend: number;
  purchaseRevenueTrend: number;
}

export interface MetaContext {
  connected: boolean;
  currency: string;
  current7: {
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    conversions: number;
    purchaseValue: number;
    roas: number;
    cpc: number;
    cpm: number;
    ctr: number;
    costPerPurchase: number;
    addToCartCount: number;
  };
  prev7: {
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    conversions: number;
    purchaseValue: number;
    roas: number;
  };
  spendTrend: number;
  roasTrend: number;
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
  current7: {
    grossRevenue: number;
    orders: number;
    newCustomers: number;
    aov: number;
    refundRate: number;
    cartAbandonmentRate: number;
  };
  prev7: {
    grossRevenue: number;
    orders: number;
    newCustomers: number;
    aov: number;
  };
  revenueTrend: number;
  aovTrend: number;
}

export interface AttributionContext {
  /** Blended ROAS across all ad platforms */
  blendedROAS: number | null;
  /** Blended CAC across all ad platforms (ad spend / new customers) */
  blendedCAC: number | null;
  /** Total ad spend across all connected ad platforms */
  totalAdSpend: number;
  /** Total purchase value attributed to ads */
  totalAdAttributedRevenue: number;
  /** Total new customers from revenue platforms */
  totalNewCustomers: number;
  /** Ad platforms contributing to spend */
  adPlatforms: string[];
}

export interface BusinessProfile {
  websiteUrl: string;
  businessDescription: string;
  industry: string;
  employeeCount: string;
  monthlyRevenue: string;
}

export interface DigestContext {
  userId: string;
  stripe: StripeContext;
  ga4: GA4Context;
  meta: MetaContext;
  /** Email marketing platforms (Mailchimp, Klaviyo) */
  emailPlatforms: EmailContext[];
  /** E-commerce store platforms (Shopify, WooCommerce, BigCommerce, etc.) */
  ecommercePlatforms: EcommerceContext[];
  /** Cross-channel attribution summary */
  attribution: AttributionContext;
  /** Business profile from onboarding */
  businessProfile: BusinessProfile;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(rows: any[], key: string): number[] {
  return rows.map((r) => {
    const data = r.data as Record<string, number>;
    return data[key] ?? 0;
  });
}

// ── Email platform helper ─────────────────────────────────────────────────

const EMAIL_PLATFORMS = ["mailchimp", "klaviyo", "brevo", "activecampaign"];
const ECOMMERCE_PLATFORMS = ["shopify", "woocommerce", "bigcommerce", "amazon", "etsy"];
const ADS_PLATFORMS = ["meta", "google-ads", "tiktok-ads", "pinterest-ads", "snapchat-ads"];

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
  void userId; void db;
  const results: EcommerceContext[] = [];

  for (const platform of ECOMMERCE_PLATFORMS) {
    const connected = await hasIntegration(platform);
    if (!connected) continue;

    const curRows = await getSnapshots(platform, cur7Start, cur7End);
    const prevRows = await getSnapshots(platform, prev7Start, prev7End);

    const sumOf = (rows: { data: Record<string, number> }[], key: string) =>
      rows.reduce((a, r) => a + (r.data[key] ?? 0), 0);
    const avgOf = (rows: { data: Record<string, number> }[], key: string) => {
      const valid = rows.map(r => r.data[key] ?? 0).filter(v => v > 0);
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    };

    const curOrders = sumOf(curRows, "orders");
    const curRevenue = sumOf(curRows, "grossRevenue") || sumOf(curRows, "revenue");
    const prevOrders = sumOf(prevRows, "orders");
    const prevRevenue = sumOf(prevRows, "grossRevenue") || sumOf(prevRows, "revenue");

    const current7: EcommerceContext["current7"] = {
      grossRevenue: curRevenue,
      orders: curOrders,
      newCustomers: sumOf(curRows, "newCustomers"),
      aov: curOrders > 0 ? curRevenue / curOrders : avgOf(curRows, "aov"),
      refundRate: avgOf(curRows, "refundRate"),
      cartAbandonmentRate: avgOf(curRows, "cartAbandonmentRate"),
    };
    const prev7: EcommerceContext["prev7"] = {
      grossRevenue: prevRevenue,
      orders: prevOrders,
      newCustomers: sumOf(prevRows, "newCustomers"),
      aov: prevOrders > 0 ? prevRevenue / prevOrders : avgOf(prevRows, "aov"),
    };

    results.push({
      platform,
      connected: true,
      current7,
      prev7,
      revenueTrend: prev7.grossRevenue > 0
        ? ((current7.grossRevenue - prev7.grossRevenue) / prev7.grossRevenue) * 100
        : 0,
      aovTrend: prev7.aov > 0 ? ((current7.aov - prev7.aov) / prev7.aov) * 100 : 0,
    });
  }

  return results;
}

function buildAttribution(
  adPlatformData: { platform: string; spend: number; purchaseValue: number }[],
  totalNewCustomers: number,
): AttributionContext {
  const connected = adPlatformData.filter(p => p.spend > 0);
  const totalAdSpend = connected.reduce((a, p) => a + p.spend, 0);
  const totalAdAttributedRevenue = connected.reduce((a, p) => a + p.purchaseValue, 0);
  const blendedROAS = totalAdSpend > 0 ? totalAdAttributedRevenue / totalAdSpend : null;
  const blendedCAC = totalAdSpend > 0 && totalNewCustomers > 0
    ? totalAdSpend / totalNewCustomers
    : null;

  return {
    blendedROAS,
    blendedCAC,
    totalAdSpend,
    totalAdAttributedRevenue,
    totalNewCustomers,
    adPlatforms: connected.map(p => p.platform),
  };
}

export async function buildContext(userId: string): Promise<DigestContext> {
  const db = createServiceClient();

  // ── Business profile ─────────────────────────────────────────────────────
  const { data: profileRow } = await db
    .from("users")
    .select("website_url, business_description, business_industry, employee_count, monthly_revenue")
    .eq("id", userId)
    .single();

  const businessProfile: BusinessProfile = {
    websiteUrl:          profileRow?.website_url          ?? "",
    businessDescription: profileRow?.business_description ?? "",
    industry:            profileRow?.business_industry    ?? "",
    employeeCount:       profileRow?.employee_count       ?? "",
    monthlyRevenue:      profileRow?.monthly_revenue      ?? "",
  };

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

  const stripeGross7    = sum(pick(stripeCurRows, "grossRevenue"));
  const stripePrevGross = sum(pick(stripePrevRows, "grossRevenue"));
  const stripeTxCount7  = sum(pick(stripeCurRows, "txCount"));

  const stripeCurrent7: StripeContext["current7"] = {
    grossRevenue:        stripeGross7,
    netRevenue:          sum(pick(stripeCurRows, "netRevenue")),
    refunds:             sum(pick(stripeCurRows, "refunds")),
    refundRate:          stripeCurRows.length > 0
      ? avg(pick(stripeCurRows, "refundRate"))
      : 0,
    txCount:             stripeTxCount7,
    avgTransactionValue: stripeTxCount7 > 0 ? Math.round(stripeGross7 / stripeTxCount7) : 0,
    newCustomers:        sum(pick(stripeCurRows, "newCustomers")),
    disputeCount:        sum(pick(stripeCurRows, "disputeCount")),
    disputeAmount:       sum(pick(stripeCurRows, "disputeAmount")),
  };
  const prevTxCount = sum(pick(stripePrevRows, "txCount"));
  const prevGross   = stripePrevGross;
  const stripePrev7: StripeContext["prev7"] = {
    grossRevenue:        prevGross,
    netRevenue:          sum(pick(stripePrevRows, "netRevenue")),
    refunds:             sum(pick(stripePrevRows, "refunds")),
    refundRate:          stripePrevRows.length > 0 ? avg(pick(stripePrevRows, "refundRate")) : 0,
    txCount:             prevTxCount,
    avgTransactionValue: prevTxCount > 0 ? Math.round(prevGross / prevTxCount) : 0,
    newCustomers:        sum(pick(stripePrevRows, "newCustomers")),
    disputeCount:        sum(pick(stripePrevRows, "disputeCount")),
    disputeAmount:       sum(pick(stripePrevRows, "disputeAmount")),
  };

  // ── GA4 ─────────────────────────────────────────────────────────────────
  const ga4Connected = await hasIntegration("ga4");
  const ga4CurRows = ga4Connected ? await getSnapshots("ga4", current7Start, current7End) : [];
  const ga4PrevRows = ga4Connected ? await getSnapshots("ga4", prev7Start, prev7End) : [];

  const ga4AddToCarts7 = sum(pick(ga4CurRows, "addToCarts"));
  const ga4Checkouts7  = sum(pick(ga4CurRows, "checkouts"));
  const ga4Purchases7  = sum(pick(ga4CurRows, "ecommercePurchases"));

  const ga4Current7: GA4Context["current7"] = {
    sessions:               sum(pick(ga4CurRows, "sessions")),
    totalUsers:             sum(pick(ga4CurRows, "totalUsers")),
    newUsers:               sum(pick(ga4CurRows, "newUsers")),
    bounceRate:             avg(pick(ga4CurRows, "bounceRate")),
    conversions:            sum(pick(ga4CurRows, "conversions")),
    ecommercePurchases:     ga4Purchases7,
    purchaseRevenue:        sum(pick(ga4CurRows, "purchaseRevenue")),
    addToCarts:             ga4AddToCarts7,
    checkouts:              ga4Checkouts7,
    cartToCheckoutRate:     ga4AddToCarts7 > 0 ? (ga4Checkouts7 / ga4AddToCarts7) * 100 : 0,
    checkoutToPurchaseRate: ga4Checkouts7 > 0 ? (ga4Purchases7 / ga4Checkouts7) * 100 : 0,
  };
  const ga4Prev7: GA4Context["prev7"] = {
    sessions:           sum(pick(ga4PrevRows, "sessions")),
    totalUsers:         sum(pick(ga4PrevRows, "totalUsers")),
    newUsers:           sum(pick(ga4PrevRows, "newUsers")),
    bounceRate:         avg(pick(ga4PrevRows, "bounceRate")),
    conversions:        sum(pick(ga4PrevRows, "conversions")),
    ecommercePurchases: sum(pick(ga4PrevRows, "ecommercePurchases")),
    purchaseRevenue:    sum(pick(ga4PrevRows, "purchaseRevenue")),
    addToCarts:         sum(pick(ga4PrevRows, "addToCarts")),
    checkouts:          sum(pick(ga4PrevRows, "checkouts")),
  };

  // ── Meta ─────────────────────────────────────────────────────────────────
  const metaConnected = await hasIntegration("meta");
  const metaCurRows = metaConnected ? await getSnapshots("meta", current7Start, current7End) : [];
  const metaPrevRows = metaConnected ? await getSnapshots("meta", prev7Start, prev7End) : [];

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

  const metaSpend7     = sum(pick(metaCurRows, "spend"));
  const metaClicks7    = sum(pick(metaCurRows, "clicks"));
  const metaImpr7      = sum(pick(metaCurRows, "impressions"));
  const metaPurchVal7  = sum(pick(metaCurRows, "purchaseValue"));
  const metaConv7      = sum(pick(metaCurRows, "conversions"));

  const metaCurrent7: MetaContext["current7"] = {
    spend:            metaSpend7,
    impressions:      metaImpr7,
    clicks:           metaClicks7,
    reach:            sum(pick(metaCurRows, "reach")),
    conversions:      metaConv7,
    purchaseValue:    metaPurchVal7,
    roas:             metaSpend7 > 0 ? metaPurchVal7 / metaSpend7 : 0,
    cpc:              metaClicks7 > 0 ? metaSpend7 / metaClicks7 : 0,
    cpm:              metaImpr7 > 0 ? (metaSpend7 / metaImpr7) * 1000 : 0,
    ctr:              metaImpr7 > 0 ? (metaClicks7 / metaImpr7) * 100 : 0,
    costPerPurchase:  metaConv7 > 0 ? metaSpend7 / metaConv7 : 0,
    addToCartCount:   sum(pick(metaCurRows, "addToCartCount")),
  };
  const metaPrevSpend = sum(pick(metaPrevRows, "spend"));
  const metaPrevPurchVal = sum(pick(metaPrevRows, "purchaseValue"));
  const metaPrev7: MetaContext["prev7"] = {
    spend:         metaPrevSpend,
    impressions:   sum(pick(metaPrevRows, "impressions")),
    clicks:        sum(pick(metaPrevRows, "clicks")),
    reach:         sum(pick(metaPrevRows, "reach")),
    conversions:   sum(pick(metaPrevRows, "conversions")),
    purchaseValue: metaPrevPurchVal,
    roas:          metaPrevSpend > 0 ? metaPrevPurchVal / metaPrevSpend : 0,
  };

  // ── Additional ad platform spend (Google Ads, TikTok, etc.) ─────────────
  const adPlatformData: { platform: string; spend: number; purchaseValue: number }[] = [
    { platform: "meta", spend: metaSpend7, purchaseValue: metaPurchVal7 },
  ];
  for (const adPlatform of ADS_PLATFORMS.filter(p => p !== "meta")) {
    const connected = await hasIntegration(adPlatform);
    if (!connected) continue;
    const rows = await getSnapshots(adPlatform, current7Start, current7End);
    adPlatformData.push({
      platform: adPlatform,
      spend: sum(pick(rows, "spend")),
      purchaseValue: sum(pick(rows, "purchaseValue")),
    });
  }

  // ── Total new customers across all store + payment platforms ─────────────
  const allNewCustomers = stripeCurrent7.newCustomers
    + (await buildEcommerceContexts(userId, db, current7Start, current7End, prev7Start, prev7End, hasIntegration, getSnapshots))
        .reduce((a, ec) => a + ec.current7.newCustomers, 0);

  return {
    userId,
    stripe: {
      connected: stripeConnected,
      current7: stripeCurrent7,
      prev7: stripePrev7,
      revenueTrend: calcTrend(stripeCurrent7.grossRevenue, stripePrev7.grossRevenue),
      aovTrend: calcTrend(stripeCurrent7.avgTransactionValue, stripePrev7.avgTransactionValue),
    },
    ga4: {
      connected: ga4Connected,
      current7: ga4Current7,
      prev7: ga4Prev7,
      sessionsTrend: calcTrend(ga4Current7.sessions, ga4Prev7.sessions),
      purchaseRevenueTrend: calcTrend(ga4Current7.purchaseRevenue, ga4Prev7.purchaseRevenue),
    },
    meta: {
      connected: metaConnected,
      currency: metaCurrency,
      current7: metaCurrent7,
      prev7: metaPrev7,
      spendTrend: calcTrend(metaCurrent7.spend, metaPrev7.spend),
      roasTrend: calcTrend(metaCurrent7.roas, metaPrev7.roas),
    },
    emailPlatforms: await buildEmailContexts(userId, db, current7Start, current7End, prev7Start, prev7End, hasIntegration, getSnapshots),
    ecommercePlatforms: await buildEcommerceContexts(userId, db, current7Start, current7End, prev7Start, prev7End, hasIntegration, getSnapshots),
    attribution: buildAttribution(adPlatformData, allNewCustomers),
    businessProfile,
  };
}