import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { randomBytes } from "crypto";

export const maxDuration = 30;

function sumField(
  snapshots: Array<{ provider: string; data: unknown }>,
  provider: string,
  field: string
): number {
  return snapshots
    .filter((s) => s.provider === provider)
    .reduce((acc, s) => acc + (((s.data as Record<string, number>)[field]) ?? 0), 0);
}

function avgField(
  snapshots: Array<{ provider: string; data: unknown }>,
  provider: string,
  field: string
): number {
  const rows = snapshots.filter((s) => s.provider === provider);
  if (!rows.length) return 0;
  return rows.reduce((acc, s) => acc + (((s.data as Record<string, number>)[field]) ?? 0), 0) / rows.length;
}

// POST /api/report/share
// Body: { dateFrom: string; dateTo: string; label?: string }
// Returns: { url: string; token: string; expiresAt: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const dateFrom: string = body.dateFrom ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const dateTo: string   = body.dateTo   ?? new Date().toISOString().slice(0, 10);
  const label: string    = body.label    ?? `Report ${dateFrom} → ${dateTo}`;

  const db = createServiceClient();

  // Fetch snapshots for the range
  const { data: snapshots } = await db
    .from("daily_snapshots")
    .select("provider, date, data")
    .eq("user_id", user.id)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true });

  const snaps = snapshots ?? [];
  const platforms = [...new Set(snaps.map((s) => s.provider))];

  // Fetch user email for "shared by" attribution
  const { data: userData } = await db
    .from("users")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  // Pre-aggregate the payload so the public page never touches the DB
  const revenue   = sumField(snaps, "stripe", "revenue");
  const txCount   = sumField(snaps, "stripe", "txCount");
  const sessions  = sumField(snaps, "ga4",    "sessions");
  const conversions = sumField(snaps, "ga4",  "conversions");
  const adSpend   = sumField(snaps, "meta",   "spend");
  const adClicks  = sumField(snaps, "meta",   "clicks");
  const bounceRate = avgField(snaps, "ga4",   "bounceRate");
  const newCustomers = sumField(snaps, "stripe", "newCustomers");

  // Build a simple daily revenue series for the sparkline (Stripe only)
  const dailyRevenue: { date: string; revenue: number }[] = [];
  const seen = new Set<string>();
  for (const s of snaps.filter((s) => s.provider === "stripe")) {
    if (!seen.has(s.date)) {
      seen.add(s.date);
      dailyRevenue.push({
        date: s.date,
        revenue: (s.data as Record<string, number>).revenue ?? 0,
      });
    }
  }

  const payload = {
    sharedBy: userData?.email ?? "Anonymous",
    dateFrom,
    dateTo,
    platforms,
    kpis: {
      revenue,       // cents
      txCount,
      sessions,
      conversions,
      adSpend,
      adClicks,
      bounceRate,
      newCustomers,
    },
    dailyRevenue,
    roas: adSpend > 0 && revenue > 0 ? (revenue / adSpend / 100) : null,
    cpc:  adClicks > 0 && adSpend > 0 ? (adSpend / adClicks) : null,
    convRate: sessions > 0 && conversions > 0 ? (conversions / sessions) * 100 : null,
  };

  // Generate a 24-char URL-safe token
  const token = randomBytes(18).toString("base64url");

  // Expires in 30 days
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await db.from("share_tokens").insert({
    token,
    user_id: user.id,
    label,
    date_from: dateFrom,
    date_to: dateTo,
    platforms,
    payload,
    expires_at: expiresAt,
    view_count: 0,
  });

  if (error) {
    console.error("[report/share] DB insert error:", error);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/report/${token}`;

  return NextResponse.json({ url, token, expiresAt, label });
}
