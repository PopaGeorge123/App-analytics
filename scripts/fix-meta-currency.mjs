/**
 * One-time script: update the Meta integration currency to RON
 * and re-stamp all existing daily_snapshots so the AI/dashboard reads correctly.
 *
 * Usage:
 *   node scripts/fix-meta-currency.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CURRENCY = "RON";

async function main() {
  // 1. Update the integrations row
  const { data: updated, error: intErr } = await sb
    .from("integrations")
    .update({ currency: CURRENCY })
    .eq("platform", "meta")
    .select("user_id, account_id, currency");

  if (intErr) { console.error("integrations update failed:", intErr); process.exit(1); }
  console.log(`Updated ${updated.length} Meta integration row(s) to ${CURRENCY}:`, updated);

  // 2. For each affected user, patch all daily_snapshots so the AI context
  //    (which reads currency from snapshot data as fallback) is also correct.
  for (const row of updated) {
    const { data: snapshots, error: snapErr } = await sb
      .from("daily_snapshots")
      .select("id, data")
      .eq("user_id", row.user_id)
      .eq("provider", "meta");

    if (snapErr) { console.error(`snapshots fetch failed for ${row.user_id}:`, snapErr); continue; }

    let patched = 0;
    for (const snap of snapshots ?? []) {
      const oldData = snap.data ?? {};
      if (oldData.currency === CURRENCY) continue; // already correct

      const { error: upErr } = await sb
        .from("daily_snapshots")
        .update({ data: { ...oldData, currency: CURRENCY } })
        .eq("id", snap.id);

      if (upErr) { console.error(`  snapshot ${snap.id} update failed:`, upErr); }
      else patched++;
    }
    console.log(`  User ${row.user_id.slice(0, 8)}: patched ${patched} snapshot(s)`);
  }

  console.log("Done.");
}

main();
