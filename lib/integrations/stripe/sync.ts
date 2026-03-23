import { createServiceClient } from "@/lib/supabase/service";
import Stripe from "stripe";
import { yesterday } from "@/lib/utils/dates";

// Creates a Stripe client using the connected account's access token
function getConnectedStripe(accessToken: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(accessToken, { apiVersion: "2026-02-25.clover" as any });
}

export async function syncStripeData(userId: string): Promise<void> {
  const db = createServiceClient();

  const { data: integration } = await db
    .from("integrations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("platform", "stripe")
    .single();

  if (!integration) return;

  const client = getConnectedStripe(integration.access_token);
  const date = yesterday();

  // Exact 24h window for yesterday
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);
  const gte = Math.floor(dayStart.getTime() / 1000);
  const lte = Math.floor(dayEnd.getTime() / 1000);

  // Fetch all payment intents for yesterday (auto-paginate)
  // Using paymentIntents (not charges) to match Stripe Dashboard view
  const intents: Stripe.PaymentIntent[] = [];
  for await (const pi of client.paymentIntents.list({
    created: { gte, lte },
    limit: 100,
  })) {
    intents.push(pi);
  }

  const succeeded = intents.filter((pi) => pi.status === "succeeded");

  const revenue = succeeded.reduce((sum, pi) => sum + pi.amount_received, 0);

  const refunds = 0; // refunds tracked separately; PaymentIntents don't expose amount_refunded directly

  const txCount = succeeded.length;

  const newCustomers = new Set(
    succeeded.filter((pi) => pi.customer).map((pi) => String(pi.customer))
  ).size;

  await db.from("daily_snapshots").upsert(
    {
      user_id: userId,
      provider: "stripe",
      date,
      data: { revenue, refunds, newCustomers, txCount },
    },
    { onConflict: "user_id,provider,date" }
  );
}

