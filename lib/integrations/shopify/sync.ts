import { createServiceClient } from "@/lib/supabase/service";

/**
 * Shopify Admin REST API 2024-01
 * GET /admin/api/2024-01/orders.json — filter by created_at_min/max, status=any
 * GET /admin/api/2024-01/orders/count.json — for total count
 *
 * Metrics stored: revenue (in store currency), orders, refunds, newCustomers
 */
export async function syncShopifyDay(
  userId: string,
  storeDomain: string,
  accessToken: string,
  date: string,
): Promise<{ revenue: number; orders: number; refunds: number; newCustomers: number }> {
  const domain  = storeDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const base    = `https://${domain}/admin/api/2024-01`;
  const headers = {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type":           "application/json",
  };

  const createdAtMin = `${date}T00:00:00+00:00`;
  const createdAtMax = `${date}T23:59:59+00:00`;

  let revenue     = 0;
  let orders      = 0;
  let refunds     = 0;
  const newCustomerIds = new Set<string>();

  // ── Fetch all orders for the day (paginate with limit=250) ────────────
  try {
    let url: string | null = `${base}/orders.json?${new URLSearchParams({
      status:          "any",
      created_at_min:  createdAtMin,
      created_at_max:  createdAtMax,
      limit:           "250",
      fields:          "id,total_price,financial_status,customer,refunds",
    })}`;

    while (url) {
      const pageRes: Response = await fetch(url, { headers });
      if (!pageRes.ok) break;
      const body = await pageRes.json();

      for (const order of body?.orders ?? []) {
        if (order.financial_status === "paid" || order.financial_status === "partially_paid") {
          revenue += parseFloat(order.total_price ?? "0");
          orders  += 1;
        }
        if (order.financial_status === "refunded" || order.financial_status === "partially_refunded") {
          refunds += 1;
        }
        const customerId: string | undefined = order.customer?.id;
        if (customerId) newCustomerIds.add(String(customerId));
      }

      // Check Link header for pagination
      const link: string = pageRes.headers.get("Link") ?? "";
      const nextMatch: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "shopify",
      date,
      data: { revenue: parseFloat(revenue.toFixed(2)), orders, refunds, newCustomers: newCustomerIds.size },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, orders, refunds, newCustomers: newCustomerIds.size };
}
