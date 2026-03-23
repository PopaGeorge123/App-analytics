import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── GET — return today's insight (or null) ────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: insight } = await db
    .from("ai_insights")
    .select("id, content, created_at")
    .eq("user_id", user.id)
    .eq("date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ insight: insight ?? null });
}

// ── POST — generate + save a new daily insight ────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // ── Gather context ────────────────────────────────────────────────────

  // Last 30 days of snapshots
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const { data: snapshots } = await db
    .from("daily_snapshots")
    .select("provider, date, data")
    .eq("user_id", user.id)
    .gte("date", cutoff.toISOString().slice(0, 10))
    .order("date", { ascending: false });

  // Website profile + pending tasks
  const { data: website } = await db
    .from("website_profiles")
    .select("url, score, description, last_scanned_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: tasks } = await db
    .from("website_tasks")
    .select("title, category, impact_score, completed")
    .eq("user_id", user.id)
    .order("impact_score", { ascending: false })
    .limit(10);

  // ── Build context string ─────────────────────────────────────────────

  function sum(snaps: typeof snapshots, provider: string, field: string): number {
    return (snaps ?? [])
      .filter((s) => s.provider === provider)
      .reduce((acc, s) => {
        const d = s.data as Record<string, number>;
        return acc + (d[field] ?? 0);
      }, 0);
  }

  const revenue30 = sum(snapshots, "stripe", "revenue");
  const sessions30 = sum(snapshots, "ga4", "sessions");
  const spend30 = sum(snapshots, "meta", "spend");
  const conversions30 = sum(snapshots, "ga4", "conversions");
  const newCustomers30 = sum(snapshots, "stripe", "newCustomers");

  // Last 7 days for comparison
  const cutoff7 = new Date();
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoffStr7 = cutoff7.toISOString().slice(0, 10);
  const snaps7 = (snapshots ?? []).filter((s) => s.date >= cutoffStr7);

  const revenue7 = sum(snaps7, "stripe", "revenue");
  const sessions7 = sum(snaps7, "ga4", "sessions");
  const spend7 = sum(snaps7, "meta", "spend");

  const pendingTasks = (tasks ?? []).filter((t) => !t.completed);
  const completedTasks = (tasks ?? []).filter((t) => t.completed);

  const contextBlock = `
TODAY: ${today}

=== BUSINESS METRICS (last 30 days) ===
Revenue: $${(revenue30 / 100).toFixed(2)} | Last 7d: $${(revenue7 / 100).toFixed(2)}
Sessions: ${sessions30} | Last 7d: ${sessions7}
Ad Spend: $${(spend30 / 100).toFixed(2)} | Last 7d: $${(spend7 / 100).toFixed(2)}
Conversions: ${conversions30}
New Customers: ${newCustomers30}
CAC: ${newCustomers30 > 0 ? `$${((spend30 / 100) / newCustomers30).toFixed(2)}` : "N/A"}

=== WEBSITE ===
URL: ${website?.url ?? "Not set"}
Health Score: ${website?.score ?? 0}/100
Summary: ${website?.description ?? "Not analyzed yet"}
Last Analyzed: ${website?.last_scanned_at ? new Date(website.last_scanned_at).toLocaleDateString() : "Never"}

=== WEBSITE TASKS ===
Pending (${pendingTasks.length}):
${pendingTasks.slice(0, 5).map((t) => `- [${t.category}] ${t.title} (+${t.impact_score} pts)`).join("\n") || "None"}

Completed (${completedTasks.length} total)
`.trim();

  const prompt = `You are an expert business analyst AI for a SaaS founder. You have access to their full business data for today.

${contextBlock}

Generate a concise, sharp Daily Business Insight for today. Structure it as:

**📊 Today's Snapshot**
2-3 sentences summarizing the most important numbers in plain language, with context (is this good/bad/average?).

**🔍 Key Observations**
3 bullet points — each one a specific, data-driven observation. Reference exact numbers. Identify trends, anomalies, or opportunities.

**⚡ Top 3 Actions for Today**
Numbered list. Concrete, actionable, specific to this data. NOT generic advice.

**💡 One Insight Worth Knowing**
One deeper observation about the business health — something non-obvious from the combined data.

Keep the tone sharp, analytical, and direct. No fluff. Speak like a senior analyst, not a life coach.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";

  // Delete old insight for today (replace with fresh one)
  await db
    .from("ai_insights")
    .delete()
    .eq("user_id", user.id)
    .eq("date", today);

  // Save new insight
  const { data: saved } = await db
    .from("ai_insights")
    .insert({ user_id: user.id, content, date: today })
    .select("id, content, created_at")
    .single();

  return NextResponse.json({ insight: saved });
}
