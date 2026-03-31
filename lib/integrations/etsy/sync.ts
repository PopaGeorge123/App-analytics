import { createServiceClient } from "@/lib/supabase/service";

/**
 * Etsy Open API v3
 * GET /v3/application/shops/{shopId}/receipts — filter by min_created/max_created
 *
 * Metrics stored: revenue, orders, views (shop stats), newCustomers
 *
 * Note: Etsy uses Unix timestamps for date filtering.
 */
export async function syncEtsyDay(
  userId: string,
  apiKey: string,
  shopId: string,
  date: string,
): Promise<{ revenue: number; orders: number; views: number; newCustomers: number }> {
  const base    = "https://openapi.etsy.com/v3/application";
  const headers = { "x-api-key": apiKey };

  const dayStart = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const dayEnd   = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);

  let revenue     = 0;
  let orders      = 0;
  let views       = 0;
  const buyerIds  = new Set<number>();

  // ── Fetch receipts (orders) for the day ───────────────────────────────
  try {
    let offset = 0;
    while (true) {
      const params = new URLSearchParams({
        min_created: String(dayStart),
        max_created: String(dayEnd),
        limit:       "100",
        offset:      String(offset),
        was_paid:    "true",
      });
      const res = await fetch(`${base}/shops/${shopId}/receipts?${params}`, { headers });
      if (!res.ok) break;
      const body = await res.json();
      const results: Array<{
        grandtotal?: { amount: number; divisor: number };
        buyer_user_id?: number;
      }> = body?.results ?? [];
      if (!results.length) break;

      for (const receipt of results) {
        if (receipt.grandtotal) {
          revenue += receipt.grandtotal.amount / receipt.grandtotal.divisor;
        }
        orders += 1;
        if (receipt.buyer_user_id) buyerIds.add(receipt.buyer_user_id);
      }

      if (results.length < 100) break;
      offset += 100;
    }
  } catch { /* optional */ }

  // ── Shop stats (views) for the day ───────────────────────────────────
  try {
    const params = new URLSearchParams({
      min_date: String(dayStart),
      max_date: String(dayEnd),
    });
    const res = await fetch(`${base}/shops/${shopId}/stats?${params}`, { headers });
    if (res.ok) {
      const body = await res.json();
      views = body?.results?.[0]?.visits ?? 0;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "etsy",
      date,
      data: { revenue: parseFloat(revenue.toFixed(2)), orders, views, newCustomers: buyerIds.size },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, orders, views, newCustomers: buyerIds.size };
}
