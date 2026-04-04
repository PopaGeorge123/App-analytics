import { createServiceClient } from "@/lib/supabase/service";

/**
 * Sync one day of Lemon Squeezy orders for a given user.
 * Stores daily aggregate in daily_snapshots AND individual customer records
 * in the customers table (email, name, LTV) so the Customers tab shows real data.
 *
 * Multiple revenue providers are handled automatically: each provider stores rows
 * under its own provider name via the (user_id, provider, provider_id) unique key.
 */
export async function syncLemonSqueezyDay(
  userId:  string,
  apiKey:  string,
  storeId: string,
  date:    string,
): Promise<{ revenue: number; txCount: number; fees: number; netRevenue: number }> {
  const supabase = createServiceClient();
  const headers  = { Authorization: `Bearer ${apiKey}`, Accept: "application/vnd.api+json" };

  const from = `${date}T00:00:00.000Z`;
  const to   = `${date}T23:59:59.999Z`;

  let revenue = 0;
  let fees    = 0;
  let txCount = 0;
  let page    = 1;

  // Map LS customer_id → aggregated data
  const customerMap = new Map<string, {
    provider_id: string;
    email:       string | null;
    name:        string | null;
    total_spent: number;  // cents
    order_count: number;
    first_seen:  string;
    last_seen:   string;
  }>();

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
      const total      = (attrs.total         as number) ?? 0;
      const totalUsd   = (attrs.total_usd     as number) ?? total;
      const taxAmount  = (attrs.tax           as number) ?? 0;
      if (totalUsd > 0) {
        revenue  += totalUsd / 100;
        const fee = Math.round(totalUsd * 0.05 + 50) / 100;
        fees     += fee;
        txCount  += 1;
      }
      void taxAmount;

      // Customer identity — LS embeds these on every order
      const customerId = String(
        (attrs.customer_id as number | undefined) ??
        (attrs.user_email  as string | undefined) ??
        ""
      );
      if (!customerId) continue;

      const email    = (attrs.user_email as string | undefined) ?? null;
      const name     = (attrs.user_name  as string | undefined) ?? null;
      const createdAt = (attrs.created_at as string | undefined) ?? date;
      const orderDate = createdAt.slice(0, 10);
      const spent     = totalUsd; // cents

      const existing = customerMap.get(customerId);
      if (existing) {
        existing.total_spent += spent;
        existing.order_count += 1;
        if (orderDate > existing.last_seen) existing.last_seen = orderDate;
      } else {
        customerMap.set(customerId, {
          provider_id: customerId,
          email,
          name,
          total_spent: spent,
          order_count: 1,
          first_seen: orderDate,
          last_seen:  orderDate,
        });
      }
    }

    const lastPage = body.meta?.page?.lastPage as number ?? 1;
    if (page >= lastPage) break;
    page++;
  }

  const netRevenue = revenue - fees;

  // ── Upsert individual customer records ────────────────────────────────────
  for (const rec of customerMap.values()) {
    try {
      await supabase.from("customers").upsert(
        {
          user_id:     userId,
          provider:    "lemon-squeezy",
          provider_id: rec.provider_id,
          email:       rec.email,
          name:        rec.name,
          total_spent: rec.total_spent,
          order_count: rec.order_count,
          first_seen:  rec.first_seen,
          last_seen:   rec.last_seen,
          subscribed:  false,
          churned:     false,
        },
        { onConflict: "user_id,provider,provider_id" }
      );
    } catch { /* non-fatal */ }
  }

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
