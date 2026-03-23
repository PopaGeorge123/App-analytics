import { createClient } from '@supabase/supabase-js';
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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const db = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
const USER_ID = '07f1570e-b729-4237-a06f-eccdea3ded7d';

const { data: snaps, error } = await db
  .from('daily_snapshots')
  .select('*')
  .eq('user_id', USER_ID)
  .eq('provider', 'stripe')
  .order('date', { ascending: false });

if (error) {
  console.error('Error:', error.message);
} else {
  console.log(`Stripe snapshots in DB: ${snaps.length}`);
  const withData = snaps.filter(s => s.data?.revenue > 0 || s.data?.txCount > 0);
  console.log(`Days with actual data: ${withData.length}`);
  for (const s of withData) {
    console.log(`  ${s.date}: revenue=$${(s.data.revenue / 100).toFixed(2)}, tx=${s.data.txCount}`);
  }
}

const { data: integration } = await db
  .from('integrations')
  .select('platform, account_id, created_at, updated_at')
  .eq('user_id', USER_ID)
  .single();

console.log('\nIntegration:', integration);
