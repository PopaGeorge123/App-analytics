#!/usr/bin/env node
/**
 * Fold Analytics — 100% Standalone Daemon (Sync + Auto-Backfill)
 * ─────────────────────────────────────────────────────────────────────────────
 * ZERO npm dependencies — only Node.js built-ins + fetch (Node 18+).
 * The only required file is .env  (path: ENV_PATH below).
 *
 * What it does:
 *   Stripe   → revenue, transactions, new customers
 *   GA4      → sessions, users, bounce rate, conversions
 *   Meta Ads → spend, reach, clicks, conversions
 *
 * ── MODES ────────────────────────────────────────────────────────────────────
 *
 *  DAEMON — recommended, runs forever:
 *    node cronscript/sync-all.mjs --daemon
 *
 *    Every 30 minutes: checks for new users with no data → backfills them
 *    Daily at 02:00 UTC: syncs yesterday's data for ALL users
 *    After daily sync:   checks alert_rules and sends email if thresholds exceeded
 *
 *  ONE-SHOT sync (yesterday + alert check, then exit):
 *    node cronscript/sync-all.mjs
 *
 *  ONE-SHOT alert check only (for testing):
 *    node cronscript/sync-all.mjs --alerts
 *
 *  ONE-SHOT backfill (full history, then exit):
 *    node cronscript/sync-all.mjs --backfill
 *    node cronscript/sync-all.mjs --backfill --user <uuid>
 *    node cronscript/sync-all.mjs --backfill --platform stripe --days 180
 *
 *  Backfill depth (default):
 *    Stripe  → 540 days (~18 months)
 *    GA4     → 90 days
 *    Meta    → 30 days
 *
 *  FILTERS (work with any mode):
 *    --user <uuid>        only this user
 *    --platform stripe    only this platform
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
const RESEND_KEY   = g('RESEND_API_KEY');
const FROM_EMAIL   = 'Fold Alerts <alerts@tryfold.io>';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI ARGS
// ─────────────────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const daemonMode   = args.includes('--daemon');  // ← recommended: loop forever
const loopMode     = args.includes('--loop');    // legacy alias for --daemon
const backfillMode = args.includes('--backfill');
const alertsOnly   = args.includes('--alerts');  // one-shot: only run alert check
const targetUser   = args.includes('--user')     ? args[args.indexOf('--user') + 1]     : null;
const targetPlat   = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : null;

// How many days to backfill per platform (override Stripe with --days N)
const BACKFILL_DAYS = {
  stripe: args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1], 10) : 540,
  ga4:    90,
  meta:   30,
};

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

  // Like select but filter can include not=null checks
  async selectWhere(table, cols, qs) {
    const p = new URLSearchParams({ select: cols, ...qs });
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

  // Fetch rows with user_id=userId AND date >= cutoff
  async selectByUserSince(table, cols, userId, dateCutoff) {
    const p = new URLSearchParams({
      select: cols,
      user_id: `eq.${userId}`,
      date: `gte.${dateCutoff}`,
    });
    const r = await fetchRetry(`SB SELECT ${table}`, `${SUPABASE_URL}/rest/v1/${table}?${p}`, { headers: SB.headers });
    if (!r.ok) throw new Error(`SB SELECT ${table}: ${r.status}`);
    return r.json();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ① STRIPE  (Stripe REST API — no SDK)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch + upsert one day of Stripe PaymentIntents */
async function syncStripeDay(userId, accessToken, date) {
  const gte = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const lte = gte + 86399;

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

  return { revenue, txCount, newCustomers };
}

/** Daily sync — yesterday only */
async function syncStripe(userId, accessToken) {
  const date = yesterday();
  const r = await syncStripeDay(userId, accessToken, date);
  return { date, ...r };
}

/** Full backfill — day by day from N days ago up to yesterday */
async function backfillStripe(userId, accessToken, days = BACKFILL_DAYS.stripe) {
  log(`  [stripe backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let i = days; i >= 1; i--) {
    const date = daysAgo(i);
    try {
      const r = await syncStripeDay(userId, accessToken, date);
      if (r.txCount > 0) {
        logOk(`  stripe ${date} — $${(r.revenue / 100).toFixed(2)} | ${r.txCount} tx`);
      }
      ok++;
    } catch (err) {
      logFail(`  stripe ${date} — ${err.message}`);
      skipped++;
    }
    // Small delay every 10 days to avoid Stripe rate limits
    if (i % 10 === 0) await sleep(500);
  }
  log(`  [stripe backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ② GA4  (Google Analytics Data API v1beta — no SDK)
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

/** Daily sync — yesterday only */
async function syncGA4(userId, integration) {
  if (!GOOGLE_ID || !GOOGLE_SEC) throw new Error('GA4: missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env');
  if (!integration.refresh_token) throw new Error('GA4: no refresh_token stored for this user');

  const token  = await refreshGoogleToken(integration.refresh_token);
  const date   = yesterday();
  const propId = integration.account_id;

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

/**
 * Full GA4 backfill — GA4 supports date ranges in a single request,
 * so we fetch all days in one API call (much faster than day-by-day).
 */
async function backfillGA4(userId, integration, days = BACKFILL_DAYS.ga4) {
  if (!GOOGLE_ID || !GOOGLE_SEC) throw new Error('GA4: missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env');
  if (!integration.refresh_token) throw new Error('GA4: no refresh_token stored for this user');

  log(`  [ga4 backfill] ${days} days for user ${userId.slice(0, 8)}`);
  const token     = await refreshGoogleToken(integration.refresh_token);
  const startDate = daysAgo(days);
  const endDate   = yesterday();
  const propId    = integration.account_id;

  const res = await fetchRetry('GA4 backfill runReport',
    `https://analyticsdata.googleapis.com/v1beta/${propId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'conversions' },
        ],
        limit: 100000,
      }),
    });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`GA4 backfill: ${e?.error?.message ?? res.status}`); }

  const body = await res.json();
  const rows = body.rows ?? [];
  log(`  [ga4 backfill] ${rows.length} days returned from GA4`);

  for (const row of rows) {
    // GA4 returns date as YYYYMMDD — convert to YYYY-MM-DD
    const rawDate = row.dimensionValues?.[0]?.value ?? '';
    const date    = rawDate.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    const mv      = row.metricValues ?? [];
    const data = {
      sessions:           parseInt(mv[0]?.value ?? '0', 10),
      users:              parseInt(mv[1]?.value ?? '0', 10),
      newUsers:           parseInt(mv[2]?.value ?? '0', 10),
      bounceRate:         parseFloat(mv[3]?.value ?? '0'),
      avgSessionDuration: parseFloat(mv[4]?.value ?? '0'),
      conversions:        parseInt(mv[5]?.value ?? '0', 10),
    };
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'ga4', date, data },
      'user_id,provider,date');
  }

  log(`  [ga4 backfill] done — ${rows.length} days saved`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ③ META ADS  (Graph API v22 — no SDK)
// ─────────────────────────────────────────────────────────────────────────────

/** Extend Meta token + persist to DB, returns fresh token string */
async function extendMetaToken(userId, accessToken) {
  if (!META_APP_ID || !META_APP_SEC) throw new Error('Meta: missing META_APP_ID / META_APP_SECRET in .env');
  const extRes = await fetchRetry('Meta token extend',
    `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SEC}&fb_exchange_token=${encodeURIComponent(accessToken)}`
  );
  if (!extRes.ok) { const e = await extRes.json().catch(() => ({})); throw new Error(`Meta token: ${e?.error?.message ?? extRes.status}`); }
  const freshToken = (await extRes.json()).access_token ?? accessToken;
  await SB.patch('integrations', { access_token: freshToken }, { user_id: userId, platform: 'meta' });
  return freshToken;
}

/** Fetch Meta Ads insights for a single day */
async function fetchMetaDay(adAccountId, token, date) {
  const insRes = await fetchRetry('Meta insights',
    `https://graph.facebook.com/v22.0/${adAccountId}/insights?fields=spend,reach,clicks,actions&time_range=${encodeURIComponent(JSON.stringify({ since: date, until: date }))}&access_token=${encodeURIComponent(token)}`
  );
  if (!insRes.ok) { const e = await insRes.json().catch(() => ({})); throw new Error(`Meta insights: ${e?.error?.message ?? insRes.status}`); }

  const d = (await insRes.json()).data?.[0] ?? {};
  return {
    spend:       parseFloat(d.spend ?? '0'),
    reach:       parseInt(d.reach   ?? '0', 10),
    clicks:      parseInt(d.clicks  ?? '0', 10),
    conversions: (d.actions ?? [])
      .filter(a => ['purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type))
      .reduce((s, a) => s + parseInt(a.value ?? '0', 10), 0),
  };
}

/** Daily sync — yesterday only */
async function syncMeta(userId, integration) {
  const freshToken  = await extendMetaToken(userId, integration.access_token);
  const date        = yesterday();
  const adAccountId = integration.account_id;
  const d           = await fetchMetaDay(adAccountId, freshToken, date);

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'meta', date, data: d },
    'user_id,provider,date');

  return { date, ...d };
}

/**
 * Full Meta backfill — day by day (Meta Ads Insights API doesn't support
 * dimension breakdowns by date in bulk the same way GA4 does, so we loop).
 */
async function backfillMeta(userId, integration, days = BACKFILL_DAYS.meta) {
  log(`  [meta backfill] ${days} days for user ${userId.slice(0, 8)}`);
  const freshToken  = await extendMetaToken(userId, integration.access_token);
  const adAccountId = integration.account_id;
  let ok = 0, skipped = 0;

  for (let i = days; i >= 1; i--) {
    const date = daysAgo(i);
    try {
      const d = await fetchMetaDay(adAccountId, freshToken, date);
      await SB.upsert('daily_snapshots',
        { user_id: userId, provider: 'meta', date, data: d },
        'user_id,provider,date');
      if (d.spend > 0) logOk(`  meta ${date} — $${d.spend} spend | ${d.clicks} clicks`);
      ok++;
    } catch (err) {
      logFail(`  meta ${date} — ${err.message}`);
      skipped++;
    }
    // Meta rate limit: ~200 req/hour per token — 500ms delay is safe
    await sleep(500);
  }
  log(`  [meta backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL HISTORICAL BACKFILL
// Run once after connecting a platform. No timeout risk — runs locally.
// ─────────────────────────────────────────────────────────────────────────────
async function runBackfill() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('BACKFILL mode — importing full history');
  if (targetUser) log(`→ User filter: ${targetUser}`);
  if (targetPlat) log(`→ Platform filter: ${targetPlat}`);

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
  log(`${userIds.length} user(s) to backfill`);

  for (let i = 0; i < userIds.length; i++) {
    const uid   = userIds[i];
    const plats = byUser[uid];
    log(`[${i + 1}/${userIds.length}] Backfilling user ${uid.slice(0, 8)}…`);

    if (plats.stripe) {
      try {
        await backfillStripe(uid, plats.stripe.access_token);
      } catch (err) { logFail(`stripe backfill: ${err.message}`); }
      await sleep(2_000);
    }

    if (plats.ga4) {
      try {
        await backfillGA4(uid, plats.ga4);
      } catch (err) { logFail(`ga4 backfill: ${err.message}`); }
      await sleep(2_000);
    }

    if (plats.meta) {
      try {
        await backfillMeta(uid, plats.meta);
      } catch (err) { logFail(`meta backfill: ${err.message}`); }
    }

    if (i < userIds.length - 1) await sleep(USER_DELAY_MS);
  }

  log('Backfill complete ✓');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
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
// AUTO-BACKFILL — detects users with no data and backfills them
// Called every CHECK_INTERVAL_MS in daemon mode.
// ─────────────────────────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // check every 30 minutes

// Tracks which (userId+platform) combos have already been backfilled this
// session so we don't repeat on every 30-min tick.
const backfilledKeys = new Set();

async function runAutoBackfill() {
  log('[auto-backfill] Checking for new users with no data…');

  // Fetch all integrations
  let rows;
  try {
    rows = await SB.select('integrations', 'user_id,platform,access_token,refresh_token,account_id');
  } catch (err) {
    logFail(`[auto-backfill] Cannot fetch integrations: ${err.message}`);
    return;
  }
  if (!rows?.length) { log('[auto-backfill] No integrations found.'); return; }

  // For each integration, check if daily_snapshots has ANY row for that user+provider
  const toBackfill = [];
  for (const row of rows) {
    const key = `${row.user_id}:${row.platform}`;
    if (backfilledKeys.has(key)) continue; // already done this session

    // Apply --user / --platform filters if set
    if (targetUser && row.user_id !== targetUser) continue;
    if (targetPlat && row.platform !== targetPlat) continue;

    try {
      const existing = await SB.select(
        'daily_snapshots',
        'id',
        { user_id: row.user_id, provider: row.platform }
      );
      if (!existing?.length) {
        toBackfill.push(row);
      } else {
        // Has data — mark as done so we skip next check
        backfilledKeys.add(key);
      }
    } catch {
      // ignore — will retry next tick
    }
  }

  if (!toBackfill.length) {
    log('[auto-backfill] All users have data. Nothing to do.');
    return;
  }

  log(`[auto-backfill] ${toBackfill.length} integration(s) need backfill`);

  // Group by user
  const byUser = {};
  for (const r of toBackfill) {
    if (!byUser[r.user_id]) byUser[r.user_id] = {};
    byUser[r.user_id][r.platform] = r;
  }

  for (const [uid, plats] of Object.entries(byUser)) {
    log(`[auto-backfill] User ${uid.slice(0, 8)} — platforms: ${Object.keys(plats).join(', ')}`);

    if (plats.stripe) {
      try {
        await backfillStripe(uid, plats.stripe.access_token);
        backfilledKeys.add(`${uid}:stripe`);
      } catch (err) { logFail(`[auto-backfill] stripe: ${err.message}`); }
      await sleep(2_000);
    }
    if (plats.ga4) {
      try {
        await backfillGA4(uid, plats.ga4);
        backfilledKeys.add(`${uid}:ga4`);
      } catch (err) { logFail(`[auto-backfill] ga4: ${err.message}`); }
      await sleep(2_000);
    }
    if (plats.meta) {
      try {
        await backfillMeta(uid, plats.meta);
        backfilledKeys.add(`${uid}:meta`);
      } catch (err) { logFail(`[auto-backfill] meta: ${err.message}`); }
    }

    await sleep(USER_DELAY_MS);
  }

  log('[auto-backfill] Done.');
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT RULES CHECK
// Run after every daily sync. Fetches all premium users with alert_rules set,
// checks thresholds against last 7d vs prev 7d data, and sends emails.
// ─────────────────────────────────────────────────────────────────────────────

/** Send a plain alert email via Resend REST API (no SDK) */
async function sendAlertEmail(toEmail, subject, bodyHtml) {
  if (!RESEND_KEY) { logWarn('[alerts] RESEND_API_KEY not set — skipping email'); return; }
  try {
    const res = await fetchRetry('Resend alert email', 'https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toEmail,
        subject,
        html: bodyHtml,
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      logWarn(`[alerts] Email send failed: ${e?.message ?? res.status}`);
    } else {
      logOk(`[alerts] Alert email sent to ${toEmail}`);
    }
  } catch (err) {
    logWarn(`[alerts] Email error: ${err.message}`);
  }
}

function buildAlertEmailHtml(alerts, email) {
  const rows = alerts.map(a => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #1e1e2e;">
        <span style="font-size:18px;margin-right:8px;">${a.icon}</span>
        <strong style="color:#f0f0f5;">${a.title}</strong><br>
        <span style="color:#8888aa;font-size:13px;">${a.detail}</span>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0d0d16;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#f87171,#f59e0b);padding:24px 28px;">
      <p style="margin:0;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.7);">Fold — Alert</p>
      <h1 style="margin:6px 0 0;font-size:22px;color:#fff;">⚠ Metric Alert Triggered</h1>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 16px;color:#8888aa;font-size:14px;">The following alert rules were triggered for your account:</p>
      <table style="width:100%;border-collapse:collapse;background:#12121a;border-radius:12px;overflow:hidden;">
        ${rows}
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${g('NEXT_PUBLIC_APP_URL') || 'https://usefold.io'}/dashboard"
           style="display:inline-block;background:#00d4aa;color:#0a0a0f;font-weight:700;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:.08em;padding:12px 28px;border-radius:10px;text-decoration:none;">
          Open Dashboard →
        </a>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #1e1e2e;text-align:center;color:#444;font-size:11px;">
      You're receiving this because you have alert rules enabled in Fold.<br>
      Manage alerts in <a href="${g('NEXT_PUBLIC_APP_URL') || 'https://usefold.io'}/dashboard" style="color:#00d4aa;text-decoration:none;">Settings → Alert Rules</a>.
    </div>
  </div>
</body></html>`;
}

async function checkAlerts() {
  log('[alerts] Checking alert rules for all premium users…');

  // 1. Fetch all premium users that have alert_rules configured
  let users;
  try {
    users = await SB.selectWhere('users', 'id,email,alert_rules', {
      is_premium: 'eq.true',
      alert_rules: 'not.is.null',
    });
  } catch (err) {
    logFail(`[alerts] Cannot fetch users: ${err.message}`);
    return;
  }

  if (!users?.length) { log('[alerts] No users with alert rules found.'); return; }

  const cutoff14 = daysAgo(14);
  const cutoff7  = daysAgo(7);

  let notified = 0;

  for (const user of users) {
    const rules = user.alert_rules;
    if (!rules) continue;

    // Skip if all thresholds are 0 (effectively disabled)
    const hasAny = rules.revenueDropPct > 0 || rules.bounceSpikeThreshold > 0 || rules.spendSpikeThreshold > 0;
    if (!hasAny) continue;

    // 2. Fetch last 14 days of snapshots for this user
    let snaps;
    try {
      snaps = await SB.selectByUserSince('daily_snapshots', 'provider,date,data', user.id, cutoff14);
    } catch (err) {
      logWarn(`[alerts] Cannot fetch snapshots for ${user.id.slice(0, 8)}: ${err.message}`);
      continue;
    }

    if (!snaps?.length) continue;

    // 3. Split into 7d vs prev-7d
    const snaps7     = snaps.filter(s => s.date >= cutoff7);
    const snapsPrev7 = snaps.filter(s => s.date <  cutoff7);

    // Helper: sum a field for a provider
    const sumField = (arr, provider, field) =>
      arr.filter(s => s.provider === provider)
         .reduce((acc, s) => acc + ((s.data?.[field]) ?? 0), 0);
    const avgField = (arr, provider, field) => {
      const rows = arr.filter(s => s.provider === provider);
      if (!rows.length) return 0;
      return rows.reduce((acc, s) => acc + ((s.data?.[field]) ?? 0), 0) / rows.length;
    };

    const revenue7     = sumField(snaps7,     'stripe', 'revenue');
    const revenuePrev  = sumField(snapsPrev7,  'stripe', 'revenue');
    const bounceRate7  = avgField(snaps7,     'ga4',    'bounceRate');
    const spend7       = sumField(snaps7,     'meta',   'spend'); // dollars (Meta stores as dollars)

    // 4. Evaluate each threshold
    const triggered = [];

    if (rules.revenueDropPct > 0 && revenuePrev > 0 && revenue7 < revenuePrev) {
      const dropPct = ((revenuePrev - revenue7) / revenuePrev) * 100;
      if (dropPct >= rules.revenueDropPct) {
        triggered.push({
          icon: '🚨',
          title: `Revenue down ${dropPct.toFixed(1)}%`,
          detail: `Last 7 days: $${(revenue7 / 100).toFixed(2)} vs $${(revenuePrev / 100).toFixed(2)} the week before (threshold: ${rules.revenueDropPct}%)`,
        });
      }
    }

    if (rules.bounceSpikeThreshold > 0 && bounceRate7 > 0) {
      // GA4 bounceRate is stored as a decimal (0–1) in sync, multiply by 100 for %
      const bounceRatePct = bounceRate7 <= 1 ? bounceRate7 * 100 : bounceRate7;
      if (bounceRatePct > rules.bounceSpikeThreshold) {
        triggered.push({
          icon: '⚠',
          title: `Bounce rate spike: ${bounceRatePct.toFixed(1)}%`,
          detail: `7-day average bounce rate exceeded your ${rules.bounceSpikeThreshold}% threshold`,
        });
      }
    }

    if (rules.spendSpikeThreshold > 0 && spend7 > 0) {
      const avgDailySpend = spend7 / 7; // Meta stores dollars directly
      if (avgDailySpend > rules.spendSpikeThreshold) {
        triggered.push({
          icon: '💸',
          title: `Ad spend cap exceeded: $${avgDailySpend.toFixed(2)}/day avg`,
          detail: `Average daily Meta Ads spend exceeded your $${rules.spendSpikeThreshold} cap`,
        });
      }
    }

    if (!triggered.length) {
      logOk(`[alerts] User ${user.id.slice(0, 8)} — no thresholds exceeded`);
      continue;
    }

    log(`[alerts] User ${user.id.slice(0, 8)} — ${triggered.length} alert(s) triggered`);
    triggered.forEach(t => log(`  → ${t.icon} ${t.title}`));

    const subject = triggered.length === 1
      ? `Fold Alert: ${triggered[0].title}`
      : `Fold Alert: ${triggered.length} metrics need attention`;

    await sendAlertEmail(
      user.email,
      subject,
      buildAlertEmailHtml(triggered, user.email)
    );
    notified++;
  }

  log(`[alerts] Done — ${notified} user(s) notified`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
if (backfillMode) {
  // Manual one-shot full backfill, then exit
  await runBackfill();

} else if (alertsOnly) {
  // Manual one-shot alert check only, then exit
  await checkAlerts();

} else if (daemonMode || loopMode) {
  // ── DAEMON MODE ─────────────────────────────────────────────────────────
  // Runs forever:
  //   • Every 30 min  → check for new users with no data → backfill them
  //   • Daily 02:00 UTC → sync yesterday for all users
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('DAEMON started.');
  log(`  • Auto-backfill check: every ${CHECK_INTERVAL_MS / 60000} minutes`);
  log(`  • Daily sync:          02:00 UTC`);
  log(`  • Alert rules check:   after every daily sync`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Immediate first run
  await runAutoBackfill();
  await runSync();
  await checkAlerts();

  // 2. Auto-backfill loop — every 30 minutes
  setInterval(async () => {
    try { await runAutoBackfill(); } catch (e) { logFail(`[auto-backfill loop] ${e.message}`); }
  }, CHECK_INTERVAL_MS);

  // 3. Daily sync + alert check at 02:00 UTC
  scheduleDailyAt(DAILY_UTC_HOUR, async () => {
    await runSync();
    await checkAlerts();
  }, 'daily-sync+alerts');

} else {
  // One-shot: sync yesterday + check alerts, then exit
  await runSync();
  await checkAlerts();
}
