import { createServiceClient } from "@/lib/supabase/service";

/**
 * WooCommerce REST API v3
 * GET /wp-json/wc/v3/orders — filter by date_created for a given day
 * GET /wp-json/wc/v3/reports/totals — overall store totals
 *
 * Metrics stored: revenue, orders, refunds, newCustomers
 * access_token stored as "consumerKey:consumerSecret", account_id = siteUrl
 */
export async function syncWooCommerceDay(
  userId: string,
  credentials: string, // "consumerKey:consumerSecret"
  siteUrl: string,
  date: string,
): Promise<{ revenue: number; orders: number; refunds: number; newCustomers: number }> {
  const base = siteUrl.replace(/\/$/, "");
  const auth = Buffer.from(credentials).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };

  const after  = `${date}T00:00:00`;
  const before = `${date}T23:59:59`;

  let revenue     = 0;
  let orders      = 0;
  let refunds     = 0;
  const customerIds = new Set<string>();

  // ── Fetch orders for the day ───────────────────────────────────────────
  try {
    let page = 1;
    while (true) {
      const params = new URLSearchParams({
        after,
        before,
        per_page: "100",
        page:     String(page),
        status:   "any",
      });
      const res = await fetch(`${base}/wp-json/wc/v3/orders?${params}`, { headers });
      if (!res.ok) break;
      const data: Array<{
        total: string;
        status: string;
        customer_id?: number;
        billing?: { email?: string };
      }> = await res.json();
      if (!data.length) break;

      for (const order of data) {
        if (["completed", "processing"].includes(order.status)) {
          revenue += parseFloat(order.total ?? "0");
          orders  += 1;
        }
        if (order.status === "refunded") refunds += 1;
        const cid = order.customer_id ?? order.billing?.email;
        if (cid) customerIds.add(String(cid));
      }

      const totalPages = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);
      if (page >= totalPages) break;
      page++;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "woocommerce",
      date,
      data: { revenue: parseFloat(revenue.toFixed(2)), orders, refunds, newCustomers: customerIds.size },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, orders, refunds, newCustomers: customerIds.size };
}
