/**
 * send-activation-email.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Trimite emailul de follow-up de activare tuturor userilor care NU au
 * nicio integrare conectată.
 *
 * Rulare:
 *   node scripts/send-activation-email.mjs
 *
 * Flags opționale:
 *   --dry-run     Listează userii dar nu trimite niciun email
 *   --limit=10    Trimite doar primilor N useri (util pentru test)
 *   --to=a@b.com  Trimite DOAR la o adresă specifică (test rapid)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from "fs";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

// ── Load .env ──────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

// ── Parse CLI flags ────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const DRY_RUN     = args.includes("--dry-run");
const ONLY_TO     = args.find((a) => a.startsWith("--to="))?.split("=")[1];
const LIMIT       = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const DELAY_MS    = 800; // ms între emailuri — evită rate limiting SMTP

// ── Config ─────────────────────────────────────────────────────────────────
const SUBJECT     = "Quick question about your Fold dashboard";
const FROM_NAME   = process.env.SMTP_FROM_NAME  ?? "George from Fold";
const FROM_EMAIL  = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER;
const TEMPLATE    = readFileSync(resolve(__dirname, "../email-templates/manual-activation-followup.html"), "utf-8");

// ── Resend ─────────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ── Supabase ───────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Helpers ────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(msg)  { console.log(`  ${msg}`); }
function ok(msg)   { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function err(msg)  { console.log(`  ❌ ${msg}`); }

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Fold — Activation follow-up email sender");
  console.log("═══════════════════════════════════════════\n");

  if (DRY_RUN)  console.log("  MODE: DRY RUN — niciun email nu va fi trimis\n");
  if (ONLY_TO)  console.log(`  MODE: ONLY TO — trimite doar la ${ONLY_TO}\n`);
  if (LIMIT > 0) console.log(`  MODE: LIMIT ${LIMIT} — trimite maxim ${LIMIT} emailuri\n`);

  // 1. Fetch useri fără integrări conectate
  log("Fetching users fără integrări...");

  // Toți userii existenți
  const { data: allUsers, error: usersErr } = await supabase
    .from("users")
    .select("id, email, full_name, created_at")
    .order("created_at", { ascending: false });

  if (usersErr) {
    err(`Supabase error: ${usersErr.message}`);
    process.exit(1);
  }

  // Userii care AU cel puțin o integrare
  const { data: integrated, error: intErr } = await supabase
    .from("integrations")
    .select("user_id");

  if (intErr) {
    err(`Supabase integrations error: ${intErr.message}`);
    process.exit(1);
  }

  const integratedIds = new Set((integrated ?? []).map((r) => r.user_id));

  // Filtrare: fără integrări
  let targets = (allUsers ?? []).filter(
    (u) => u.email && !integratedIds.has(u.id)
  );

  if (ONLY_TO) {
    targets = targets.filter((u) => u.email === ONLY_TO);
    if (targets.length === 0) {
      // Permite trimiterea la adresa specificată chiar dacă nu e în DB
      targets = [{ id: "manual", email: ONLY_TO, full_name: null, created_at: null }];
    }
  }

  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  console.log(`\n  📋 Useri găsiți fără integrări: ${(allUsers ?? []).filter(u => !integratedIds.has(u.id)).length}`);
  console.log(`  📧 De trimis în această sesiune: ${targets.length}\n`);

  if (targets.length === 0) {
    ok("Toți userii au integrări conectate. Nimic de trimis.");
    return;
  }

  // Preview lista
  console.log("  Lista destinatari:");
  targets.forEach((u, i) => {
    const date = u.created_at ? new Date(u.created_at).toLocaleDateString("ro-RO") : "?";
    console.log(`    ${String(i + 1).padStart(3, " ")}. ${u.email}  (creat: ${date})`);
  });
  console.log();

  if (DRY_RUN) {
    ok("Dry run complet. Adaugă --limit=1 --to=adresa@ta.com pentru un test real.");
    return;
  }

  // 2. Trimite emailuri
  let sent = 0;
  let failed = 0;

  for (const user of targets) {
    process.stdout.write(`  → ${user.email} ... `);
    try {
      const { error: sendErr } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: user.email,
        subject: SUBJECT,
        html: TEMPLATE,
      });
      if (sendErr) throw new Error(sendErr.message);
      console.log("✅ trimis");
      sent++;
    } catch (e) {
      console.log(`❌ EROARE: ${e.message}`);
      failed++;
    }

    // Pauză între emailuri
    if (targets.indexOf(user) < targets.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // 3. Sumar final
  console.log("\n═══════════════════════════════════════════");
  console.log(`  ✅ Trimise cu succes : ${sent}`);
  if (failed > 0) console.log(`  ❌ Eșuate           : ${failed}`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch((e) => {
  err(`Eroare neașteptată: ${e.message}`);
  process.exit(1);
});
