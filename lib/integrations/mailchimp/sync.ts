import { createServiceClient } from "@/lib/supabase/service";

/**
 * Mailchimp Reports API
 * GET /{dc}.api.mailchimp.com/3.0/reports?count=1000&since_send_time=...&before_send_time=...
 * Aggregates: emails_sent, opens, clicks, subscribers added/removed.
 *
 * For daily subscriber stats:
 * GET /lists?count=100 → aggregate member_count changes via activity endpoint.
 */
export async function syncMailchimpDay(
  userId: string,
  apiKey: string,
  dc: string,
  date: string,
): Promise<{ emailsSent: number; opens: number; clicks: number; subscribers: number; unsubscribes: number }> {
  const base = `https://${dc}.api.mailchimp.com/3.0`;
  const auth = `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
  const headers = { Authorization: auth };

  const dateStart = `${date}T00:00:00+00:00`;
  const dateEnd   = `${date}T23:59:59+00:00`;

  // ── Campaign reports sent on this day ─────────────────────────────────
  let emailsSent = 0;
  let opens      = 0;
  let clicks     = 0;

  try {
    const params = new URLSearchParams({
      count:            "200",
      since_send_time:  dateStart,
      before_send_time: dateEnd,
      fields:           "reports.emails_sent,reports.opens.opens_total,reports.clicks.clicks_total",
    });
    const res = await fetch(`${base}/reports?${params}`, { headers });
    if (res.ok) {
      const body = await res.json();
      for (const r of body?.reports ?? []) {
        emailsSent += r.emails_sent          ?? 0;
        opens      += r.opens?.opens_total   ?? 0;
        clicks     += r.clicks?.clicks_total ?? 0;
      }
    }
  } catch { /* optional */ }

  // ── Subscriber growth for the day ─────────────────────────────────────
  let subscribers  = 0;
  let unsubscribes = 0;

  try {
    const listsRes = await fetch(`${base}/lists?count=50&fields=lists.id`, { headers });
    if (listsRes.ok) {
      const listsBody = await listsRes.json();
      for (const list of listsBody?.lists ?? []) {
        const actParams = new URLSearchParams({
          count:  "1",
          fields: "activity.subs,activity.unsubs,activity.day",
        });
        const actRes = await fetch(`${base}/lists/${list.id}/activity?${actParams}`, { headers });
        if (!actRes.ok) continue;
        const actBody = await actRes.json();
        for (const day of actBody?.activity ?? []) {
          if (day.day === date) {
            subscribers  += day.subs   ?? 0;
            unsubscribes += day.unsubs ?? 0;
          }
        }
      }
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "mailchimp",
      date,
      data: { emailsSent, opens, clicks, subscribers, unsubscribes },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { emailsSent, opens, clicks, subscribers, unsubscribes };
}
