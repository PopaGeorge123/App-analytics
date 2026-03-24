#!/usr/bin/env node
/**
 * Fold Analytics — 100% Standalone Daily Sync
 * ─────────────────────────────────────────────────────────────────────────────
 * ZERO npm dependencies — only Node.js built-ins + fetch (Node 18+).
 * The only required file is .env  (path: ENV_PATH below).
 *
 * What it syncs:
 *   Stripe   → revenue, transactions, new customers (yesterday)
 *   GA4      → sessions, users, bounce rate, conversions (yesterday)
 *   Meta Ads → spend, reach, clicks, conversions (yesterday)
 *
 * Internal cron scheduler — no external cron library needed.
 * In --loop mode it runs immediately then repeats at 02:00 UTC every day.
 *
 * Usage:
 *   node cronscript/sync-all.mjs                     # run once, all users
 *   node cronscript/sync-all.mjs --loop              # daemon, repeats at 02:00 UTC
 *   node cronscript/sync-all.mjs --user <uuid>       # one user only
 *   node cronscript/sync-all.mjs --platform stripe   # one platform only
 *
 * System cron (runs at 02:00 UTC daily — no --loop needed):
 *   0 2 * * * /usr/local/bin/node /path/to/cronscript/sync-all.mjs >> /tmp/fold-sync.log 2>&1
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const ENV_PATH          = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const USER_DELAY_MS     = 5_000;   // ms between each user (rate-limit buffer)
const PLATFORM_DELAY_MS = 2_000;   // ms between platforms per user
const MAX_RETRIES       = 3;       // retries on 429 / network errors
const DAILY_UTC_HOUR    = 2;       // hour to run in --loop mode (02:00 UTC)

// ─────────────────────────────────────────────────────────────────────────────
// LOAD .ENV  (pure Node — no dotenv package)
// ─────────────────────────────────────────────────────────────────────────────
const env = {};
try {
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    let val   = t.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[key] = val;
  }
  console.log(`[env] Loaded ${Object.keys(env).length} vars from ${ENV_PATH}`);
} catch (e) {
  console.warn(`[env] Could not read .env — falling back to process.env (${e.message})`);
}

const g = (k) => env[k] ?? process.env[k] ?? '';

const SUPABASE_URL = g('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY  = g('SUPABASE_SERVICE_ROLE_KEY');
const GOOGLE_ID    = g('GOOGLE_CLIENT_ID');
const GOOGLE_SEC   = g('GOOGLE_CLIENT_SECRET');
const META_APP_ID  = g('META_APP_ID');
const META_APP_SEC = g('META_APP_SECRET');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI ARGS
// ─────────────────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2);
const loopMode   = args.includes('--loop');
const targetUser = args.includes('--user')     ? args[args.indexOf('--user') + 1]     : null;
const targetPlat = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : null;

// ─────────────────────────────────────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────────────────────────────────────
const ts   = () => new Date().toISOString();
const log  = (m) => console.log(`[${ts()}] ${m}`);
const logOk   = (m) => console.log(`[${ts()}]   ✓ ${m}`);
const logWarn = (m) => console.log(`[${ts()}]   ⚠ ${m}`);
const logFail = (m) => console.log(`[${ts()}]   ✗ ${m}`);

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
const yesterday = () => daysAgo(1);

/** fetch with exponential back-off on 429 and network errors */
async function fetchRetry(label, url, opts = {}, attempt = 1) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw new Error(`${label}: network error — ${err.message}`);
    const wait = Math.pow(2, attempt) * 2_000;
    logWarn(`${label}: network error, retry ${attempt}/${MAX_RETRIES} in ${wait / 1000}s`);
    await sleep(wait);
    return fetchRetry(label, url, opts, attempt + 1);
  }
  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new Error(`${label}: rate-limited after ${MAX_RETRIES} retries`);
    const wait = Math.pow(3, attempt) * 10_000; // 10s → 30s → 90s
    logWarn(`${label}: 429 rate-limited, retry ${attempt}/${MAX_RETRIES} in ${wait / 1000}s`);
    await sleep(wait);
    return fetchRetry(label, url, opts, attempt + 1);
  }
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE REST  (no SDK — pure fetch against PostgREST)
// ─────────────────────────────────────────────────────────────────────────────
const SB = {
  headers: {
    apikey:          SERVICE_KEY,
    Authorization:   `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    Prefer:          'return=minimal',
  },

  async select(table, cols = '*', filters = {}) {
    const p = new URLSearchParams({ select: cols });
    for (const [k, v] of Object.entries(filters)) p.append(k, `eq.${v}`);
    const r = await fetchRetry(`SB SELECT ${table}`, `${SUPABASE_URL}/rest/v1/${table}?${p}`, { headers: SB.headers });
    if (!r.ok) throw new Error(`SB SELECT ${table}: ${r.status}`);
    return r.json();
  },

  async upsert(table, row, onConflict) {
    const r = await fetchRetry(`SB UPSERT ${table}`, `${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...SB.headers, Prefer: 'resolution=merge-duplicates,return=minimal', ...(onConflict ? { 'on-conflict': onConflict } : {}) },
      body: JSON.stringify(row),
    });
    if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`SB UPSERT ${table}: ${r.status} ${b}`); }
  },

  async patch(table, data, filters = {}) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) p.append(k, `eq.${v}`);
    const r = await fetchRetry(`SB PATCH ${table}`, `${SUPABASE_URL}/rest/v1/${table}?${p}`, {
      method: 'PATCH',
      headers: SB.headers,
      body: JSON.stringify(data),
    });
    if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`SB PATCH ${table}: ${r.status} ${b}`); }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ① STRIPE SYNC  (Stripe REST API — no SDK)
// ─────────────────────────────────────────────────────────────────────────────
async function syncStripe(userId, accessToken) {
  const date = yesterday();
  const gte  = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const lte  = gte + 86399;

  // Paginate through all PaymentIntents for yesterday
  const intents = [];
  let startingAfter = null;
  while (true) {
    const p = new URLSearchParams({ 'created[gte]': gte, 'created[lte]': lte, limit: '100' });
    if (startingAfter) p.set('starting_after', startingAfter);

    const res = await fetchRetry('Stripe paymentIntents', `https://api.stripe.com/v1/payment_intents?${p}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Stripe-Version': '2024-12-18.acacia' },
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Stripe: ${e?.error?.message ?? res.status}`); }

    const page = await res.json();
    intents.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data.at(-1).id;
  }

  const succeeded    = intents.filter(pi => pi.status === 'succeeded');
  const revenue      = succeeded.reduce((s, pi) => s + (pi.amount_received ?? 0), 0);
  const txCount      = succeeded.length;
  const newCustomers = new Set(succeeded.filter(pi => pi.customer).map(pi => String(pi.customer))).size;

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'stripe', date, data: { revenue, refunds: 0, newCustomers, txCount } },
    'user_id,provider,date');

  return { date, revenue, txCount, newCustomers };
}

// ─────────────────────────────────────────────────────────────────────────────
// ② GA4 SYNC  (Google Analytics Data API v1beta — no SDK)
// ─────────────────────────────────────────────────────────────────────────────
async function refreshGoogleToken(refreshToken) {
  const res = await fetchRetry('Google token refresh', 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: GOOGLE_ID, client_secret: GOOGLE_SEC }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`GA4 token: ${e.error_description ?? e.error ?? res.status}`); }
  return (await res.json()).access_token;
}

async function syncGA4(userId, integration) {
  if (!GOOGLE_ID || !GOOGLE_SEC) throw new Error('GA4: missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env');
  if (!integration.refresh_token) throw new Error('GA4: no refresh_token stored for this user');

  const token  = await refreshGoogleToken(integration.refresh_token);
  const date   = yesterday();
  const propId = integration.account_id; // "properties/XXXXXXXXX"

  const res = await fetchRetry('GA4 runReport',
    `https://analyticsdata.googleapis.com/v1beta/${propId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: date, endDate: date }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'bounceRate' }, { name: 'conversions' }],
      }),
    });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`GA4 runReport: ${e?.error?.message ?? res.status}`); }

  const body = await res.json();
  const row  = body.rows?.[0]?.metricValues ?? [];
  const sessions    = parseInt(row[0]?.value ?? '0', 10);
  const totalUsers  = parseInt(row[1]?.value ?? '0', 10);
  const bounceRate  = parseFloat(row[2]?.value ?? '0');
  const conversions = parseInt(row[3]?.value ?? '0', 10);

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'ga4', date, data: { sessions, users: totalUsers, bounceRate, conversions } },
    'user_id,provider,date');

  return { date, sessions, totalUsers, bounceRate, conversions };
}

// ─────────────────────────────────────────────────────────────────────────────
// ③ META ADS SYNC  (Graph API v22 — no SDK)
// ─────────────────────────────────────────────────────────────────────────────
async function syncMeta(userId, integration) {
  if (!META_APP_ID || !META_APP_SEC) throw new Error('Meta: missing META_APP_ID / META_APP_SECRET in .env');

  // Extend token so it stays alive (long-lived tokens last 60 days)
  const extRes = await fetchRetry('Meta token extend',
    `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SEC}&fb_exchange_token=${encodeURIComponent(integration.access_token)}`
  );
  if (!extRes.ok) { const e = await extRes.json().catch(() => ({})); throw new Error(`Meta token: ${e?.error?.message ?? extRes.status}`); }
  const freshToken = (await extRes.json()).access_token ?? integration.access_token;

  // Persist refreshed token
  await SB.patch('integrations', { access_token: freshToken }, { user_id: userId, platform: 'meta' });

  const date        = yesterday();
  const adAccountId = integration.account_id; // "act_XXXXXXXXXX"

  const insRes = await fetchRetry('Meta insights',
    `https://graph.facebook.com/v22.0/${adAccountId}/insights?fields=spend,reach,clicks,actions&time_range=${encodeURIComponent(JSON.stringify({ since: date, until: date }))}&access_token=${encodeURIComponent(freshToken)}`
  );
  if (!insRes.ok) { const e = await insRes.json().catch(() => ({})); throw new Error(`Meta insights: ${e?.error?.message ?? insRes.status}`); }

  const d           = (await insRes.json()).data?.[0] ?? {};
  const spend       = parseFloat(d.spend ?? '0');
  const reach       = parseInt(d.reach   ?? '0', 10);
  const clicks      = parseInt(d.clicks  ?? '0', 10);
  const conversions = (d.actions ?? [])
    .filter(a => ['purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type))
    .reduce((s, a) => s + parseInt(a.value ?? '0', 10), 0);

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'meta', date, data: { spend, reach, clicks, conversions } },
    'user_id,provider,date');

  return { date, spend, reach, clicks, conversions };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL CRON SCHEDULER  (no cron library)
// Schedules fn to run at a fixed UTC hour every day.
// ─────────────────────────────────────────────────────────────────────────────
function scheduleDailyAt(utcHour, fn, label) {
  async function tick() {
    const now     = new Date();
    const nextRun = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0, 0));
    if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    const msUntil = nextRun - now;
    log(`[cron] "${label}" scheduled for ${nextRun.toISOString()} (in ${Math.round(msUntil / 60000)} min)`);
    await sleep(msUntil);
    log(`[cron] "${label}" firing`);
    try { await fn(); } catch (e) { logFail(`[cron] "${label}" error: ${e.message}`); }
    tick(); // schedule next day
  }
  tick();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SYNC RUN
// ─────────────────────────────────────────────────────────────────────────────
async function runSync() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`Sync started — target date: ${yesterday()}`);
  if (targetUser) log(`→ User filter: ${targetUser}`);
  if (targetPlat) log(`→ Platform filter: ${targetPlat}`);

  // Fetch integrations from Supabase
  const filters = {};
  if (targetUser) filters.user_id  = targetUser;
  if (targetPlat) filters.platform = targetPlat;

  let rows;
  try {
    rows = await SB.select('integrations', 'user_id,platform,access_token,refresh_token,account_id', filters);
  } catch (err) {
    logFail(`Cannot fetch integrations: ${err.message}`);
    return;
  }

  if (!rows?.length) { log('ℹ  No integrations found.'); return; }

  // Group by user
  const byUser = {};
  for (const r of rows) {
    if (!byUser[r.user_id]) byUser[r.user_id] = {};
    byUser[r.user_id][r.platform] = r;
  }

  const userIds = Object.keys(byUser);
  log(`${userIds.length} user(s), ${rows.length} integration(s)`);

  let ok = 0, fail = 0;

  for (let i = 0; i < userIds.length; i++) {
    const uid   = userIds[i];
    const plats = byUser[uid];
    log(`[${i + 1}/${userIds.length}] User ${uid.slice(0, 8)} (${Object.keys(plats).join(', ')})`);

    for (const platform of ['stripe', 'ga4', 'meta']) {
      if (!plats[platform]) continue;
      try {
        if (platform === 'stripe') {
          const r = await syncStripe(uid, plats.stripe.access_token);
          logOk(`stripe — ${r.date} | $${(r.revenue / 100).toFixed(2)} revenue | ${r.txCount} tx | ${r.newCustomers} new customers`);
        } else if (platform === 'ga4') {
          const r = await syncGA4(uid, plats.ga4);
          logOk(`ga4    — ${r.date} | ${r.sessions} sessions | ${r.totalUsers} users | ${(r.bounceRate * 100).toFixed(1)}% bounce`);
        } else if (platform === 'meta') {
          const r = await syncMeta(uid, plats.meta);
          logOk(`meta   — ${r.date} | $${r.spend} spend | ${r.reach} reach | ${r.clicks} clicks`);
        }
        ok++;
      } catch (err) {
        logFail(`${platform} — ${err.message}`);
        fail++;
      }
      await sleep(PLATFORM_DELAY_MS);
    }

    if (i < userIds.length - 1) {
      log(`  ⏳ ${USER_DELAY_MS / 1000}s before next user…`);
      await sleep(USER_DELAY_MS);
    }
  }

  log(`Done — ✓ ${ok} OK  ✗ ${fail} failed`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
if (loopMode) {
  log(`Mode: daemon — running now, then daily at ${String(DAILY_UTC_HOUR).padStart(2, '0')}:00 UTC`);
  await runSync();
  scheduleDailyAt(DAILY_UTC_HOUR, runSync, 'daily-sync');
} else {
  await runSync();
}
