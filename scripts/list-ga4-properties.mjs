import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const { data: integration } = await db
  .from('integrations')
  .select('access_token, refresh_token')
  .eq('user_id', USER_ID)
  .eq('platform', 'ga4')
  .single();

if (!integration) { console.error('No GA4 integration'); process.exit(1); }

const oauth2 = new google.auth.OAuth2(env['GOOGLE_CLIENT_ID'], env['GOOGLE_CLIENT_SECRET']);
oauth2.setCredentials({
  access_token: integration.access_token,
  refresh_token: integration.refresh_token,
});

const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: oauth2 });

const accountsRes = await analyticsAdmin.accounts.list();
console.log('Accounts:', JSON.stringify(accountsRes.data.accounts, null, 2));

for (const account of accountsRes.data.accounts ?? []) {
  const propsRes = await analyticsAdmin.properties.list({ filter: `parent:${account.name}` });
  console.log('\nProperties for', account.name, ':');
  for (const prop of propsRes.data.properties ?? []) {
    console.log(JSON.stringify(prop, null, 2));
  }
}
