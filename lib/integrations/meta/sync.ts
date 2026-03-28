import { createServiceClient } from "@/lib/supabase/service";
import { yesterday } from "@/lib/utils/dates";

async function fetchMetaInsights(
  accountId: string,
  accessToken: string,
  date: string
): Promise<Record<string, number>> {
  const fields = "spend,impressions,clicks,reach,actions";
  const url =
    `https://graph.facebook.com/v20.0/${accountId}/insights?` +
      new URLSearchParams({
        fields,
        level: "account",
        time_range: JSON.stringify({ since: date, until: date }),
        access_token: accessToken,
      });

  const res = await fetch(url);
  const json = await res.json();

  // Log the raw response so we can diagnose field issues
  if (json.error) {
    console.error("[meta/sync] API error:", JSON.stringify(json.error));
  } else {
    console.log("[meta/sync] raw row:", JSON.stringify(json.data?.[0] ?? null));
  }

  const row = json.data?.[0] ?? {};

  const conversions: number =
    (row.actions as Array<{ action_type: string; value: string }> | undefined)
      ?.filter((a) => a.action_type === "purchase")
      .reduce((s: number, a) => s + Number(a.value), 0) ?? 0;

  return {
    spend:       parseFloat(row.spend       ?? "0"),
    impressions: parseFloat(row.impressions ?? "0"),
    clicks:      parseFloat(row.clicks      ?? "0"),
    reach:       parseFloat(row.reach       ?? "0"),
    conversions,
  };
}

export async function syncMetaData(userId: string): Promise<void> {
  const db = createServiceClient();

  const { data: integration } = await db
    .from("integrations")
    .select("access_token, account_id, currency")
    .eq("user_id", userId)
    .eq("platform", "meta")
    .single();

  if (!integration || !integration.account_id) return;

  const date     = yesterday();
  const currency = (integration.currency as string | null) ?? "USD";
  const raw      = await fetchMetaInsights(
    integration.account_id,
    integration.access_token,
    date
  );

  // Store currency alongside the metrics so the UI can display it correctly
  const data = { ...raw, currency };

  await db.from("daily_snapshots").upsert(
    { user_id: userId, provider: "meta", date, data },
    { onConflict: "user_id,provider,date" }
  );
}
