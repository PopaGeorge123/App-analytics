import { createServiceClient } from "@/lib/supabase/service";

/**
 * Zendesk REST API v2
 * Pulls ticket counts (new, solved, CSAT) for a given day.
 *
 * access_token = "email:apiToken"
 * account_id   = subdomain
 * Metrics: newTickets, solvedTickets, reopenedTickets, csatScore
 */

interface ZendeskTicketMetrics {
  count: number;
}

interface ZendeskSatisfactionResponse {
  count: { received: number; offered: number };
  current_rating: { value: string };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function syncZendeskDay(
  userId: string,
  credentials: string, // "email:apiToken"
  subdomain: string,
  date: string,
): Promise<void> {
  const supabase = createServiceClient();
  const [email, apiToken] = credentials.split(":").reduce(
    (acc: [string, string], part, i) => { if (i === 0) acc[0] = part; else acc[1] = (acc[1] ? acc[1] + ":" : "") + part; return acc; },
    ["", ""],
  );
  const auth    = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
  const base    = `https://${subdomain}.zendesk.com/api/v2`;
  const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

  const dayStart = `${date}T00:00:00Z`;
  const dayEnd   = `${date}T23:59:59Z`;

  let newTickets      = 0;
  let solvedTickets   = 0;
  let reopenedTickets = 0;
  let csatScore       = 0;

  try {
    // New tickets created today
    const newRes: Response = await fetch(
      `${base}/tickets/count.json?created_after=${dayStart}&created_before=${dayEnd}`,
      { headers },
    );
    await sleep(200);
    if (newRes.ok) {
      const d = (await newRes.json()) as { count: ZendeskTicketMetrics };
      newTickets = d.count?.count ?? 0;
    }
  } catch { /* skip */ }

  try {
    // Solved tickets today
    const solvedRes: Response = await fetch(
      `${base}/tickets/count.json?status=solved&solved_after=${dayStart}&solved_before=${dayEnd}`,
      { headers },
    );
    await sleep(200);
    if (solvedRes.ok) {
      const d = (await solvedRes.json()) as { count: ZendeskTicketMetrics };
      solvedTickets = d.count?.count ?? 0;
    }
  } catch { /* skip */ }

  try {
    // CSAT score (overall)
    const csatRes: Response = await fetch(`${base}/satisfaction_ratings.json`, { headers });
    await sleep(200);
    if (csatRes.ok) {
      const d = (await csatRes.json()) as { satisfaction_ratings: Array<{ score: string; created_at: string }> };
      const ratings = (d.satisfaction_ratings ?? []).filter(
        (r) => r.created_at >= dayStart && r.created_at <= dayEnd,
      );
      const goodCount = ratings.filter((r) => r.score === "good").length;
      csatScore = ratings.length > 0 ? Math.round((goodCount / ratings.length) * 100) : 0;
    }
  } catch { /* skip */ }

  // Reopened tickets approximated by tickets with status=open that were previously solved
  reopenedTickets = 0; // Zendesk doesn't expose this directly without audit logs

  const metrics = { newTickets, solvedTickets, reopenedTickets, csatScore };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "zendesk", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
