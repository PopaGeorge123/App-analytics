/**
 * fix-mrr-history.mjs
 *
 * Problem: The Stripe sync writes current live MRR/activeSubscriptions/arpu/trialingSubscriptions
 * to every daily snapshot, including historical/backfill dates. This makes it look like
 * subscriptions existed before they actually started.
 *
 * Fix: For every Stripe daily_snapshot, find the EARLIEST date that has mrr > 0
 * by asking Stripe directly when the first subscription was created.
 * Then zero-out mrr/activeSubscriptions/trialingSubscriptions/arpu on all snapshots
 * BEFORE that date.
 *
 * Usage:
 *   node scripts/fix-mrr-history.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const SUPABASE_URL        = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Get all Stripe integrations
  const { data: integrations, error: intErr } = await db
    .from('integrations')
    .select('user_id, access_token')
    .eq('platform', 'stripe');

  if (intErr) throw intErr;
  console.log(`Found ${integrations.length} Stripe integration(s)`);

  for (const { user_id, access_token } of integrations) {
    console.log(`\nProcessing user: ${user_id}`);

    // 2. Ask Stripe for the oldest active/trialing subscription created_at
    let earliestSubDate = null;
    try {
      let startingAfter = null;
      let oldest = Infinity;
      for (const status of ['active', 'trialing', 'canceled', 'past_due']) {
        while (true) {
          const params = new URLSearchParams({ status, limit: '100' });
          if (startingAfter) params.set('starting_after', startingAfter);
          const res = await fetch(`https://api.stripe.com/v1/subscriptions?${params}`, {
            headers: { Authorization: `Bearer ${access_token}`, 'Stripe-Version': '2024-12-18.acacia' },
          });
          if (!res.ok) break;
          const page = await res.json();
          for (const sub of page.data) {
            if (sub.start_date && sub.start_date < oldest) oldest = sub.start_date;
          }
          if (!page.has_more) break;
          startingAfter = page.data.at(-1).id;
        }
      }
      if (oldest !== Infinity) {
        earliestSubDate = new Date(oldest * 1000).toISOString().slice(0, 10);
        console.log(`  Earliest subscription start date: ${earliestSubDate}`);
      } else {
        console.log(`  No subscriptions found — zeroing all MRR history`);
        earliestSubDate = '9999-12-31'; // zero everything
      }
    } catch (e) {
      console.error(`  Failed to fetch subscriptions from Stripe: ${e.message}`);
      continue;
    }

    // 3. Fetch all Stripe snapshots for this user that have mrr > 0 and date < earliestSubDate
    const { data: snapshots, error: snapErr } = await db
      .from('daily_snapshots')
      .select('id, date, data')
      .eq('user_id', user_id)
      .eq('provider', 'stripe')
      .lt('date', earliestSubDate);

    if (snapErr) { console.error(`  DB error: ${snapErr.message}`); continue; }

    const toFix = snapshots.filter(s =>
      (s.data?.mrr > 0 || s.data?.activeSubscriptions > 0 || s.data?.trialingSubscriptions > 0 || s.data?.arpu > 0)
    );

    if (toFix.length === 0) {
      console.log(`  No incorrect MRR snapshots found — nothing to fix`);
      continue;
    }

    console.log(`  Zeroing MRR fields on ${toFix.length} snapshot(s) before ${earliestSubDate}...`);

    for (const snap of toFix) {
      const fixedData = {
        ...snap.data,
        mrr: 0,
        activeSubscriptions: 0,
        trialingSubscriptions: 0,
        arpu: 0,
      };
      const { error: updateErr } = await db
        .from('daily_snapshots')
        .update({ data: fixedData })
        .eq('id', snap.id);
      if (updateErr) {
        console.error(`    Failed to update snapshot ${snap.id} (${snap.date}): ${updateErr.message}`);
      } else {
        console.log(`    Fixed ${snap.date}`);
      }
    }

    console.log(`  Done for user ${user_id}`);
  }

  console.log('\nAll done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
