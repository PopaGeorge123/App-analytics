import { createServiceClient } from "@/lib/supabase/service";

/**
 * Gumroad Sales API — fetches all sales for a given date.
 * GET https://api.gumroad.com/v2/sales?after=YYYY-MM-DD&before=YYYY-MM-DD
 * Amounts are in cents (USD). Page size: up to 10 per call.
 */
export async function syncGumroadDay(
  userId: string,
  apiKey: string,
  date: string,
): Promise<{ revenue: number; fees: number; netRevenue: number; txCount: number }> {
  // Gumroad's API uses after/before as exclusive bounds — we add ±1 day
  const after  = new Date(date);
  after.setDate(after.getDate() - 1);
  const before = new Date(date);
  before.setDate(before.getDate() + 1);

  const afterStr  = after.toISOString().split("T")[0];
  const beforeStr = before.toISOString().split("T")[0];

  let revenue = 0, fees = 0, txCount = 0;
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      after:  afterStr,
      before: beforeStr,
      page:   String(page),
    });

    const res = await fetch(`https://api.gumroad.com/v2/sales?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`Gumroad sales: ${e?.message ?? res.status}`);
    }

    const body  = await res.json();
    const sales = body.sales ?? [];

    for (const sale of sales) {
      // sale.created_at is ISO string — filter to exact date
      const saleDate = (sale.created_at ?? "").split("T")[0];
      if (saleDate !== date) continue;

      const price  = typeof sale.price === "number" ? sale.price : 0;         // cents
      const gFee   = typeof sale.gumroad_fee === "number" ? sale.gumroad_fee : 0; // cents
      revenue  += price / 100;
      fees     += gFee  / 100;
      txCount  += 1;
    }

    const hasMore = body.next_page_url != null;
    if (!hasMore || sales.length === 0) break;
    page++;
  }

  const netRevenue = revenue - fees;

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, provider: "gumroad", date, data: { revenue, fees, netRevenue, txCount } },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, fees, netRevenue, txCount };
}
