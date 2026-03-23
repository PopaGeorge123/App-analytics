import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import Anthropic from "@anthropic-ai/sdk";

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

async function buildDataContext(userId: string, db: ReturnType<typeof createServiceClient>): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const { data: snapshots } = await db
    .from("daily_snapshots")
    .select("provider, date, data")
    .eq("user_id", userId)
    .gte("date", cutoff.toISOString().slice(0, 10))
    .order("date", { ascending: false });

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

  const revenue30 = sum(snapshots, "stripe", "revenue");
  const sessions30 = sum(snapshots, "ga4", "sessions");
  const spend30 = sum(snapshots, "meta", "spend");
  const conversions30 = sum(snapshots, "ga4", "conversions");
  const newCustomers30 = sum(snapshots, "stripe", "newCustomers");

  const cutoff7 = new Date();
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoffStr7 = cutoff7.toISOString().slice(0, 10);
  const snaps7 = (snapshots ?? []).filter((s) => s.date >= cutoffStr7);

  const revenue7 = sum(snaps7, "stripe", "revenue");
  const sessions7 = sum(snaps7, "ga4", "sessions");
  const spend7 = sum(snaps7, "meta", "spend");

  const pendingTasks = (tasks ?? []).filter((t) => !t.completed);
  const completedTasks = (tasks ?? []).filter((t) => t.completed);

  return `TODAY: ${today}

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
Completed (${completedTasks.length} total)`.trim();
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const systemPrompt = `You are an expert AI business advisor with full access to this founder's real-time business data. You analyze their metrics across Stripe (revenue), Google Analytics 4 (traffic), Meta Ads (advertising), and their website health score.

Here is their current business data:

${dataContext}

Instructions:
- Answer questions about their data with specific numbers and context
- Give direct, actionable advice — no fluff or generic platitudes
- Reference exact metrics when relevant
- When spotting issues or opportunities, be specific about what the data shows
- If asked about something not in the data, say so clearly
- Keep responses concise but complete
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
