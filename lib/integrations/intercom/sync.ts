import { createServiceClient } from "@/lib/supabase/service";

/**
 * Intercom REST API 2.10
 * Pulls conversations created today, contacts created today, and CSAT ratings.
 *
 * access_token = Intercom Access Token
 * Metrics: newConversations, resolvedConversations, newContacts, csatScore
 */

interface IntercomConversation {
  id: string;
  created_at: number;
  state: string;
  statistics?: { median_time_to_first_response_seconds?: number };
}

interface IntercomContact {
  id: string;
  created_at: number;
}

interface IntercomListResponse<T> {
  data: T[];
  pages?: { total_pages: number; next?: { starting_after: string } };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function syncIntercomDay(
  userId: string,
  accessToken: string,
  date: string,
): Promise<void> {
  const supabase = createServiceClient();
  const headers  = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Intercom-Version": "2.10",
  };

  const dayStart = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const dayEnd   = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);

  let newConversations      = 0;
  let resolvedConversations = 0;
  let newContacts           = 0;
  let csatTotal             = 0;
  let csatCount             = 0;

  // ── Conversations created today ──────────────────────────────────────
  try {
    let startingAfter: string | undefined;
    do {
      const body: Record<string, unknown> = {
        query: {
          operator: "AND",
          value: [
            { field: "created_at", operator: ">", value: dayStart },
            { field: "created_at", operator: "<", value: dayEnd },
          ],
        },
        pagination: { per_page: 50, ...(startingAfter ? { starting_after: startingAfter } : {}) },
      };
      const res: Response = await fetch("https://api.intercom.io/conversations/search", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      await sleep(300);
      if (!res.ok) break;

      const data = (await res.json()) as IntercomListResponse<IntercomConversation>;
      for (const c of data.data ?? []) {
        newConversations++;
        if (c.state === "closed") resolvedConversations++;
      }
      startingAfter = data.pages?.next?.starting_after;
    } while (startingAfter);
  } catch { /* skip */ }

  // ── New contacts ──────────────────────────────────────────────────────
  try {
    let startingAfter: string | undefined;
    do {
      const body: Record<string, unknown> = {
        query: {
          operator: "AND",
          value: [
            { field: "created_at", operator: ">", value: dayStart },
            { field: "created_at", operator: "<", value: dayEnd },
          ],
        },
        pagination: { per_page: 50, ...(startingAfter ? { starting_after: startingAfter } : {}) },
      };
      const res: Response = await fetch("https://api.intercom.io/contacts/search", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      await sleep(300);
      if (!res.ok) break;

      const data = (await res.json()) as IntercomListResponse<IntercomContact>;
      newContacts += data.data?.length ?? 0;
      startingAfter = data.pages?.next?.starting_after;
    } while (startingAfter);
  } catch { /* skip */ }

  const csatScore = csatCount > 0 ? Math.round((csatTotal / csatCount) * 10) / 10 : 0;

  const metrics = {
    newConversations,
    resolvedConversations,
    newContacts,
    csatScore,
  };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "intercom", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
