import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import Anthropic from "@anthropic-ai/sdk";
import { REVENUE_PROVIDERS, ANALYTICS_PROVIDERS, ADS_PROVIDERS } from "@/lib/integrations/catalog";
import { checkRateLimit } from "@/lib/rateLimit";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Snap = { provider: string; date: string; data: unknown };

function sumSnaps(snaps: Snap[] | null, provider: string, field: string): number {
  return (snaps ?? [])
    .filter((s) => s.provider === provider)
    .reduce((acc, s) => acc + ((s.data as Record<string, number>)[field] ?? 0), 0);
}

/** Sum a field across multiple providers */
function sumProviders(snaps: Snap[] | null, providers: string[], field: string): number {
  return (snaps ?? [])
    .filter((s) => providers.includes(s.provider))
    .reduce((acc, s) => acc + ((s.data as Record<string, number>)[field] ?? 0), 0);
}

/** Latest point-in-time value (snaps ordered desc — most recent first) */
function latest(snaps: Snap[] | null, provider: string, field: string): number {
  const rows = (snaps ?? []).filter(
    (s) => s.provider === provider && (s.data as Record<string, number>)[field] != null
  );
  if (!rows.length) return 0;
  return (rows[0].data as Record<string, number>)[field] ?? 0;
}

/** Pick primary analytics provider (most days with data) */
function primaryAnalytics(snaps: Snap[] | null, connectedAnalytics: string[]): string | null {
  const counts: Record<string, number> = {};
  for (const s of snaps ?? []) {
    if (!connectedAnalytics.includes(s.provider)) continue;
    const hasData = Object.values(s.data as Record<string, number>).some((v) => v > 0);
    if (hasData) counts[s.provider] = (counts[s.provider] ?? 0) + 1;
  }
  const sorted = Object.keys(counts).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
  return sorted[0] ?? null;
}

async function buildDataContext(userId: string, db: ReturnType<typeof createServiceClient>): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch 90 days so the AI can answer any custom date range question
  const cutoff90 = new Date();
  cutoff90.setDate(cutoff90.getDate() - 90);
  const { data: snapshots } = await db
    .from("daily_snapshots")
    .select("provider, date, data")
    .eq("user_id", userId)
    .gte("date", cutoff90.toISOString().slice(0, 10))
    .order("date", { ascending: true }); // asc so daily table reads chronologically

  const snapsDesc = [...(snapshots ?? [])].reverse(); // for "latest" lookups

  const { data: website } = await db
    .from("website_profiles")
    .select("url, score, description, last_scanned_at")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: tasks } = await db
    .from("website_tasks")
    .select("title, category, impact_score, completed")
    .eq("user_id", userId)
    .order("impact_score", { ascending: false })
    .limit(10);

  const { data: integrations } = await db
    .from("integrations")
    .select("platform, connected_at, currency")
    .eq("user_id", userId);

  const connectedPlatforms = (integrations ?? []).map((i) => i.platform);
  const connRevenue   = connectedPlatforms.filter((p) => REVENUE_PROVIDERS.includes(p));
  const connAnalytics = connectedPlatforms.filter((p) => ANALYTICS_PROVIDERS.includes(p));
  const connAds       = connectedPlatforms.filter((p) => ADS_PROVIDERS.includes(p));
  const primaryAn     = primaryAnalytics(snapshots, connAnalytics);

  // Meta currency
  const metaCurrency: string =
    (snapsDesc.find((s) => s.provider === "meta" && (s.data as Record<string, unknown>)?.currency)
      ?.data as Record<string, unknown> | undefined)?.currency as string ?? "USD";

  const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const fmtCur = (n: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 2 }).format(n);

  // ── Rolling windows ─────────────────────────────────────────────────────
  function snapsInRange(from: string, to: string) {
    return (snapshots ?? []).filter((s) => s.date >= from && s.date <= to);
  }

  const d7from  = new Date(); d7from.setDate(d7from.getDate() - 7);
  const d30from = new Date(); d30from.setDate(d30from.getDate() - 30);
  const d90from = cutoff90;

  const snaps7  = snapsInRange(d7from.toISOString().slice(0, 10), today);
  const snaps30 = snapsInRange(d30from.toISOString().slice(0, 10), today);
  const snaps90 = snapshots ?? [];

  // Revenue (sum all revenue providers)
  const rev7  = sumProviders(snaps7,  connRevenue, "revenue");
  const rev30 = sumProviders(snaps30, connRevenue, "revenue");
  const rev90 = sumProviders(snaps90, connRevenue, "revenue");

  // Sessions (primary analytics only)
  const sess7  = primaryAn ? sumSnaps(snaps7,  primaryAn, "sessions") : 0;
  const sess30 = primaryAn ? sumSnaps(snaps30, primaryAn, "sessions") : 0;
  const sess90 = primaryAn ? sumSnaps(snaps90, primaryAn, "sessions") : 0;

  // Ad spend (sum all ad providers)
  const spend7  = sumProviders(snaps7,  connAds, "spend");
  const spend30 = sumProviders(snaps30, connAds, "spend");
  const spend90 = sumProviders(snaps90, connAds, "spend");

  const newCx7  = sumProviders(snaps7,  connRevenue, "newCustomers");
  const newCx30 = sumProviders(snaps30, connRevenue, "newCustomers");
  const churned30 = sumProviders(snaps30, connRevenue, "churnedToday");
  const refunds30 = sumProviders(snaps30, connRevenue, "refunds");

  const currentMRR  = latest(snapsDesc, "stripe", "mrr");
  const activeSubs  = latest(snapsDesc, "stripe", "activeSubscriptions");
  const trialSubs   = latest(snapsDesc, "stripe", "trialingSubscriptions");
  const arpu        = latest(snapsDesc, "stripe", "arpu");
  const convs30     = primaryAn ? sumSnaps(snaps30, primaryAn, "conversions") : 0;
  const bounce30    = primaryAn
    ? (() => {
        const rows = snaps30.filter((s) => s.provider === primaryAn && (s.data as Record<string, number>).bounceRate > 0);
        return rows.length ? rows.reduce((a, s) => a + ((s.data as Record<string, number>).bounceRate ?? 0), 0) / rows.length : 0;
      })()
    : 0;

  const churnRate = activeSubs > 0 ? ((churned30 / activeSubs) * 100).toFixed(2) : "N/A";
  const cac30     = newCx30 > 0 && spend30 > 0 ? fmtCur(spend30 / newCx30, metaCurrency) : "N/A";

  // ── Daily breakdown table (last 90 days) ───────────────────────────────
  // Build a compact day → {revenue, sessions, adSpend, newCustomers} table.
  // This lets the AI answer ANY custom date range question (e.g. "Apr 1–4").
  type DayRow = { rev: number; sess: number; spend: number; newCx: number };
  const dayMap: Record<string, DayRow> = {};

  for (const s of snapshots ?? []) {
    if (!dayMap[s.date]) dayMap[s.date] = { rev: 0, sess: 0, spend: 0, newCx: 0 };
    const d = s.data as Record<string, number>;
    if (connRevenue.includes(s.provider)) {
      dayMap[s.date].rev   += d.revenue ?? 0;
      dayMap[s.date].newCx += d.newCustomers ?? 0;
    }
    if (s.provider === primaryAn) {
      dayMap[s.date].sess  += d.sessions ?? 0;
    }
    if (connAds.includes(s.provider)) {
      dayMap[s.date].spend += d.spend ?? 0;
    }
  }

  const sortedDays = Object.keys(dayMap).sort();

  // Format the table — revenue in $, sessions as count, ad spend in currency
  const dailyLines = sortedDays.map((date) => {
    const r = dayMap[date];
    const parts: string[] = [`${date}:`];
    if (connRevenue.length > 0) parts.push(`rev=${fmtUSD(r.rev)}`);
    if (primaryAn)              parts.push(`sessions=${r.sess}`);
    if (connAds.length > 0)     parts.push(`adSpend=${fmtCur(r.spend, metaCurrency)}`);
    if (r.newCx > 0)            parts.push(`newCx=${r.newCx}`);
    return parts.join(" ");
  });

  // ── Per-platform section for non-Stripe revenue providers ───────────────
  const extraRevLines: string[] = [];
  for (const p of connRevenue.filter((p) => p !== "stripe")) {
    const r = sumSnaps(snaps30, p, "revenue");
    const nc = sumSnaps(snaps30, p, "newCustomers");
    if (r > 0) extraRevLines.push(`${p}: ${fmtUSD(r)} revenue, ${nc} new customers (30d)`);
  }

  // ── Extra analytics providers ────────────────────────────────────────────
  const extraAnLines: string[] = [];
  for (const p of connAnalytics.filter((p) => p !== primaryAn)) {
    const v = primaryAn ? sumSnaps(snaps30, p, "sessions") : 0;
    if (v > 0) extraAnLines.push(`${p}: ${v} sessions (30d) — NOT used for totals to avoid double-counting`);
  }

  // ── Extra ads providers ──────────────────────────────────────────────────
  const extraAdsLines: string[] = [];
  for (const p of connAds) {
    const sp = sumSnaps(snaps30, p, "spend");
    const cl = sumSnaps(snaps30, p, "clicks");
    if (sp > 0) extraAdsLines.push(`${p}: ${fmtCur(sp, metaCurrency)} spend, ${cl} clicks (30d)`);
  }

  const pendingTasks   = (tasks ?? []).filter((t) => !t.completed);
  const completedTasks = (tasks ?? []).filter((t) => t.completed);

  return `TODAY: ${today}
CONNECTED PLATFORMS: ${connectedPlatforms.join(", ") || "none"}
PRIMARY ANALYTICS SOURCE: ${primaryAn ?? "none"} (used for sessions — summing multiple analytics tools would double-count)
REVENUE PLATFORMS: ${connRevenue.join(", ") || "none"} (revenue is summed across all)
ADS PLATFORMS: ${connAds.join(", ") || "none"} (spend is summed across all)

=== REVENUE & SUBSCRIPTIONS (all revenue platforms combined) ===
Revenue — Last 7d: ${fmtUSD(rev7)} | Last 30d: ${fmtUSD(rev30)} | Last 90d: ${fmtUSD(rev90)}
Refunds (30d): ${fmtUSD(refunds30)}
New Customers — Last 7d: ${newCx7} | Last 30d: ${newCx30}
Cancellations (30d): ${churned30}
Monthly Churn Rate: ${churnRate}%
MRR (current): ${fmtUSD(currentMRR)}/month
Active Subscriptions: ${activeSubs} (${trialSubs} trialing)
ARPU: ${fmtUSD(arpu)}/month
CAC (30d): ${cac30}
${extraRevLines.length ? "\nPer-platform revenue (30d):\n" + extraRevLines.join("\n") : ""}

=== TRAFFIC (via ${primaryAn ?? "no analytics connected"}) ===
Sessions — Last 7d: ${sess7} | Last 30d: ${sess30} | Last 90d: ${sess90}
Conversions (30d): ${convs30}
Avg Bounce Rate (30d): ${bounce30 > 0 ? bounce30.toFixed(1) + "%" : "N/A"}
${extraAnLines.length ? "\nOther analytics (not used for totals):\n" + extraAnLines.join("\n") : ""}

=== ADVERTISING (all ad platforms combined) ===
Ad Spend (${metaCurrency}) — Last 7d: ${fmtCur(spend7, metaCurrency)} | Last 30d: ${fmtCur(spend30, metaCurrency)} | Last 90d: ${fmtCur(spend90, metaCurrency)}
${extraAdsLines.length ? "\nPer-platform ad spend (30d):\n" + extraAdsLines.join("\n") : ""}

=== WEBSITE ===
URL: ${website?.url ?? "Not set"}
Health Score: ${website?.score ?? 0}/100
Summary: ${website?.description ?? "Not analyzed yet"}
Last Analyzed: ${website?.last_scanned_at ? new Date(website.last_scanned_at).toLocaleDateString() : "Never"}

=== WEBSITE TASKS ===
Pending (${pendingTasks.length}): ${pendingTasks.slice(0, 5).map((t) => `[${t.category}] ${t.title} (+${t.impact_score}pts)`).join(" | ") || "None"}
Completed: ${completedTasks.length} tasks done

=== DAILY DATA (last 90 days — use this to answer any custom date range question) ===
${dailyLines.join("\n") || "No daily data available yet"}`.trim();
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isPremiumUser } = await import("@/lib/supabase/isPremiumUser");
  if (!(await isPremiumUser(user.id))) {
    return NextResponse.json({ error: "Premium required." }, { status: 403 });
  }

  // 20 AI messages per minute per user
  const rl = checkRateLimit(`ai-chat:${user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before sending another message." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const body = await req.json();
  const userMessage: string = (body.message ?? "").trim();
  const conversationId: string | null = body.conversationId ?? null;

  if (!userMessage) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const db = createServiceClient();

  // Verify conversation belongs to user
  const { data: conv } = await db
    .from("ai_conversations")
    .select("id, title")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  // Load last 20 messages scoped to this conversation
  const { data: history } = await db
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);

  const orderedHistory = (history ?? []).reverse();

  // Auto-title conversation from first user message
  const isFirstMessage = orderedHistory.length === 0;
  if (isFirstMessage && conv.title === "New Chat") {
    const autoTitle = userMessage.slice(0, 50) + (userMessage.length > 50 ? "…" : "");
    await db
      .from("ai_conversations")
      .update({ title: autoTitle })
      .eq("id", conversationId);
  }

  // Build data context
  const dataContext = await buildDataContext(user.id, db);

  const systemPrompt = `You are an expert AI business advisor with full access to this founder's real-time business data. You have access to data from all their connected platforms (Stripe, Paddle, Shopify, Google Analytics, Plausible, Meta Ads, Google Ads, and more).

Here is their current business data:

${dataContext}

Instructions:
- Answer questions about their data with specific numbers and context
- You have a DAILY DATA section with up to 90 days of daily rows — use it to answer any custom date range question (e.g. "from April 1 to today", "last month", "this week"). Simply sum the relevant rows.
- Revenue figures in the data are in CENTS — divide by 100 for display (e.g. rev=$4000 → $40.00). The fmtUSD function has already done this for the aggregated totals, but for the daily rows you must divide by 100 yourself.
- Ad spend is already in the platform's native currency (shown in ADS PLATFORMS section).
- Give direct, actionable advice — no fluff or generic platitudes
- Reference exact metrics when relevant
- When asked about a specific date range, look up the daily rows in the DAILY DATA section and sum them — do NOT say you don't have access to that data.
- If asked about something genuinely not in the data, say so clearly
- Keep responses concise but complete
- Format numbers nicely — use the user's local currency if stated, otherwise use the currency shown in the data
- Format lists and sections with markdown for readability`;

  // Build messages array for Claude
  const claudeMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...orderedHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    })),
    { role: "user", content: userMessage },
  ];

  // Call Claude
  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: claudeMessages,
  });

  const assistantContent =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Save user message
  await db.from("ai_messages").insert({
    user_id: user.id,
    role: "user",
    content: userMessage,
    conversation_id: conversationId,
  });

  // Save assistant reply
  const { data: saved } = await db
    .from("ai_messages")
    .insert({
      user_id: user.id,
      role: "assistant",
      content: assistantContent,
      conversation_id: conversationId,
    })
    .select("id, role, content, created_at")
    .single();

  // Return reply + updated title (may have changed from auto-title)
  const updatedTitle = isFirstMessage
    ? (userMessage.slice(0, 50) + (userMessage.length > 50 ? "…" : ""))
    : undefined;

  return NextResponse.json({ reply: saved, updatedTitle });
}
