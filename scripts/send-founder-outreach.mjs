/**
 * send-founder-outreach.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends a plain-text, personal founder email to all users who have
 * 0 integrations connected. No HTML. No template. Just a real message.
 *
 * Usage:
 *   node scripts/send-founder-outreach.mjs --dry-run
 *   node scripts/send-founder-outreach.mjs --to=you@email.com
 *   node scripts/send-founder-outreach.mjs --limit=5
 *   node scripts/send-founder-outreach.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Resend }       from "resend";
import { createClient } from "@supabase/supabase-js";
import { resolve, dirname } from "path";
import { fileURLToPath }    from "url";
import { config }           from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

// ── CLI flags ──────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY_TO = args.find(a => a.startsWith("--to="))?.split("=")[1];
const LIMIT   = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const DELAY_MS = 1000; // 1s between sends — respectful of Resend rate limits

// ── Config ─────────────────────────────────────────────────────────────────
const SUBJECT    = "Quick question";
const FROM_NAME  = process.env.SMTP_FROM_NAME  ?? "George";
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER;

// ── Clients ────────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Helpers ────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log   = msg => console.log(`  ${msg}`);
const ok    = msg => console.log(`  ✅ ${msg}`);
const fail  = msg => console.log(`  ❌ ${msg}`);
const warn  = msg => console.log(`  ⚠️  ${msg}`);

/**
 * Returns true if the email looks like a real person.
 * Filters out: bots, fake signups, test accounts, suspiciously long local parts,
 * random-character strings, QQ mail, and our own domain.
 */
function isLegitEmail(email, fullName) {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  const [local, domain] = e.split("@");
  if (!local || !domain) return false;

  // Block our own email
  if (domain === "usefold.io") return false;

  // Block known throwaway / low-quality domains
  const blockedDomains = ["qq.com", "mailinator.com", "guerrillamail.com", "tempmail.com", "sharklasers.com", "yopmail.com"];
  if (blockedDomains.includes(domain)) return false;

  // Block suspiciously long local parts (real people rarely exceed 30 chars)
  if (local.length > 32) return false;

  // Block if local part has 4+ consecutive digits (often auto-generated)
  if (/\d{5,}/.test(local)) return false;

  // Block if local part looks like pure gibberish:
  // more than 60% of unique chars are consonant clusters with no vowels
  const vowels = (local.match(/[aeiou]/gi) || []).length;
  const letters = (local.match(/[a-z]/gi) || []).length;
  if (letters > 8 && vowels / letters < 0.1) return false;

  // Block if full_name itself looks like a repeated/garbage string
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    // e.g. "Mukuash umeshmukiash Mukiaesh umeshmukiaesh" — 4+ word chunks, very long
    if (parts.length >= 4 && fullName.length > 40) return false;
    // Single word that is suspiciously long with no vowels
    const nameVowels = (fullName.match(/[aeiou]/gi) || []).length;
    const nameLetters = (fullName.match(/[a-z]/gi) || []).length;
    if (nameLetters > 10 && nameVowels / nameLetters < 0.1) return false;
  }

  return true;
}

/** Extract a first name from full_name, falling back gracefully */
function firstName(fullName) {
  if (!fullName || !fullName.trim()) return null;
  return fullName.trim().split(/\s+/)[0];
}

/** Build the plain-text email body */
function buildBody(fullName) {
  const name = firstName(fullName);
  const greeting = name ? `Hey ${name},` : "Hey,";

  return `${greeting}

I noticed you signed up for Fold Analytics but didn't end up connecting any integration for building your dashboard.

I'm the guy who built it, just me, no team. Was something unclear or did something break?

Genuinely asking because I'm trying to fix it.

— George`;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Fold — Founder outreach (plain text)");
  console.log("════════════════════════════════════════\n");

  if (DRY_RUN) log("MODE: DRY RUN — no emails will be sent\n");
  if (ONLY_TO) log(`MODE: ONLY TO — ${ONLY_TO}\n`);
  if (LIMIT > 0) log(`MODE: LIMIT — at most ${LIMIT} users\n`);

  // ── Step 1: All users ─────────────────────────────────────────────────────
  log("Fetching users...");
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id, email, full_name, created_at")
    .order("created_at", { ascending: false });

  if (usersErr) { fail(`users error: ${usersErr.message}`); process.exit(1); }
  log(`→ ${users.length} total users`);

  // ── Step 2: Users WITH integrations ──────────────────────────────────────
  log("Fetching integrations...");
  const { data: integrated, error: intErr } = await supabase
    .from("integrations")
    .select("user_id");

  if (intErr) { fail(`integrations error: ${intErr.message}`); process.exit(1); }

  const integratedIds = new Set((integrated ?? []).map(r => r.user_id));

  // ── Step 3: Filter — 0 integrations + has email + looks legit ───────────
  let targets = (users ?? []).filter(u => u.email && !integratedIds.has(u.id) && isLegitEmail(u.email, u.full_name));
  const filteredOut = (users ?? []).filter(u => u.email && !integratedIds.has(u.id) && !isLegitEmail(u.email, u.full_name));

  if (ONLY_TO) {
    targets = targets.filter(u => u.email === ONLY_TO);
    if (targets.length === 0) {
      warn(`${ONLY_TO} not in filtered list — adding manually for test.`);
      targets = [{ id: "manual", email: ONLY_TO, full_name: null, created_at: null }];
    }
  }

  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  // ── Step 4: Summary ───────────────────────────────────────────────────────
  const rawNoInt = (users ?? []).filter(u => u.email && !integratedIds.has(u.id)).length;
  console.log(`\n  📋 Total users              : ${(users ?? []).length}`);
  console.log(`  🔌 With integrations        : ${integratedIds.size}`);
  console.log(`  📧 No integrations (raw)    : ${rawNoInt}`);
  console.log(`  🚫 Filtered as suspicious   : ${filteredOut.length}`);
  console.log(`  ✅ Eligible (legit)         : ${targets.length}`);
  console.log(`  📤 Sending in this run      : ${ONLY_TO ? 1 : (LIMIT > 0 ? Math.min(LIMIT, targets.length) : targets.length)}\n`);

  if (filteredOut.length > 0) {
    console.log("  ── Filtered out (not sending) ──────────────────────");
    filteredOut.forEach((u, i) => console.log(`    ${String(i+1).padStart(3)}. ${u.email} (${u.full_name ?? "no name"})`));
    console.log();
  }

  if (targets.length === 0) {
    ok("No eligible recipients. Nothing to send.");
    return;
  }

  // ── Preview email ──────────────────────────────────────────────────────────
  console.log("  ─── Email preview ───────────────────────────────────");
  console.log(`  Subject : ${SUBJECT}`);
  console.log(`  From    : ${FROM_NAME} <${FROM_EMAIL}>`);
  console.log("  Body:\n");
  console.log(buildBody(targets[0]?.full_name).split("\n").map(l => `    ${l}`).join("\n"));
  console.log("  ─────────────────────────────────────────────────────\n");

  // ── Recipients list ────────────────────────────────────────────────────────
  console.log("  Recipients:");
  targets.forEach((u, i) => {
    const date = u.created_at ? new Date(u.created_at).toLocaleDateString("en-GB") : "?";
    const name = u.full_name ? `(${u.full_name})` : "(no name)";
    console.log(`    ${String(i + 1).padStart(3)}. ${u.email} ${name}  signed up: ${date}`);
  });
  console.log();

  if (DRY_RUN) {
    ok("Dry run complete. Run without --dry-run to send for real.");
    ok("Tip: test first with --to=your@email.com");
    return;
  }

  // ── Step 5: Send ──────────────────────────────────────────────────────────
  let sent = 0, failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const user = targets[i];
    const body = buildBody(user.full_name);
    process.stdout.write(`  → [${i + 1}/${targets.length}] ${user.email} ... `);

    try {
      const { error: sendErr } = await resend.emails.send({
        from   : `${FROM_NAME} <${FROM_EMAIL}>`,
        to     : user.email,
        subject: SUBJECT,
        text   : body,        // ← plain text only, no HTML
      });

      if (sendErr) throw new Error(sendErr.message);
      console.log("✅ sent");
      sent++;
    } catch (e) {
      console.log(`❌ FAILED: ${e.message}`);
      failed++;
    }

    if (i < targets.length - 1) await sleep(DELAY_MS);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════");
  console.log(`  ✅ Sent    : ${sent}`);
  if (failed > 0) console.log(`  ❌ Failed  : ${failed}`);
  console.log("════════════════════════════════════════\n");
}

main().catch(e => { fail(`Unexpected error: ${e.message}`); process.exit(1); });
