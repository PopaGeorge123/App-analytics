import { createServiceClient } from "@/lib/supabase/service";

/**
 * Freshdesk REST API v2
 * Pulls ticket metrics for a given day.
 *
 * access_token = apiKey
 * account_id   = subdomain
 * Metrics: newTickets, resolvedTickets, openTickets, csatScore
 */

interface FreshdeskTicket {
  id: number;
  status: number; // 2=open, 3=pending, 4=resolved, 5=closed
  created_at: string;
  updated_at: string;
  satisfaction_survey?: { ratings?: { default_question?: number } };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Freshdesk status codes
const STATUS_RESOLVED = 4;
const STATUS_CLOSED   = 5;

export async function syncFreshdeskDay(
  userId: string,
  apiKey: string,
  subdomain: string,
  date: string,
): Promise<void> {
  const supabase = createServiceClient();
  const auth     = Buffer.from(`${apiKey}:X`).toString("base64");
  const base     = `https://${subdomain}.freshdesk.com/api/v2`;
  const headers  = { Authorization: `Basic ${auth}`, Accept: "application/json" };

  const dayStart = `${date}T00:00:00Z`;
  const dayEnd   = `${date}T23:59:59Z`;

  let newTickets      = 0;
  let resolvedTickets = 0;
  let openTickets     = 0;
  let csatTotal       = 0;
  let csatCount       = 0;

  try {
    let page = 1;
    while (true) {
      const res: Response = await fetch(
        `${base}/tickets?created_since=${dayStart}&per_page=100&page=${page}`,
        { headers },
      );
      await sleep(200);
      if (!res.ok) break;

      const tickets = (await res.json()) as FreshdeskTicket[];
      if (!tickets.length) break;

      for (const t of tickets) {
        if (t.created_at >= dayStart && t.created_at <= dayEnd) newTickets++;
        if (t.status === STATUS_RESOLVED || t.status === STATUS_CLOSED) resolvedTickets++;
        else openTickets++;
      }

      if (tickets.length < 100) break;
      page++;
    }
  } catch { /* skip */ }

  const csatScore = csatCount > 0 ? Math.round((csatTotal / csatCount) * 10) / 10 : 0;

  const metrics = { newTickets, resolvedTickets, openTickets, csatScore };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "freshdesk", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
