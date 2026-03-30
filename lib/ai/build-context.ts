import { createServiceClient } from "@/lib/supabase/service";
import { daysAgo } from "@/lib/utils/dates";
import { sum, avg, calcTrend } from "@/lib/utils/math";

export interface StripeContext {
  connected: boolean;
  current7: { revenue: number; refunds: number; newCustomers: number; txCount: number };
  prev7: { revenue: number; refunds: number; newCustomers: number; txCount: number };
  revenueTrend: number;
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

export interface DigestContext {
  userId: string;
  stripe: StripeContext;
  ga4: GA4Context;
  meta: MetaContext;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(rows: any[], key: string): number[] {
  return rows.map((r) => {
    const data = r.data as Record<string, number>;
    return data[key] ?? 0;
  });
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
  };
  const stripePrev7 = {
    revenue: sum(pick(stripePrevRows, "revenue")),
    refunds: sum(pick(stripePrevRows, "refunds")),
    newCustomers: sum(pick(stripePrevRows, "newCustomers")),
    txCount: sum(pick(stripePrevRows, "txCount")),
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
  };
}