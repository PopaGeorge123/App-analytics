import { NextRequest, NextResponse } from "next/server";
import { syncStripeData } from "@/lib/integrations/stripe/sync";
import { syncGA4Data } from "@/lib/integrations/ga4/sync";
import { syncMetaData } from "@/lib/integrations/meta/sync";

// Delay helper — prevents hammering APIs back-to-back
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Delay (ms) between syncing each platform for the same user
const PLATFORM_DELAY_MS: Record<string, number> = {
  stripe: 0,    // first platform — no pre-delay needed
  ga4:    1500, // 1.5s after Stripe
  meta:   1500, // 1.5s after GA4
};

function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * POST /api/cron/sync-user
 * Body: { userId: string, platforms: string[] }
 *
 * Syncs a single user's data one platform at a time with delays between
 * each platform to avoid triggering rate limits.
 *
 * Called by scripts/cron-runner.mjs which itself processes users sequentially.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string; platforms?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, platforms } = body;
  if (!userId || !Array.isArray(platforms)) {
    return NextResponse.json(
      { error: "Missing userId or platforms in body" },
      { status: 400 }
    );
  }

  const results: { stripe?: string; ga4?: string; meta?: string } = {};

  // Process platforms SEQUENTIALLY — one at a time — with delays
  const platformOrder: Array<keyof typeof results> = ["stripe", "ga4", "meta"];

  for (const platform of platformOrder) {
    if (!platforms.includes(platform)) continue;

    // Delay before this platform (skips first one)
    const delay = PLATFORM_DELAY_MS[platform];
    if (delay > 0) await sleep(delay);

    try {
      if (platform === "stripe") {
        await syncStripeData(userId);
        results.stripe = "ok";
      } else if (platform === "ga4") {
        await syncGA4Data(userId);
        results.ga4 = "ok";
      } else if (platform === "meta") {
        await syncMetaData(userId);
        results.meta = "ok";
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results[platform] = msg;
      console.error(`[cron/sync-user] ${platform} error for ${userId}:`, msg);
    }
  }

  console.log(`[cron/sync-user] ${userId.slice(0, 8)}:`, results);
  return NextResponse.json({ ok: true, results: { [userId]: results } });
}
