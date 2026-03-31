import { createServiceClient } from "@/lib/supabase/service";

/**
 * Pipedrive REST API v1
 * Pulls deals closed/won, open pipeline, new persons for a day.
 *
 * access_token = Personal API token
 * Metrics: dealsWon, closedRevenue, newContacts, pipelineValue
 */

interface PipedriveDeal {
  id: number;
  status: string;
  value: number;
  close_time: string | null;
  add_time: string;
}

interface PipedrivePerson {
  id: number;
  add_time: string;
}

interface PipedriveResponse<T> {
  success: boolean;
  data: T[];
  additional_data?: { pagination?: { more_items_in_collection: boolean; next_start: number } };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAll<T>(url: string): Promise<T[]> {
  const all: T[] = [];
  let start = 0;
  while (true) {
    const sep = url.includes("?") ? "&" : "?";
    const res: Response = await fetch(`${url}${sep}start=${start}&limit=100`);
    await sleep(200);
    if (!res.ok) break;
    const body = (await res.json()) as PipedriveResponse<T>;
    if (!body.success || !body.data) break;
    all.push(...body.data);
    const pagination = body.additional_data?.pagination;
    if (!pagination?.more_items_in_collection) break;
    start = pagination.next_start;
  }
  return all;
}

export async function syncPipedriveDay(
  userId: string,
  apiToken: string,
  date: string,
): Promise<void> {
  const supabase  = createServiceClient();
  const base      = `https://api.pipedrive.com/v1`;
  const token     = `api_token=${encodeURIComponent(apiToken)}`;

  const dayStart = `${date} 00:00:00`;
  const dayEnd   = `${date} 23:59:59`;

  let dealsWon      = 0;
  let closedRevenue = 0;
  let newContacts   = 0;
  let pipelineValue = 0;

  try {
    // Won deals today — filter by close_time
    const wonDeals = await fetchAll<PipedriveDeal>(
      `${base}/deals?${token}&status=won&start_date=${date}&end_date=${date}`,
    );
    for (const d of wonDeals) {
      if (d.close_time && d.close_time >= dayStart && d.close_time <= dayEnd) {
        dealsWon++;
        closedRevenue += d.value ?? 0;
      }
    }
  } catch { /* skip */ }

  try {
    // All open deals for current pipeline value
    const openDeals = await fetchAll<PipedriveDeal>(
      `${base}/deals?${token}&status=open`,
    );
    pipelineValue = openDeals.reduce((s, d) => s + (d.value ?? 0), 0);
  } catch { /* skip */ }

  try {
    // New persons (contacts) created today
    const persons = await fetchAll<PipedrivePerson>(
      `${base}/persons?${token}&start_date=${date}&end_date=${date}`,
    );
    newContacts = persons.length;
  } catch { /* skip */ }

  const metrics = {
    dealsWon,
    closedRevenue: Math.round(closedRevenue * 100) / 100,
    newContacts,
    pipelineValue: Math.round(pipelineValue * 100) / 100,
  };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "pipedrive", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}
