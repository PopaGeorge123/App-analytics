import { createServiceClient } from "@/lib/supabase/service";

/**
 * Fetch Paddle transactions for a single day (YYYY-MM-DD) and upsert to daily_snapshots.
 * Uses Paddle Billing API (v1).
 *
 * Customer identities (email, name) are stored in the customers table so the
 * Customers tab can display real data. Multiple revenue providers are handled via the
 * unique constraint (user_id, provider, provider_id).
 */
export async function syncPaddleDay(
  userId:   string,
  apiKey:   string,
  date:     string,
): Promise<{ revenue: number; txCount: number; fees: number; netRevenue: number }> {
  const supabase = createServiceClient();

  // Build date range: full UTC day
  const from = `${date}T00:00:00Z`;
  const to   = `${date}T23:59:59Z`;

  const headers = {
    Authorization:  `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  let revenue  = 0;
  let fees     = 0;
  let txCount  = 0;
  let after: string | null = null;

  // Map customer_id → aggregated data
  const customerMap = new Map<string, {
    provider_id: string;
    email:       string | null;
    name:        string | null;
    total_spent: number;  // cents
    order_count: number;
    first_seen:  string;
    last_seen:   string;
    subscribed:  boolean;
  }>();

  // Paginate through all transactions for the day
  while (true) {
    const params = new URLSearchParams({
      "billed_at[gte]": from,
      "billed_at[lte]": to,
      status:           "completed",
      per_page:         "200",
      include:          "customer",   // ask Paddle to embed customer object
    });
    if (after) params.set("after", after);

    const res = await fetch(`https://api.paddle.com/transactions?${params}`, { headers });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`Paddle transactions: ${e?.error?.detail ?? res.status}`);
    }

    const body = await res.json();
    const items: Array<Record<string, unknown>> = (body.data as Array<Record<string, unknown>>) ?? [];

    for (const tx of items) {
      const details = (tx.details as Record<string, unknown>) ?? {};
      const totals  = (details.totals as Record<string, string>) ?? {};

      const grandTotal = parseInt(totals.grand_total ?? "0", 10);
      const earnings   = parseInt(totals.earnings   ?? "0", 10);
      const feeAmount  = grandTotal - earnings;

      if (grandTotal > 0) {
        revenue  += grandTotal / 100;
        fees     += feeAmount  / 100;
        txCount  += 1;
      }

      // Extract customer from embedded object or fallback to customer_id field
      const customerId = (tx.customer_id as string | undefined) ?? null;
      if (!customerId) continue;

      const customerObj = (tx.customer as Record<string, unknown> | undefined) ?? {};
      const email = (customerObj.email as string | undefined) ?? null;
      const name  = (customerObj.name  as string | undefined) ?? null;
      const billedAt = (tx.billed_at  as string | undefined) ?? date;
      const billedDate = billedAt.slice(0, 10);
      // subscription_id present → subscribed
      const subscriptionId = (tx.subscription_id as string | undefined) ?? null;

      const existing = customerMap.get(customerId);
      if (existing) {
        existing.total_spent += grandTotal;
        existing.order_count += 1;
        if (billedDate > existing.last_seen) existing.last_seen = billedDate;
        if (subscriptionId) existing.subscribed = true;
      } else {
        customerMap.set(customerId, {
          provider_id: customerId,
          email,
          name,
          total_spent: grandTotal,
          order_count: 1,
          first_seen: billedDate,
          last_seen:  billedDate,
          subscribed: !!subscriptionId,
        });
      }
    }

    const meta     = body.meta as Record<string, unknown>;
    const nextPage = (meta?.pagination as Record<string, unknown>)?.next as string | undefined;
    if (!nextPage) break;

    try {
      after = new URL(nextPage).searchParams.get("after");
      if (!after) break;
    } catch {
      break;
    }
  }

  const netRevenue = revenue - fees;

  // ── Upsert individual customer records ────────────────────────────────────
  for (const rec of customerMap.values()) {
    try {
      await supabase.from("customers").upsert(
        {
          user_id:     userId,
          provider:    "paddle",
          provider_id: rec.provider_id,
          email:       rec.email,
          name:        rec.name,
          total_spent: rec.total_spent,
          order_count: rec.order_count,
          first_seen:  rec.first_seen,
          last_seen:   rec.last_seen,
          subscribed:  rec.subscribed,
          churned:     false,
        },
        { onConflict: "user_id,provider,provider_id" }
      );
    } catch { /* non-fatal */ }
  }

  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "paddle",
      date,
      data:     { revenue, fees, netRevenue, txCount },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, fees, netRevenue, txCount };
}
