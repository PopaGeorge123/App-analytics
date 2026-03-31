import { createServiceClient } from "@/lib/supabase/service";

/**
 * Salesforce SOQL REST API v59.0
 * Query Opportunity object for deals closed today
 * Query Lead for new leads created today
 *
 * Metrics stored: dealsWon, closedRevenue, newLeads, pipelineValue
 */
export async function syncSalesforceDay(
  userId: string,
  instanceUrl: string,
  accessToken: string,
  date: string,
): Promise<{ dealsWon: number; closedRevenue: number; newLeads: number; pipelineValue: number }> {
  const base    = instanceUrl.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept:        "application/json",
  };

  const dayStart = `${date}T00:00:00Z`;
  const dayEnd   = `${date}T23:59:59Z`;

  async function soql(query: string): Promise<{ records: Record<string, unknown>[]; totalSize: number }> {
    const res = await fetch(
      `${base}/services/data/v59.0/query/?q=${encodeURIComponent(query)}`,
      { headers },
    );
    if (!res.ok) return { records: [], totalSize: 0 };
    return res.json();
  }

  let dealsWon      = 0;
  let closedRevenue = 0;
  let newLeads      = 0;
  let pipelineValue = 0;

  // ── Opportunities closed (Won) today ──────────────────────────────────
  try {
    const q = `SELECT COUNT(Id), SUM(Amount) FROM Opportunity WHERE StageName = 'Closed Won' AND CloseDate >= ${dayStart} AND CloseDate <= ${dayEnd}`;
    const body = await soql(q);
    const rec  = body?.records?.[0] as Record<string, unknown> | undefined;
    if (rec) {
      dealsWon      = (rec["expr0"] as number) ?? 0;
      closedRevenue = parseFloat(String(rec["expr1"] ?? "0"));
    }
  } catch { /* optional */ }

  // ── Open pipeline value ────────────────────────────────────────────────
  try {
    const q = `SELECT SUM(Amount) FROM Opportunity WHERE IsClosed = false`;
    const body = await soql(q);
    const rec  = body?.records?.[0] as Record<string, unknown> | undefined;
    if (rec) {
      pipelineValue = parseFloat(String(rec["expr0"] ?? "0"));
    }
  } catch { /* optional */ }

  // ── New leads created today ───────────────────────────────────────────
  try {
    const q = `SELECT COUNT(Id) FROM Lead WHERE CreatedDate >= ${dayStart} AND CreatedDate <= ${dayEnd}`;
    const body = await soql(q);
    const rec  = body?.records?.[0] as Record<string, unknown> | undefined;
    if (rec) {
      newLeads = (rec["expr0"] as number) ?? 0;
    }
  } catch { /* optional */ }

  const supabase = createServiceClient();
  await supabase.from("daily_snapshots").upsert(
    {
      user_id:  userId,
      provider: "salesforce",
      date,
      data: {
        dealsWon,
        closedRevenue: parseFloat(closedRevenue.toFixed(2)),
        newLeads,
        pipelineValue: parseFloat(pipelineValue.toFixed(2)),
      },
    },
    { onConflict: "user_id,provider,date" }
  );

  return { dealsWon, closedRevenue, newLeads, pipelineValue };
}
