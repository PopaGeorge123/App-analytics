import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncStripeData } from "@/lib/integrations/stripe/sync";
import { syncGA4Data } from "@/lib/integrations/ga4/sync";
import { syncMetaData } from "@/lib/integrations/meta/sync";

// Verifies the request came from the internal cron server
function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  // Fetch all users who have at least one integration
  const { data: integrations } = await db
    .from("integrations")
    .select("user_id, platform");

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ ok: true, results: {} });
  }

  const userIds = [...new Set(integrations.map((i) => i.user_id))];

  const results: Record<string, { stripe?: string; ga4?: string; meta?: string }> = {};

  await Promise.allSettled(
    userIds.map(async (userId) => {
      results[userId] = {};
      const platforms = integrations
        .filter((i) => i.user_id === userId)
        .map((i) => i.platform);

      await Promise.allSettled([
        platforms.includes("stripe")
          ? syncStripeData(userId)
              .then(() => { results[userId].stripe = "ok"; })
              .catch((e: Error) => { results[userId].stripe = e.message; })
          : Promise.resolve(),

        platforms.includes("ga4")
          ? syncGA4Data(userId)
              .then(() => { results[userId].ga4 = "ok"; })
              .catch((e: Error) => { results[userId].ga4 = e.message; })
          : Promise.resolve(),

        platforms.includes("meta")
          ? syncMetaData(userId)
              .then(() => { results[userId].meta = "ok"; })
              .catch((e: Error) => { results[userId].meta = e.message; })
          : Promise.resolve(),
      ]);
    })
  );

  console.log("[cron/sync] Completed:", JSON.stringify(results));
  return NextResponse.json({ ok: true, results });
}
