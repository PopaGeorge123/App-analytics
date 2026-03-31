import { createServiceClient } from "@/lib/supabase/service";

/**
 * ActiveCampaign Reports API v3
 * GET /api/3/campaigns — filter by sdate for campaigns sent on a given date
 * GET /api/3/contacts — filter by cdate for subscribers added on a given date
 *
 * Metrics stored: emailsSent, opens, clicks, unsubscribes, newContacts
 */
export async function syncActiveCampaignDay(
  userId: string,
  apiUrl: string,
  apiKey: string,
  date: string,
): Promise<{ emailsSent: number; opens: number; clicks: number; unsubscribes: number; newContacts: number }> {
  const base = apiUrl.replace(/\/$/, "");
  const headers = { "Api-Token": apiKey, "Content-Type": "application/json" };

  const dateStart = `${date} 00:00:00`;
  const dateEnd   = `${date} 23:59:59`;

  let emailsSent   = 0;
  let opens        = 0;
  let clicks       = 0;
  let unsubscribes = 0;

  // ── Campaigns sent on this day ─────────────────────────────────────────
  try {
    const params = new URLSearchParams({
      "filters[sdate_since]":  dateStart,
      "filters[sdate_before]": dateEnd,
      limit: "200",
    });
    const res = await fetch(`${base}/api/3/campaigns?${params}`, { headers });
    if (res.ok) {
      const body = await res.json();
      for (const c of body?.campaigns ?? []) {
        emailsSent   += parseInt(c.send_amt    ?? "0", 10);
        opens        += parseInt(c.uniqueopens ?? "0", 10);
        clicks        += parseInt(c.uniquelinkclicks ?? "0", 10);
        unsubscribes += parseInt(c.unsubscribes ?? "0", 10);
      }
    }
  } catch { /* optional */ }

  // ── New contacts created on this day ──────────────────────────────────
  let newContacts = 0;
  try {
    const params = new URLSearchParams({
      "filters[created_after]":  `${date}T00:00:00-00:00`,
      "filters[created_before]": `${date}T23:59:59-00:00`,
      limit: "1",
    });
    const res = await fetch(`${base}/api/3/contacts?${params}`, { headers });
    if (res.ok) {
      const body = await res.json();
      newContacts = body?.meta?.total ?? 0;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "activecampaign",
      date,
      data: { emailsSent, opens, clicks, unsubscribes, newContacts },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { emailsSent, opens, clicks, unsubscribes, newContacts };
}
