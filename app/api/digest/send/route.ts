import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import Anthropic from "@anthropic-ai/sdk";
import { sendDigestEmail } from "@/lib/email/send-digest";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sum(
  snaps: Array<{ provider: string; date: string; data: unknown }> | null,
  provider: string,
  field: string
): number {
  return (snaps ?? [])
    .filter((s) => s.provider === provider)
    .reduce((acc, s) => {
      const d = s.data as Record<string, number>;
      return acc + (d[field] ?? 0);
    }, 0);
}

function avg(
  snaps: Array<{ provider: string; date: string; data: unknown }> | null,
  provider: string,
  field: string
): number {
  const rows = (snaps ?? []).filter((s) => s.provider === provider);
  if (!rows.length) return 0;
  const total = rows.reduce((acc, s) => {
    const d = s.data as Record<string, number>;
    return acc + (d[field] ?? 0);
  }, 0);
  return total / rows.length;
}

// POST — generate + send a digest for the currently authenticated user
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Check digest preference
  const { data: userData } = await db
    .from("users")
    .select("digest_subscribed, email")
    .eq("id", user.id)
    .maybeSingle();

  const emailAddress = userData?.email ?? user.email;
  if (!emailAddress) {
    return NextResponse.json({ error: "No email address on file" }, { status: 400 });
  }

  // Fetch last 14 days of snapshots
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const { data: snapshots } = await db
    .from("daily_snapshots")
    .select("provider, date, data")
    .eq("user_id", user.id)
    .gte("date", cutoff.toISOString().slice(0, 10))
    .order("date", { ascending: false });

  const cutoff7 = new Date();
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoffStr7 = cutoff7.toISOString().slice(0, 10);
  const snaps7 = (snapshots ?? []).filter((s) => s.date >= cutoffStr7);
  const snapsPrev7 = (snapshots ?? []).filter((s) => s.date < cutoffStr7);

  const revenue7 = sum(snaps7, "stripe", "revenue");
  const revenuePrev = sum(snapsPrev7, "stripe", "revenue");
  const sessions7 = sum(snaps7, "ga4", "sessions");
  const sessionsPrev = sum(snapsPrev7, "ga4", "sessions");
  const spend7 = sum(snaps7, "meta", "spend");
  const bounceRate7 = avg(snaps7, "ga4", "bounceRate");
  const newCustomers7 = sum(snaps7, "stripe", "newCustomers");

  // Website data
  const { data: website } = await db
    .from("website_profiles")
    .select("url, score, description")
    .eq("user_id", user.id)
    .maybeSingle();

  const revChange = revenuePrev > 0 ? ((revenue7 - revenuePrev) / revenuePrev) * 100 : 0;
  const sessChange = sessionsPrev > 0 ? ((sessions7 - sessionsPrev) / sessionsPrev) * 100 : 0;

  const contextBlock = `
DATE: ${today}
Revenue (7d): $${(revenue7 / 100).toFixed(2)} (${revChange >= 0 ? "+" : ""}${revChange.toFixed(1)}% vs prev week)
Sessions (7d): ${sessions7} (${sessChange >= 0 ? "+" : ""}${sessChange.toFixed(1)}% vs prev week)
Ad Spend (7d): $${(spend7 / 100).toFixed(2)}
New Customers (7d): ${newCustomers7}
Bounce Rate (7d): ${bounceRate7.toFixed(1)}%
CAC: ${newCustomers7 > 0 ? `$${((spend7 / 100) / newCustomers7).toFixed(2)}` : "N/A"}
Website: ${website?.url ?? "Not set"} — Score ${website?.score ?? 0}/100
`.trim();

  // Generate digest content via Claude
  const aiResponse = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 900,
    system: `You are a concise business intelligence assistant. Generate a weekly digest JSON object based on the provided metrics. Return ONLY valid JSON, no markdown.

Schema:
{
  "summary": "2-3 sentence plain English overview",
  "highlights": [
    { "metric": "Revenue", "value": "$X.XX", "trend": "up|down|flat", "change": "+X%", "context": "brief note" }
  ],
  "anomalies": [
    { "title": "short title", "description": "what happened", "severity": "high|medium|low", "dataSource": "Stripe|GA4|Meta" }
  ],
  "cross_insight": "One sentence connecting two data sources",
  "action": { "title": "Top action", "description": "what to do", "priority": "High|Medium|Low", "effort": "Low|Medium|High" }
}`,
    messages: [
      {
        role: "user",
        content: `Generate a weekly digest for this business:\n\n${contextBlock}`,
      },
    ],
  });

  let digestContent;
  try {
    let raw = (aiResponse.content[0] as { type: string; text: string }).text.trim();
    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    // Extract first JSON object in case there's surrounding text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    digestContent = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Failed to parse AI digest:", err);
    return NextResponse.json({ error: "Failed to parse AI digest" }, { status: 500 });
  }

  // Save digest to DB (upsert so pressing the button twice on the same day doesn't fail)
  const { data: savedDigest, error: saveError } = await db
    .from("digests")
    .upsert(
      {
        user_id: user.id,
        date: today,
        summary: digestContent.summary ?? "",
        highlights: digestContent.highlights ?? [],
        anomalies: digestContent.anomalies ?? [],
        cross_insight: digestContent.cross_insight ?? "",
        action: digestContent.action ?? {},
        raw_context: { contextBlock },
      },
      { onConflict: "user_id,date" }
    )
    .select("id, created_at")
    .single();

  if (saveError) {
    console.error("Failed to save digest:", saveError);
    return NextResponse.json({ error: "Failed to save digest", detail: saveError.message }, { status: 500 });
  }

  // Send email
  try {
    await sendDigestEmail(emailAddress, {
      id: savedDigest.id,
      user_id: user.id,
      date: today,
      summary: digestContent.summary ?? "",
      highlights: digestContent.highlights ?? [],
      anomalies: digestContent.anomalies ?? [],
      cross_insight: digestContent.cross_insight ?? "",
      action: digestContent.action ?? {},
      raw_context: { contextBlock },
      created_at: savedDigest.created_at,
    });
  } catch (emailErr) {
    console.error("Digest email failed:", emailErr);
    // Don't fail — digest was still saved
  }

  return NextResponse.json({ success: true, digest: digestContent });
}
