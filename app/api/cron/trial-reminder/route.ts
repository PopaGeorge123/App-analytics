import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendTrialEndingEmail } from "@/lib/email";

function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  // Find non-premium users whose trial ends within the next 24 hours
  // and who haven't already been sent a reminder (trial hasn't ended yet).
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: users, error } = await db
    .from("users")
    .select("id, email, trial_ends_at")
    .eq("is_premium", false)
    .gt("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", in24h.toISOString());

  if (error) {
    console.error("[cron/trial-reminder] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Record<string, string> = {};

  await Promise.allSettled(
    (users ?? []).map(async (user) => {
      try {
        // Format the trial end date as a readable string, e.g. "Jan 15"
        const endDate = new Date(user.trial_ends_at!).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        await sendTrialEndingEmail(user.email, endDate);
        results[user.id] = "ok";
      } catch (err) {
        console.error(`[cron/trial-reminder] Error for user ${user.id}:`, err);
        results[user.id] = err instanceof Error ? err.message : "unknown error";
      }
    })
  );

  console.log("[cron/trial-reminder] Completed:", JSON.stringify(results));
  return NextResponse.json({ ok: true, results, count: (users ?? []).length });
}
