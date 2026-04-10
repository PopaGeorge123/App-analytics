// @ts-ignore: dotenv is optional for the cron server runtime; ignore missing types in the repo environment
import dotenv from "dotenv";
dotenv.config();
import cron from "node-cron";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

if (!CRON_SECRET) {
  console.error("[cron-server] CRON_SECRET is not set. Exiting.");
  process.exit(1);
}

async function callRoute(path: string): Promise<void> {
  const url = `${APP_URL}${path}`;
  console.log(`[cron-server] → POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[cron-server] ✗ ${url} — ${res.status}: ${body}`);
    return;
  }

  const json = await res.json();
  console.log(`[cron-server] ✓ ${url}`, JSON.stringify(json));
}

// ── 02:00 UTC — Sync data from all integrations ────────────────────────────
cron.schedule("0 2 * * *", async () => {
  console.log("[cron-server] Running daily sync...");
  try {
    await callRoute("/api/cron/sync");
  } catch (err) {
    console.error("[cron-server] Sync failed:", err);
  }
}, { timezone: "UTC" });

// ── 07:00 UTC — Generate AI digest + send email ────────────────────────────
cron.schedule("0 7 * * *", async () => {
  console.log("[cron-server] Running daily digest...");
  try {
    await callRoute("/api/cron/digest");
  } catch (err) {
    console.error("[cron-server] Digest failed:", err);
  }
}, { timezone: "UTC" });

// ── 09:00 UTC — Send trial-ending reminder (fires ~24h before expiry) ───────
cron.schedule("0 9 * * *", async () => {
  console.log("[cron-server] Running trial-reminder...");
  try {
    await callRoute("/api/cron/trial-reminder");
  } catch (err) {
    console.error("[cron-server] Trial-reminder failed:", err);
  }
}, { timezone: "UTC" });

console.log("[cron-server] Started. Schedules:");
console.log("  02:00 UTC → /api/cron/sync");
console.log("  07:00 UTC → /api/cron/digest");
console.log("  09:00 UTC → /api/cron/trial-reminder");
console.log(`  App URL: ${APP_URL}`);
