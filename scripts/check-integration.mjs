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

const { data } = await db
  .from('integrations')
  .select('platform, account_id, access_token, connected_at, updated_at')
  .eq('user_id', USER_ID);

for (const row of (data || [])) {
  console.log('Platform:     ', row.platform);
  console.log('Account ID:   ', row.account_id);
  console.log('Access token: ', row.access_token?.slice(0, 30) + '...');
  console.log('Connected at: ', row.connected_at);
  console.log('Updated at:   ', row.updated_at);
  console.log('---');
}
