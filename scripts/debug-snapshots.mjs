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

// Try a plain insert first to see the error
const { data, error } = await db.from('daily_snapshots').insert({
  user_id: USER_ID,
  provider: 'stripe',
  date: '2026-03-22',
  data: { revenue: 3800, refunds: 0, newCustomers: 1, txCount: 2 }
});

if (error) {
  console.log('INSERT error:', error.message, error.code, error.details);
} else {
  console.log('INSERT success:', data);
}

// Check all rows in daily_snapshots regardless of user
const { data: all, error: e2 } = await db.from('daily_snapshots').select('*').limit(10);
if (e2) {
  console.log('SELECT error:', e2.message);
} else {
  console.log('All rows in daily_snapshots:', all?.length, all);
}
