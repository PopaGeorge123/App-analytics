import { createServiceClient } from "@/lib/supabase/service";

const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;

/** Refresh a PayPal access token using stored refresh_token */
async function refreshPayPalToken(refreshToken: string): Promise<string> {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`PayPal token refresh: ${e?.error_description ?? e?.error ?? res.status}`);
  }
  return (await res.json()).access_token as string;
}

/**
 * Fetch PayPal transactions for a single date (YYYY-MM-DD) and upsert to
 * daily_snapshots.  Returns summary metrics.
 */
export async function syncPayPalDay(
  userId:       string,
  accessToken:  string,
  refreshToken: string | null,
  date:         string,
): Promise<{ revenue: number; txCount: number; fees: number; netRevenue: number }> {
  const supabase = createServiceClient();

  // PayPal Reporting API needs ISO 8601 with time zone
  const startDate = `${date}T00:00:00-0000`;
  const endDate   = `${date}T23:59:59-0000`;

  let token = accessToken;

  const params = new URLSearchParams({
    start_date:    startDate,
    end_date:      endDate,
    fields:        "all",
    page_size:     "500",
  });

  let res = await fetch(`https://api-m.paypal.com/v1/reporting/transactions?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Try to refresh token once on 401
  if (res.status === 401 && refreshToken) {
    token = await refreshPayPalToken(refreshToken);
    // Persist fresh token
    await supabase
      .from("integrations")
      .update({ access_token: token })
      .eq("user_id", userId)
      .eq("platform", "paypal");

    res = await fetch(`https://api-m.paypal.com/v1/reporting/transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`PayPal transactions: ${e?.message ?? res.status}`);
  }

  const body = await res.json();
  const transactions: Array<Record<string, unknown>> = (body.transaction_details as Array<Record<string, unknown>>) ?? [];

  // Sum completed payments (T0006 = express checkout, T0013 = order, T0114 = recurring)
  // Filter out refunds (negative amounts) separately for tracking
  let revenue    = 0;
  let fees       = 0;
  let txCount    = 0;

  for (const tx of transactions) {
    const info = (tx.transaction_info as Record<string, unknown>) ?? {};
    const status = info.transaction_status as string;

    // S = success, P = pending, V = reversed/refunded — only count success
    if (status !== "S") continue;

    const amount    = parseFloat((info.transaction_amount as Record<string, string>)?.value ?? "0");
    const feeAmount = parseFloat((info.fee_amount         as Record<string, string>)?.value ?? "0");

    if (amount > 0) {
      revenue  += amount;
      fees     += Math.abs(feeAmount);
      txCount  += 1;
    }
  }

  const netRevenue = revenue - fees;

  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "paypal",
      date,
      data:     { revenue, fees, netRevenue, txCount },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { revenue, fees, netRevenue, txCount };
}
