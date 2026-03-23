import Anthropic from "@anthropic-ai/sdk";
import { buildContext } from "./build-context";
import { buildSystemPrompt, buildUserPrompt } from "./build-prompt";
import { createServiceClient } from "@/lib/supabase/service";
import { today } from "@/lib/utils/dates";
import type { Digest } from "@/lib/supabase/database.types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateDigest(userId: string): Promise<Digest> {
  const db = createServiceClient();
  const date = today();

  // 1. Idempotency — skip if today's digest already exists
  const { data: existing } = await db
    .from("digests")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (existing) return existing as Digest;

  // 2. Build context from DB (no external API calls)
  const context = await buildContext(userId);

  // 3. Call Claude
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildUserPrompt(context) }],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text : "";

  let digest;
  try {
    digest = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    console.error("Failed to parse Claude response:", raw);
    throw new Error("Digest generation failed — invalid JSON from Claude");
  }

  // 4. Persist to DB
  const { data: saved, error } = await db
    .from("digests")
    .insert({
      user_id: userId,
      date,
      summary: digest.summary ?? "",
      highlights: digest.highlights ?? [],
      anomalies: digest.anomalies ?? [],
      cross_insight: digest.crossPlatformInsight ?? "",
      action: digest.action ?? {},
      raw_context: context as object,
    })
    .select("*")
    .single();

  if (error || !saved) {
    throw new Error(error?.message ?? "Failed to save digest");
  }

  return saved as Digest;
}
