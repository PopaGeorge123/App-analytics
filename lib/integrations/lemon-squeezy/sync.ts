import { createServiceClient } from "@/lib/supabase/service";

export async function syncLemonSqueezyDay(
  userId:  string,
  apiKey:  string,
  storeId: string,
  date:    string,
): Promise<{ revenue: number; txCount: number; fees: number; netRevenue: number }> {
  const supabase = createServiceClient();
  const headers  = { Authorization: `Bearer ${apiKey}`, Accept: "application/vnd.api+json" };

  // Lemon Squeezy orders API — filter by created_at date range and status=paid
  const from = `${date}T00:00:00.000Z`;
  const to   = `${date}T23:59:59.999Z`;

  let revenue = 0;
  let fees    = 0;
  let txCount = 0;
  let page    = 1;

  while (true) {
    const params = new URLSearchParams({
      "filter[store_id]":       storeId,
      "filter[status]":         "paid",
      "filter[created_at_gte]": from,
      "filter[created_at_lte]": to,
      "page[size]":             "100",
      "page[number]":           String(page),
    });

    const res = await fetch(`https://api.lemonsqueezy.com/v1/orders?${params}`, { headers });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`Lemon Squeezy orders: ${e?.errors?.[0]?.detail ?? res.status}`);
    }

    const body  = await res.json();
    const items = (body.data as Array<Record<string, unknown>>) ?? [];

    for (const order of items) {
      const attrs = (order.attributes as Record<string, unknown>) ?? {};
      // Amounts in cents
      const total      = (attrs.total         as number) ?? 0;
      const totalUsd   = (attrs.total_usd     as number) ?? total;
      const taxAmount  = (attrs.tax           as number) ?? 0;
      if (totalUsd > 0) {
        revenue  += totalUsd / 100;
        // Lemon Squeezy doesn't expose fee separately in order attrs — approximate 5% + $0.50
        const fee = Math.round(totalUsd * 0.05 + 50) / 100;
        fees     += fee;
        txCount  += 1;
      }
      void taxAmount;
    }

    const lastPage = body.meta?.page?.lastPage as number ?? 1;
    if (page >= lastPage) break;
    page++;
  }

  const netRevenue = revenue - fees;

  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "lemon-squeezy",
      date,
      data:     { revenue, fees, netRevenue, txCount },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, fees, netRevenue, txCount };
}
