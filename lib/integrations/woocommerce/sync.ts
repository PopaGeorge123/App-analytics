import { createServiceClient } from "@/lib/supabase/service";

/**
 * WooCommerce REST API v3
 * GET /wp-json/wc/v3/orders — filter by date_created for a given day
 *
 * Metrics stored in daily_snapshots: revenue, orders, refunds, newCustomers
 * Customer identities stored in customers table: email, name, LTV
 * access_token stored as "consumerKey:consumerSecret", account_id = siteUrl
 */

interface WooOrder {
  id: number;
  total: string;
  status: string;
  date_created?: string;
  customer_id?: number;
  billing?: { email?: string; first_name?: string; last_name?: string };
}

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

  // Map from provider_id → aggregated customer data (handles repeat orders same day)
  const customerMap = new Map<string, {
    provider_id: string;
    email:       string | null;
    name:        string | null;
    total_spent: number;   // cents
    order_count: number;
    first_seen:  string;
    last_seen:   string;
  }>();

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
      const data: WooOrder[] = await res.json();
      if (!data.length) break;

      for (const order of data) {
        const orderTotal = parseFloat(order.total ?? "0");

        if (["completed", "processing"].includes(order.status)) {
          revenue += orderTotal;
          orders  += 1;
        }
        if (order.status === "refunded") refunds += 1;

        // Build a stable provider_id — prefer numeric customer_id, fall back to email
        const rawId = order.customer_id && order.customer_id > 0
          ? String(order.customer_id)
          : (order.billing?.email ?? null);
        if (!rawId) continue;

        const providerId = `woo_${rawId}`;
        const email = order.billing?.email ?? null;
        const firstName = order.billing?.first_name ?? "";
        const lastName  = order.billing?.last_name  ?? "";
        const name = [firstName, lastName].filter(Boolean).join(" ") || null;
        const orderDate = (order.date_created ?? date).slice(0, 10);
        const spent = Math.round(orderTotal * 100); // store cents

        const existing = customerMap.get(providerId);
        if (existing) {
          existing.total_spent += spent;
          existing.order_count += 1;
          if (orderDate < existing.first_seen) existing.first_seen = orderDate;
          if (orderDate > existing.last_seen)  existing.last_seen  = orderDate;
        } else {
          customerMap.set(providerId, {
            provider_id: providerId,
            email,
            name,
            total_spent: spent,
            order_count: 1,
            first_seen: orderDate,
            last_seen:  orderDate,
          });
        }
      }

      const totalPages = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);
      if (page >= totalPages) break;
      page++;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();

  // ── Upsert individual customer records ────────────────────────────────────
  // Multiple revenue sources are handled automatically via the unique constraint
  // (user_id, provider, provider_id). Each provider stores its own rows.
  for (const rec of customerMap.values()) {
    try {
      await supabase.from("customers").upsert(
        {
          user_id:     userId,
          provider:    "woocommerce",
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
    } catch { /* non-fatal — aggregate still saved */ }
  }

  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "woocommerce",
      date,
      data: {
        revenue:      parseFloat(revenue.toFixed(2)),
        orders,
        refunds,
        newCustomers: customerMap.size,
      },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, orders, refunds, newCustomers: customerMap.size };
}
