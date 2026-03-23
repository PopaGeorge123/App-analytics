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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  env[key] = val;
}

const db = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
const USER_ID = '07f1570e-b729-4237-a06f-eccdea3ded7d';

// Delete the corrupted integration + all stale snapshots
const { error: e1 } = await db.from('integrations').delete()
  .eq('user_id', USER_ID).eq('platform', 'stripe');
console.log('Integration deleted:', e1 ? e1.message : 'OK');

const { error: e2 } = await db.from('daily_snapshots').delete()
  .eq('user_id', USER_ID).eq('provider', 'stripe');
console.log('Snapshots deleted:', e2 ? e2.message : 'OK');

console.log('\nDone. Now reconnect Stripe via the dashboard Settings tab.');
