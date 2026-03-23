// Backfill using the OAuth access_token of the connected account (not STRIPE_SECRET_KEY)
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  env[key] = val;
}

const db = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
const USER_ID = '07f1570e-b729-4237-a06f-eccdea3ded7d';

// Read the actual OAuth token stored for this user
const { data: integration, error: intErr } = await db
  .from('integrations')
  .select('access_token, account_id')
  .eq('user_id', USER_ID)
  .eq('platform', 'stripe')
  .single();

if (intErr || !integration) {
  console.error('No integration found:', intErr?.message);
  process.exit(1);
}

console.log('Using account_id:', integration.account_id);
console.log('Using token:     ', integration.access_token.slice(0, 25) + '...');
console.log('');

const stripe = new Stripe(integration.access_token, { apiVersion: '2024-12-18.acacia' });

// Verify token is valid and shows the right account
try {
  const account = await stripe.accounts.retrieve(integration.account_id);
  console.log('Account email:', account.email || '(no email)');
  console.log('Account business:', account.business_profile?.name || account.settings?.dashboard?.display_name || '(no name)');
  console.log('');
} catch (e) {
  // If retrieve fails, try listing payment intents directly
  console.log('Note: Could not retrieve account details, proceeding with backfill...\n');
}

// Check how many payment intents exist on this account
const testIntents = [];
for await (const pi of stripe.paymentIntents.list({ limit: 10 })) {
  testIntents.push(pi);
}
console.log(`PaymentIntents on this account (last 10): ${testIntents.length}`);
for (const pi of testIntents) {
  const d = new Date(pi.created * 1000).toISOString().slice(0, 10);
  console.log(`  ${d} ${pi.status} $${(pi.amount / 100).toFixed(2)}`);
}
console.log('');

// Delete existing snapshots
const { error: delErr } = await db.from('daily_snapshots').delete()
  .eq('user_id', USER_ID).eq('provider', 'stripe');
console.log('Cleared old snapshots:', delErr ? delErr.message : 'OK');

// Backfill 90 days
function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const DAYS = 200;
let daysWithData = 0;

for (let i = DAYS; i >= 0; i--) {
  const dayStart = daysAgo(i);
  const gte = Math.floor(new Date(dayStart + 'T00:00:00Z').getTime() / 1000);
  // For today (i=0) use current time as upper bound, otherwise end of day
  const lte = i === 0
    ? Math.floor(Date.now() / 1000)
    : gte + 86400 - 1;

  const intents = [];
  for await (const pi of stripe.paymentIntents.list({ created: { gte, lte }, limit: 100 })) {
    intents.push(pi);
  }

  const succeeded = intents.filter(pi => pi.status === 'succeeded');
  const revenue = succeeded.reduce((s, pi) => s + pi.amount_received, 0);
  const txCount = succeeded.length;
  const newCustomers = new Set(succeeded.filter(pi => pi.customer).map(pi => String(pi.customer))).size;

  if (revenue > 0 || txCount > 0) {
    console.log(`${dayStart} → $${(revenue / 100).toFixed(2)}, tx: ${txCount}`);
    daysWithData++;
  }

  const { error } = await db.from('daily_snapshots').insert({
    user_id: USER_ID,
    provider: 'stripe',
    date: dayStart,
    data: { revenue, refunds: 0, newCustomers, txCount },
  });

  if (error) console.error(`Error ${dayStart}:`, error.message);
}

console.log(`\n✅ Done. Days with data: ${daysWithData}`);
