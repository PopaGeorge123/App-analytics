import { createServiceClient } from "@/lib/supabase/service";

/**
 * Notion Database API v1
 * Queries a user-specified database and counts rows created on a given date.
 * We interpret each row as a "record" (e.g. deal, task, lead, etc.)
 *
 * access_token = Internal integration token
 * account_id   = Database ID
 *
 * Metrics: newRows, totalRows, updatedRows
 */

interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function syncNotionDay(
  userId: string,
  apiToken: string,
  databaseId: string,
  date: string,
): Promise<void> {
  const supabase = createServiceClient();

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;

  let newRows     = 0;
  let updatedRows = 0;
  let totalRows   = 0;
  let cursor: string | null = null;

  try {
    do {
      const body: Record<string, unknown> = {
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      };

      const res: Response = await fetch(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      await sleep(200);
      if (!res.ok) break;

      const data = (await res.json()) as NotionQueryResponse;
      for (const page of data.results) {
        totalRows++;
        if (page.created_time >= dayStart && page.created_time <= dayEnd) newRows++;
        else if (page.last_edited_time >= dayStart && page.last_edited_time <= dayEnd) updatedRows++;
      }

      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);
  } catch { /* skip */ }

  const metrics = { newRows, updatedRows, totalRows };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "notion", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
