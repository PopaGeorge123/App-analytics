import { createServiceClient } from "@/lib/supabase/service";

/**
 * Amazon SP-API — Sales and Traffic Report (GET_SALES_AND_TRAFFIC_REPORT)
 * Uses Reports API v2021-06-30 to request and retrieve a daily summary.
 *
 * access_token = "clientId:clientSecret"
 * refresh_token = LWA refresh token
 * account_id = sellerId
 *
 * Metrics stored: revenue, orders, units, avgOrderValue
 */
export async function syncAmazonSellerDay(
  userId: string,
  credentials: string, // "clientId:clientSecret"
  refreshToken: string,
  sellerId: string,
  date: string,
): Promise<{ revenue: number; orders: number; units: number; avgOrderValue: number }> {
  const [clientId, clientSecret] = credentials.split(":");

  // Step 1 — Exchange refresh token for LWA access token
  let lwaToken = "";
  try {
    const tokenRes = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    });
    if (tokenRes.ok) {
      const tokenBody = await tokenRes.json();
      lwaToken = tokenBody.access_token ?? "";
    }
  } catch { /* skip */ }

  if (!lwaToken) {
    const supabase = createServiceClient();
    await supabase.from("daily_snapshots").upsert(
      { user_id: userId, provider: "amazon-seller", date, data: { revenue: 0, orders: 0, units: 0, avgOrderValue: 0 } },
      { onConflict: "user_id,provider,date" }
    );
    return { revenue: 0, orders: 0, units: 0, avgOrderValue: 0 };
  }

  // SP-API uses us-east-1 endpoint by default (NA marketplace)
  const spBase  = "https://sellingpartnerapi-na.amazon.com";
  const headers = {
    "x-amz-access-token": lwaToken,
    "Content-Type":       "application/json",
  };

  let revenue      = 0;
  let orders       = 0;
  let units        = 0;
  let avgOrderValue = 0;

  // Step 2 — Request the Sales and Traffic report
  try {
    const reportBody = {
      reportType:       "GET_SALES_AND_TRAFFIC_REPORT",
      marketplaceIds:   ["ATVPDKIKX0DER"], // US marketplace
      dataStartTime:    `${date}T00:00:00Z`,
      dataEndTime:      `${date}T23:59:59Z`,
      reportOptions: {
        dateGranularity: "DAY",
        asinGranularity: "PARENT",
      },
    };

    const createRes = await fetch(`${spBase}/reports/2021-06-30/reports`, {
      method: "POST",
      headers,
      body: JSON.stringify(reportBody),
    });

    if (createRes.ok) {
      const createBody = await createRes.json();
      const reportId: string = createBody.reportId ?? "";

      if (reportId) {
        // Poll for completion (max 5 attempts with 3s delay)
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise((r) => setTimeout(r, 3000));
          const statusRes = await fetch(`${spBase}/reports/2021-06-30/reports/${reportId}`, { headers });
          if (!statusRes.ok) break;
          const statusBody = await statusRes.json();

          if (statusBody.processingStatus === "DONE" && statusBody.reportDocumentId) {
            // Fetch the document URL
            const docRes = await fetch(
              `${spBase}/reports/2021-06-30/documents/${statusBody.reportDocumentId}`,
              { headers },
            );
            if (docRes.ok) {
              const docBody  = await docRes.json();
              const docUrl: string = docBody.url ?? "";
              if (docUrl) {
                const dataRes = await fetch(docUrl);
                if (dataRes.ok) {
                  const text = await dataRes.text();
                  // Report is JSON: parse sales summary
                  try {
                    const report = JSON.parse(text);
                    const sales = report?.salesAndTrafficByDate?.[0]?.salesByDate ?? {};
                    revenue      = parseFloat(sales?.orderedProductSales?.amount ?? "0");
                    orders       = sales?.totalOrderItems ?? 0;
                    units        = sales?.unitsOrdered      ?? 0;
                    avgOrderValue = orders > 0 ? parseFloat((revenue / orders).toFixed(2)) : 0;
                  } catch { /* parse error */ }
                }
              }
            }
            break;
          }
          if (statusBody.processingStatus === "FATAL" || statusBody.processingStatus === "CANCELLED") break;
        }
      }
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "amazon-seller",
      date,
      data: { revenue, orders, units, avgOrderValue },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, orders, units, avgOrderValue };
}
