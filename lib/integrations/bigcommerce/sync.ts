import { createServiceClient } from "@/lib/supabase/service";

/**
 * BigCommerce Orders API v2
 * GET /stores/{hash}/v2/orders — filter by min_date_created/max_date_created
 *
 * Metrics stored: revenue, orders, refunds, newCustomers
 */
export async function syncBigCommerceDay(
  userId: string,
  storeHash: string,
  accessToken: string,
  date: string,
): Promise<{ revenue: number; orders: number; refunds: number; newCustomers: number }> {
  const base    = `https://api.bigcommerce.com/stores/${storeHash}/v2`;
  const headers = {
    "X-Auth-Token": accessToken,
    Accept:         "application/json",
  };

  // BigCommerce date filter uses RFC 2822 or ISO format
  const minDate = `${date}T00:00:00+00:00`;
  const maxDate = `${date}T23:59:59+00:00`;

  let revenue     = 0;
  let orders      = 0;
  let refunds     = 0;
  const customerIds = new Set<number>();

  try {
    let page = 1;
    while (true) {
      const params = new URLSearchParams({
        min_date_created: minDate,
        max_date_created: maxDate,
        limit:            "250",
        page:             String(page),
      });
      const res = await fetch(`${base}/orders?${params}`, { headers });
      if (res.status === 204) break; // No content
      if (!res.ok) break;
      const data: Array<{
        total_inc_tax: string;
        status: string;
        customer_id: number;
      }> = await res.json();
      if (!data.length) break;

      for (const order of data) {
        if (["Completed", "Shipped", "Partially Shipped"].includes(order.status)) {
          revenue += parseFloat(order.total_inc_tax ?? "0");
          orders  += 1;
        }
        if (order.status === "Refunded") refunds += 1;
        if (order.customer_id) customerIds.add(order.customer_id);
      }

      if (data.length < 250) break;
      page++;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "bigcommerce",
      date,
      data: { revenue: parseFloat(revenue.toFixed(2)), orders, refunds, newCustomers: customerIds.size },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, orders, refunds, newCustomers: customerIds.size };
}
