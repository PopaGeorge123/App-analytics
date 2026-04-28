import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// ─── Types returned to the client ───────────────────────────────────────────

export interface AiPlaybookStep {
  action: string;
  detail: string;
  /** Optional external resource that helps the user complete this step */
  link?: { label: string; url: string };
}

export interface AiChartPoint {
  date: string;   // "YYYY-MM-DD"
  value: number;
}

export interface AiPlaybookChart {
  title: string;
  unit: "usd" | "usd_cents" | "percent_decimal" | "number" | "multiplier";
  benchmark?: number;
  benchmarkLabel?: string;
  points: AiChartPoint[];
}

export interface AiPlaybook {
  id: string;
  title: string;
  problem: string;
  impact: string;
  category: string;
  severity: "critical" | "warning" | "opportunity";
  expectedGain: string;
  steps: AiPlaybookStep[];
  /** Specific metric values from the user's real data that triggered this */
  triggeredBy?: { label: string; value: string; benchmark: string }[];
  /** Time-series chart proving the AI's claim — hydrated server-side from snapshots */
  chart?: AiPlaybookChart;
}

export interface AiPlaybooksResponse {
  playbooks: AiPlaybook[];
  healthScore: number;
  healthLabel: string;
  summary: string;
  generatedAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isPremiumUser } = await import("@/lib/supabase/isPremiumUser");
  if (!(await isPremiumUser(user.id))) {
    return NextResponse.json({ error: "Premium required." }, { status: 403 });
  }

  const db = createServiceClient();

  const { data: cached } = await db
    .from("ai_playbooks_cache")
    .select("payload, generated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (cached?.payload) {
    return NextResponse.json(cached.payload as AiPlaybooksResponse);
  }

  // No cache yet — daemon hasn't run for this user
  const empty: AiPlaybooksResponse = {
    playbooks: [],
    healthScore: 0,
    healthLabel: "Needs Work",
    summary:
      "Your playbooks are being generated nightly. Check back tomorrow after your first sync — or connect at least one integration to speed things up.",
    generatedAt: null,
  };
  return NextResponse.json(empty);
}
