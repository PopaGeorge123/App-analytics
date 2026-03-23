import { createServiceClient } from "@/lib/supabase/service";
import Stripe from "stripe";
import { daysAgo } from "@/lib/utils/dates";

function getStripeClient(accessToken: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(accessToken, { apiVersion: "2026-02-25.clover" as any });
}

export async function backfillStripeHistory(userId: string): Promise<void> {
  const db = createServiceClient();

  const { data: integration } = await db
    .from("integrations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("platform", "stripe")
    .single();

  if (!integration) return;

  const client = getStripeClient(integration.access_token);

  // Backfill 18 months = ~540 days, one snapshot per day, including today
  const DAYS = 540;

  for (let i = DAYS; i >= 0; i--) {
    const dayStart = daysAgo(i);

    const gte = Math.floor(new Date(`${dayStart}T00:00:00Z`).getTime() / 1000);
    // For today (i=0) use current timestamp, otherwise full day window
    const lte = i === 0
      ? Math.floor(Date.now() / 1000)
      : gte + 86400 - 1;

    // Fetch all payment intents per day (matches Stripe Dashboard view)
    const intents: Stripe.PaymentIntent[] = [];
    for await (const pi of client.paymentIntents.list({
      created: { gte, lte },
      limit: 100,
    })) {
      intents.push(pi);
    }

    const succeeded = intents.filter((pi) => pi.status === "succeeded");

    const revenue = succeeded.reduce((sum, pi) => sum + pi.amount_received, 0);
    const refunds = 0; // tracked separately
    const txCount = succeeded.length;
    const newCustomers = new Set(
      succeeded.filter((pi) => pi.customer).map((pi) => String(pi.customer))
    ).size;

    await db.from("daily_snapshots").upsert(
      {
        user_id: userId,
        provider: "stripe",
        date: dayStart,
        data: { revenue, refunds, newCustomers, txCount },
      },
      { onConflict: "user_id,provider,date" }
    );
  }
}
