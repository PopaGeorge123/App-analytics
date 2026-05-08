import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { randomBytes } from "crypto";

type Snap = { provider: string; date: string; data: Record<string, number> };

function sumField(snaps: Snap[], provider: string, field: string) {
  return snaps.filter((s) => s.provider === provider).reduce((a, s) => a + (s.data[field] ?? 0), 0);
}
function avgField(snaps: Snap[], provider: string, field: string) {
  const rows = snaps.filter((s) => s.provider === provider && (s.data[field] ?? 0) !== 0);
  if (!rows.length) return 0;
  return rows.reduce((a, s) => a + (s.data[field] ?? 0), 0) / rows.length;
}
function growthPct(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}
function dailySeries(snaps: Snap[], provider: string, field: string, nDays = 30) {
  const byDate: Record<string, number> = {};
  for (const s of snaps) {
    if (s.provider === provider) byDate[s.date] = (byDate[s.date] ?? 0) + (s.data[field] ?? 0);
  }
  const result: { date: string; value: number }[] = [];
  const today = new Date();
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    result.push({ date: ds, value: byDate[ds] ?? 0 });
  }
  return result;
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = createServiceClient();
    const { data: userData } = await db.from("users").select("email, is_premium").eq("id", user.id).maybeSingle();

    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoffStr30 = cutoff30.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const { data: snapshots } = await db
      .from("daily_snapshots")
      .select("provider, date, data")
      .eq("user_id", user.id)
      .gte("date", cutoffStr30)
      .order("date", { ascending: true });

    const snaps = (snapshots ?? []) as Snap[];

    const cutoff7 = new Date();
    cutoff7.setDate(cutoff7.getDate() - 7);
    const cutoffStr7 = cutoff7.toISOString().slice(0, 10);
    const snaps7 = snaps.filter((s) => s.date >= cutoffStr7);
    const snapsPrev7 = snaps.filter((s) => s.date < cutoffStr7);

    const rev7 = sumField(snaps7, "stripe", "revenue");
    const revPrev7 = sumField(snapsPrev7, "stripe", "revenue");
    const refunds7 = sumField(snaps7, "stripe", "refunds");
    const txCount7 = sumField(snaps7, "stripe", "txCount");
    const newCust7 = sumField(snaps7, "stripe", "newCustomers");
    const rev30 = sumField(snaps, "stripe", "revenue");
    const refunds30 = sumField(snaps, "stripe", "refunds");
    const txCount30 = sumField(snaps, "stripe", "txCount");
    const newCust30 = sumField(snaps, "stripe", "newCustomers");
    const avgTxValue7 = txCount7 > 0 ? Math.round(rev7 / txCount7) : 0;
    const netRev7 = rev7 - refunds7;

    const sessions7 = sumField(snaps7, "ga4", "sessions");
    const sessionsPrev7 = sumField(snapsPrev7, "ga4", "sessions");
    const users7 = sumField(snaps7, "ga4", "users");
    const newUsers7 = sumField(snaps7, "ga4", "newUsers");
    const sessions30 = sumField(snaps, "ga4", "sessions");
    const bounceRate7 = Math.round(avgField(snaps7, "ga4", "bounceRate") * 100) / 100;
    const avgDuration7 = Math.round(avgField(snaps7, "ga4", "avgSessionDuration"));

    const adSpend7 = sumField(snaps7, "meta", "spend");
    const adSpend30 = sumField(snaps, "meta", "spend");
    const impressions7 = sumField(snaps7, "meta", "impressions");
    const clicks7 = sumField(snaps7, "meta", "clicks");
    const ctr7 = impressions7 > 0 ? Math.round((clicks7 / impressions7) * 10000) / 100 : 0;
    const cpc7 = clicks7 > 0 ? Math.round((adSpend7 / clicks7) * 100) / 100 : 0;
    const roas7 = adSpend7 > 0 ? Math.round(((rev7 / 100) / adSpend7) * 100) / 100 : null;

    const platforms = [...new Set(snaps.map((s) => s.provider))];

    const payload = {
      type: "dashboard",
      generatedBy: userData?.email ?? user.email ?? "Anonymous",
      generatedAt: new Date().toISOString(),
      stripe: { rev7, revPrev7, revGrowthPct: growthPct(rev7, revPrev7), refunds7, txCount7, newCust7, avgTxValue7, netRev7, rev30, refunds30, txCount30, newCust30 },
      ga4: { sessions7, sessionsPrev7, sessionsGrowthPct: growthPct(sessions7, sessionsPrev7), users7, newUsers7, bounceRate7, avgDuration7, sessions30 },
      meta: { adSpend7, adSpend30, impressions7, clicks7, ctr7, cpc7, roas7 },
      sparklines: {
        dailyRevenue: dailySeries(snaps, "stripe", "revenue", 30),
        dailySessions: dailySeries(snaps, "ga4", "sessions", 30),
        dailyAdSpend: dailySeries(snaps, "meta", "spend", 30),
      },
      platforms,
    };

    const token = randomBytes(18).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await db.from("share_tokens").insert({
      token, user_id: user.id,
      label: `Dashboard — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      date_from: cutoffStr30, date_to: today,
      platforms, payload, expires_at: expiresAt, view_count: 0,
    });

    if (error) {
      console.error("[dashboard/share] DB insert:", JSON.stringify(error));
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.json({ url: `${baseUrl}/share/${token}`, token, expiresAt });
  } catch (err) {
    console.error("[dashboard/share] Unhandled:", err);
    return NextResponse.json({ error: "Internal server error", detail: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = new URL(request.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
    const db = createServiceClient();
    const { error } = await db.from("share_tokens").delete().eq("token", token).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = createServiceClient();
    const { data, error } = await db
      .from("share_tokens")
      .select("token, label, expires_at, view_count, created_at, payload")
      .eq("user_id", user.id)
      .filter("payload->>type", "eq", "dashboard")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ links: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
