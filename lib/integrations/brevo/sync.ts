import { createServiceClient } from "@/lib/supabase/service";

/**
 * Brevo (Sendinblue) Statistics API v3
 * GET /v3/emailCampaigns — filter by startDate/endDate
 * GET /v3/contacts/statistics — daily contact stats
 *
 * Metrics stored: emailsSent, opens, clicks, unsubscribes, newContacts
 */
export async function syncBrevoDay(
  userId: string,
  apiKey: string,
  date: string,
): Promise<{ emailsSent: number; opens: number; clicks: number; unsubscribes: number; newContacts: number }> {
  const headers = {
    "api-key": apiKey,
    Accept:    "application/json",
  };

  let emailsSent   = 0;
  let opens        = 0;
  let clicks       = 0;
  let unsubscribes = 0;

  // ── Email campaign stats sent on this day ─────────────────────────────
  try {
    const params = new URLSearchParams({
      startDate:         date,
      endDate:           date,
      status:            "sent",
      limit:             "50",
      statistics:        "globalStats",
    });
    const res = await fetch(`https://api.brevo.com/v3/emailCampaigns?${params}`, { headers });
    if (res.ok) {
      const body = await res.json();
      for (const c of body?.campaigns ?? []) {
        const s = c.statistics?.globalStats ?? {};
        emailsSent   += s.delivered  ?? 0;
        opens        += s.uniqueOpens ?? 0;
        clicks       += s.uniqueClicks ?? 0;
        unsubscribes += s.unsubscriptions ?? 0;
      }
    }
  } catch { /* optional */ }

  // ── New contacts added on this day ────────────────────────────────────
  let newContacts = 0;
  try {
    const params = new URLSearchParams({
      startDate: date,
      endDate:   date,
    });
    const res = await fetch(`https://api.brevo.com/v3/contacts/statistics?${params}`, { headers });
    if (res.ok) {
      const body = await res.json();
      newContacts = body?.daily?.[0]?.contacts ?? 0;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "brevo",
      date,
      data: { emailsSent, opens, clicks, unsubscribes, newContacts },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { emailsSent, opens, clicks, unsubscribes, newContacts };
}
