import { createServiceClient } from "@/lib/supabase/service";

/**
 * Fetch Paddle transactions for a single day (YYYY-MM-DD) and upsert to daily_snapshots.
 * Uses Paddle Billing API (v1).
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

  // Paginate through all transactions for the day
  while (true) {
    const params = new URLSearchParams({
      "billed_at[gte]": from,
      "billed_at[lte]": to,
      status:           "completed",
      per_page:         "200",
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

      // Paddle amounts are strings (e.g. "1000" = $10.00 in the currency's minor unit)
      // grand_total includes tax; earnings = after Paddle fees
      const grandTotal = parseInt(totals.grand_total ?? "0", 10);
      const earnings   = parseInt(totals.earnings   ?? "0", 10);
      const feeAmount  = grandTotal - earnings;

      if (grandTotal > 0) {
        revenue  += grandTotal / 100;   // convert cents → dollars
        fees     += feeAmount  / 100;
        txCount  += 1;
      }
    }

    const meta     = body.meta as Record<string, unknown>;
    const nextPage = (meta?.pagination as Record<string, unknown>)?.next as string | undefined;
    if (!nextPage) break;

    // Extract `after` cursor from the next URL
    try {
      after = new URL(nextPage).searchParams.get("after");
      if (!after) break;
    } catch {
      break;
    }
  }

  const netRevenue = revenue - fees;

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
