import { createServiceClient } from "@/lib/supabase/service";

/**
 * HubSpot CRM API v3
 * GET /crm/v3/objects/deals — filter by closedate for deals closed on a given day
 * GET /crm/v3/objects/contacts — filter by createdate for new contacts today
 *
 * Metrics stored: dealsWon, pipelineValue, newContacts, closedRevenue
 */
export async function syncHubSpotDay(
  userId: string,
  accessToken: string,
  date: string,
): Promise<{ dealsWon: number; pipelineValue: number; newContacts: number; closedRevenue: number }> {
  const headers = {
    Authorization:  `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;

  let dealsWon      = 0;
  let pipelineValue = 0;
  let closedRevenue = 0;
  let newContacts   = 0;

  // ── Deals closed (won) today ──────────────────────────────────────────
  try {
    const searchBody = {
      filterGroups: [{
        filters: [
          { propertyName: "dealstage",  operator: "EQ",           value: "closedwon" },
          { propertyName: "closedate",  operator: "GTE",          value: dayStart },
          { propertyName: "closedate",  operator: "LTE",          value: dayEnd },
        ],
      }],
      properties: ["dealname", "amount", "dealstage", "closedate"],
      limit: 200,
    };

    const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
      method: "POST",
      headers,
      body: JSON.stringify(searchBody),
    });
    if (res.ok) {
      const body = await res.json();
      for (const deal of body?.results ?? []) {
        dealsWon      += 1;
        closedRevenue += parseFloat(deal.properties?.amount ?? "0");
      }
    }
  } catch { /* optional */ }

  // ── Active pipeline value (all open deals) ────────────────────────────
  try {
    const searchBody = {
      filterGroups: [{
        filters: [
          { propertyName: "dealstage", operator: "NEQ", value: "closedlost" },
          { propertyName: "dealstage", operator: "NEQ", value: "closedwon"  },
        ],
      }],
      properties: ["amount"],
      limit: 200,
    };
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
      method: "POST",
      headers,
      body: JSON.stringify(searchBody),
    });
    if (res.ok) {
      const body = await res.json();
      for (const deal of body?.results ?? []) {
        pipelineValue += parseFloat(deal.properties?.amount ?? "0");
      }
    }
  } catch { /* optional */ }

  // ── New contacts created today ────────────────────────────────────────
  try {
    const searchBody = {
      filterGroups: [{
        filters: [
          { propertyName: "createdate", operator: "GTE", value: dayStart },
          { propertyName: "createdate", operator: "LTE", value: dayEnd  },
        ],
      }],
      properties: ["createdate"],
      limit: 1,
    };
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers,
      body: JSON.stringify(searchBody),
    });
    if (res.ok) {
      const body = await res.json();
      newContacts = body?.total ?? 0;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "hubspot",
      date,
      data: {
        dealsWon,
        pipelineValue: parseFloat(pipelineValue.toFixed(2)),
        newContacts,
        closedRevenue: parseFloat(closedRevenue.toFixed(2)),
      },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { dealsWon, pipelineValue, newContacts, closedRevenue };
}

/**
 * Top-level sync called by cron jobs.
 * Fetches the access token from DB, then syncs yesterday's data.
 */
export async function syncHubSpotData(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: integration } = await supabase
    .from("integrations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("platform", "hubspot")
    .single();

  if (!integration?.access_token) throw new Error("HubSpot integration not found");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = yesterday.toISOString().slice(0, 10);

  await syncHubSpotDay(userId, integration.access_token, date);
}
