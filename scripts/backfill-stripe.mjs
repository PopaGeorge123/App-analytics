// v3 - fixed: use paymentIntents (not charges) to match Stripe Dashboard
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const STRIPE_KEY = env['STRIPE_SECRET_KEY'];
const USER_ID = '07f1570e-b729-4237-a06f-eccdea3ded7d';

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-12-18.acacia' });

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Step 1: Delete all existing stripe snapshots
const { error: delErr } = await db
  .from('daily_snapshots')
  .delete()
  .eq('user_id', USER_ID)
  .eq('provider', 'stripe');
if (delErr) {
  console.error('Delete error:', delErr.message);
} else {
  console.log('Cleared existing stripe snapshots\n');
}

// Step 2: Fetch and insert fresh data
const DAYS = 90;
let daysWithData = 0;
let totalRevenue = 0;

console.log(`Backfilling last ${DAYS} days...\n`);

for (let i = DAYS; i >= 1; i--) {
  const dayStart = daysAgo(i);
  const gte = Math.floor(new Date(dayStart + 'T00:00:00Z').getTime() / 1000);
  const lte = gte + 86400 - 1;

  const intents = [];
  for await (const pi of stripe.paymentIntents.list({ created: { gte, lte }, limit: 100 })) {
    intents.push(pi);
  }

  const succeeded = intents.filter(pi => pi.status === 'succeeded');
  const revenue = succeeded.reduce((s, pi) => s + pi.amount_received, 0);
  const refunds = succeeded.reduce((s, pi) => s + (pi.amount_refunded ?? 0), 0);
  const txCount = succeeded.length;
  const newCustomers = new Set(succeeded.filter(pi => pi.customer).map(pi => pi.customer)).size;

  if (revenue > 0 || txCount > 0) {
    console.log(`${dayStart} -> revenue: $${(revenue / 100).toFixed(2)}, tx: ${txCount}`);
    daysWithData++;
    totalRevenue += revenue;
  }

  const { error } = await db.from('daily_snapshots').insert({
    user_id: USER_ID,
    provider: 'stripe',
    date: dayStart,
    data: { revenue, refunds, newCustomers, txCount },
  });

  if (error) {
    console.error(`Error saving ${dayStart}:`, error.message, error.code);
  }
}

console.log(`\nDone! Days with data: ${daysWithData}, Total: $${(totalRevenue / 100).toFixed(2)}`);

// Step 3: Verify
const { data: snaps } = await db
  .from('daily_snapshots')
  .select('date, data')
  .eq('user_id', USER_ID)
  .eq('provider', 'stripe')
  .order('date', { ascending: false });

console.log('\nTotal snapshots saved:', snaps?.length);
const nonZero = (snaps || []).filter(s => s.data.revenue > 0);
console.log('Non-zero days:', nonZero.length);
for (const s of nonZero) {
  console.log(' ', s.date, JSON.stringify(s.data));
}
