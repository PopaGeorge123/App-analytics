/**
 * send-no-integration-reminder.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends the "no-integration-reminder" email to all users who:
 *   1. Have newsletter_emails = true (opted in, or never changed default)
 *   2. Have 0 integrations connected
 *
 * Usage:
 *   node scripts/send-no-integration-reminder.mjs
 *
 * Optional flags:
 *   --dry-run        List targets but send nothing
 *   --limit=10       Send to at most N users (useful for staged rollouts)
 *   --to=a@b.com     Send ONLY to this address (quick smoke-test)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from "fs";
import { Resend }       from "resend";
import { createClient } from "@supabase/supabase-js";
import { resolve, dirname } from "path";
import { fileURLToPath }    from "url";
import { config }           from "dotenv";

// ── Env ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

// ── CLI flags ──────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const ONLY_TO  = args.find((a) => a.startsWith("--to="))?.split("=")[1];
const LIMIT    = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const DELAY_MS = 800; // ms between sends — avoids Resend rate limits

// ── Config ─────────────────────────────────────────────────────────────────
const SUBJECT   = "Your Fold dashboard is waiting — connect your first integration";
const FROM_NAME  = process.env.SMTP_FROM_NAME  ?? "George from Fold";
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER;
const TEMPLATE   = readFileSync(
  resolve(__dirname, "../email-templates/no-integration-reminder.html"),
  "utf-8"
);

// ── Clients ────────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log  = (msg) => console.log(`  ${msg}`);
const ok   = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.log(`  ⚠️  ${msg}`);
const fail = (msg) => console.log(`  ❌ ${msg}`);

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Fold — No-integration reminder email sender");
  console.log("═══════════════════════════════════════════════\n");

  if (DRY_RUN)  log("MODE: DRY RUN — no emails will be sent\n");
  if (ONLY_TO)  log(`MODE: ONLY TO — sending only to ${ONLY_TO}\n`);
  if (LIMIT > 0) log(`MODE: LIMIT ${LIMIT} — sending to at most ${LIMIT} users\n`);

  // ── Step 1: Fetch opted-in users (newsletter_emails = true) ──────────────
  log("Fetching users with newsletter_emails = true ...");

  const { data: optedIn, error: optErr } = await supabase
    .from("users")
    .select("id, email, created_at")
    .eq("newsletter_emails", true)
    .order("created_at", { ascending: false });

  if (optErr) {
    fail(`Supabase users error: ${optErr.message}`);
    process.exit(1);
  }

  log(`  → ${(optedIn ?? []).length} users with newsletter_emails = true`);

  // ── Step 2: Find which of those have NO integrations ─────────────────────
  log("Fetching connected integrations ...");

  const { data: integrated, error: intErr } = await supabase
    .from("integrations")
    .select("user_id");

  if (intErr) {
    fail(`Supabase integrations error: ${intErr.message}`);
    process.exit(1);
  }

  const integratedIds = new Set((integrated ?? []).map((r) => r.user_id));

  // ── Step 3: Build target list ─────────────────────────────────────────────
  let targets = (optedIn ?? []).filter(
    (u) => u.email && !integratedIds.has(u.id)
  );

  // --to override: send to specific address regardless of DB state
  if (ONLY_TO) {
    targets = targets.filter((u) => u.email === ONLY_TO);
    if (targets.length === 0) {
      warn(`${ONLY_TO} not found in the filtered list — adding manually for test.`);
      targets = [{ id: "manual", email: ONLY_TO, created_at: null }];
    }
  }

  // --limit cap
  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  // ── Step 4: Print summary & preview ──────────────────────────────────────
  const totalOptedIn        = (optedIn ?? []).length;
  const totalNoIntegration  = (optedIn ?? []).filter((u) => !integratedIds.has(u.id)).length;

  console.log(`\n  📋 Opted-in users (newsletter = true) : ${totalOptedIn}`);
  console.log(`  🔌 Of those with 0 integrations        : ${totalNoIntegration}`);
  console.log(`  📧 Sending in this run                 : ${targets.length}\n`);

  if (targets.length === 0) {
    ok("No eligible recipients found. Nothing to send.");
    return;
  }

  console.log("  Recipients:");
  targets.forEach((u, i) => {
    const date = u.created_at
      ? new Date(u.created_at).toLocaleDateString("en-GB")
      : "unknown";
    console.log(`    ${String(i + 1).padStart(3, " ")}. ${u.email}  (signed up: ${date})`);
  });
  console.log();

  if (DRY_RUN) {
    ok("Dry run complete. Run without --dry-run to send for real.");
    ok("Tip: use --limit=1 --to=your@email.com for a live smoke-test first.");
    return;
  }

  // ── Step 5: Send ──────────────────────────────────────────────────────────
  let sent   = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const user = targets[i];
    process.stdout.write(`  → ${user.email} ... `);

    try {
      const { error: sendErr } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to:   user.email,
        subject: SUBJECT,
        html: TEMPLATE,
      });

      if (sendErr) throw new Error(sendErr.message);

      console.log("✅ sent");
      sent++;
    } catch (e) {
      console.log(`❌ FAILED: ${e.message}`);
      failed++;
    }

    // Delay between sends (skip after last)
    if (i < targets.length - 1) await sleep(DELAY_MS);
  }

  // ── Step 6: Summary ───────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log(`  ✅ Sent successfully : ${sent}`);
  if (failed > 0) console.log(`  ❌ Failed           : ${failed}`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((e) => {
  fail(`Unexpected error: ${e.message}`);
  process.exit(1);
});
