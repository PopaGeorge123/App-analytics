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
 *   PayPal   → revenue, transactions, fees, net revenue
 *
 * ── MODES ────────────────────────────────────────────────────────────────────
 *
 *  DAEMON — recommended, runs forever:
 *    node cronscript/sync-all.mjs --daemon
 *
 *    Every 30 minutes: checks for new users with no data → backfills them
 *    Daily at 02:00 UTC: syncs yesterday's data for ALL users
 *    After daily sync:   checks alert_rules and sends email if thresholds exceeded
 *    After alert check:  runs anomaly detection (25%/50% deviation vs 7d avg)
 *                        → writes to `notifications` table + emails critical alerts
 *    After anomaly check: checks goals & KPIs, sends digest emails
 *
 *  ONE-SHOT sync (yesterday + alert check, then exit):
 *    node cronscript/sync-all.mjs
 *
 *  ONE-SHOT alert check only (for testing):
 *    node cronscript/sync-all.mjs --alerts
 *    (runs checkAlerts + runAnomalyAlerts + checkGoals, then exits)
 *
 *  ONE-SHOT backfill (full history, then exit):
 *    node cronscript/sync-all.mjs --backfill
 *    node cronscript/sync-all.mjs --backfill --user <uuid>
 *    node cronscript/sync-all.mjs --backfill --platform stripe --days 180
 *
 *  Backfill depth (default):
 *    Stripe  → 365 days (parallel batches of 10 — override with --days N)
 *    GA4     → 365 days (single batched API call)
 *    Meta    → 365 days (parallel batches of 5)
 *
 *  FILTERS (work with any mode):
 *    --user <uuid>        only this user
 *    --platform stripe    only this platform
 *
 * ── HTTP TRIGGER SERVER ──────────────────────────────────────────────────────
 *  When running in --daemon mode, a lightweight HTTP server starts on
 *  TRIGGER_PORT (default: 4242).  The Next.js app POSTs to it after every
 *  OAuth connect so the user sees fresh data immediately.
 *
 *  Required .env vars on this server:
 *    SYNC_SECRET    – shared secret (must match SYNC_SECRET in Next.js .env)
 *    TRIGGER_PORT   – port to listen on (default: 4242)
 *
 *  Example:  POST http://localhost:4242/sync-trigger
 *            Authorization: Bearer <SYNC_SECRET>
 *            { "userId": "...", "platform": "meta" }
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const ENV_PATH          = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const USER_DELAY_MS     = 500;    // ms between user batches (soft rate-limit buffer)
const PLATFORM_DELAY_MS = 300;    // ms between platforms (kept for sequential fallback only)
const USER_CONCURRENCY  = 5;      // how many users to sync in parallel
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
const META_APP_ID      = g('META_APP_ID');
const META_APP_SEC     = g('META_APP_SECRET');
const PAYPAL_CLIENT_ID = g('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SEC = g('PAYPAL_CLIENT_SECRET');
const RESEND_KEY       = g('RESEND_API_KEY');
const ANTHROPIC_KEY    = g('ANTHROPIC_API_KEY');
const FROM_EMAIL   = 'Fold Alerts <info@usefold.io>';
const FROM_DIGEST  = 'Fold Digest <info@usefold.io>';

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
const digestOnly   = args.includes('--digest');  // one-shot: only run digest send
const targetUser   = args.includes('--user')     ? args[args.indexOf('--user') + 1]     : null;
const targetPlat   = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : null;

// How many days to backfill per platform (override with --days N)
const BACKFILL_DAYS = {
  stripe: args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1], 10) : 365,
  ga4:    365,
  meta:   365,
  paypal: 365,
  paddle: 365,
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
    Prefer:          'return=minimal', // used by upsert/patch only — select methods override this
  },

  async select(table, cols = '*', filters = {}) {
    const p = new URLSearchParams({ select: cols });
    for (const [k, v] of Object.entries(filters)) p.append(k, `eq.${v}`);
    // Note: do NOT send 'Prefer: return=minimal' on GET — PostgREST would return an empty body.
    const getHeaders = { apikey: SB.headers.apikey, Authorization: SB.headers.Authorization };
    const r = await fetchRetry(`SB SELECT ${table}`, `${SUPABASE_URL}/rest/v1/${table}?${p}`, { headers: getHeaders });
    if (!r.ok) throw new Error(`SB SELECT ${table}: ${r.status}`);
    return r.json();
  },

  // Like select but filter can include not=null checks
  async selectWhere(table, cols, qs) {
    const p = new URLSearchParams({ select: cols, ...qs });
    const getHeaders = { apikey: SB.headers.apikey, Authorization: SB.headers.Authorization };
    const r = await fetchRetry(`SB SELECT ${table}`, `${SUPABASE_URL}/rest/v1/${table}?${p}`, { headers: getHeaders });
    if (!r.ok) throw new Error(`SB SELECT ${table}: ${r.status}`);
    return r.json();
  },

  async upsert(table, row, onConflict) {
    const url = onConflict
      ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`
      : `${SUPABASE_URL}/rest/v1/${table}`;
    const r = await fetchRetry(`SB UPSERT ${table}`, url, {
      method: 'POST',
      headers: { ...SB.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
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

  async insert(table, row) {
    const r = await fetchRetry(`SB INSERT ${table}`, `${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...SB.headers, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (!r.ok) { const b = await r.text().catch(() => ''); throw new Error(`SB INSERT ${table}: ${r.status} ${b}`); }
  },

  // Fetch rows with user_id=userId AND date >= cutoff
  async selectByUserSince(table, cols, userId, dateCutoff) {
    const p = new URLSearchParams({
      select: cols,
      user_id: `eq.${userId}`,
      date: `gte.${dateCutoff}`,
    });
    const getHeaders = { apikey: SB.headers.apikey, Authorization: SB.headers.Authorization };
    const r = await fetchRetry(`SB SELECT ${table}`, `${SUPABASE_URL}/rest/v1/${table}?${p}`, { headers: getHeaders });
    if (!r.ok) throw new Error(`SB SELECT ${table}: ${r.status}`);
    return r.json();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ① STRIPE  (Stripe REST API — no SDK)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch + upsert one day of Stripe data (payments + subscriptions + customers) */
async function syncStripeDay(userId, accessToken, date) {
  const gte = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const lte = gte + 86399;
  const stripeHeaders = { Authorization: `Bearer ${accessToken}`, 'Stripe-Version': '2024-12-18.acacia' };

  // ── 1. PaymentIntents for this day ──────────────────────────────────────
  const intents = [];
  let startingAfter = null;
  while (true) {
    const p = new URLSearchParams({ 'created[gte]': gte, 'created[lte]': lte, limit: '100' });
    if (startingAfter) p.set('starting_after', startingAfter);
    const res = await fetchRetry('Stripe paymentIntents', `https://api.stripe.com/v1/payment_intents?${p}`, { headers: stripeHeaders });
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

  // ── 2. Refunds for this day ──────────────────────────────────────────────
  let refunds = 0;
  try {
    const refundItems = [];
    let ra = null;
    while (true) {
      const p = new URLSearchParams({ 'created[gte]': gte, 'created[lte]': lte, limit: '100' });
      if (ra) p.set('starting_after', ra);
      const res = await fetchRetry('Stripe refunds', `https://api.stripe.com/v1/refunds?${p}`, { headers: stripeHeaders });
      if (!res.ok) break;
      const page = await res.json();
      refundItems.push(...page.data);
      if (!page.has_more) break;
      ra = page.data.at(-1).id;
    }
    refunds = refundItems.reduce((s, r) => s + (r.amount ?? 0), 0);
  } catch (_) { /* refunds optional */ }

  // ── 3. Active subscriptions snapshot (current state) ────────────────────
  // We fetch all active + trialing subscriptions to compute MRR.
  let activeSubscriptions = 0;
  let mrr = 0; // in cents
  let trialingSubscriptions = 0;
  try {
    for (const status of ['active', 'trialing']) {
      let sa = null;
      while (true) {
        const p = new URLSearchParams({ status, limit: '100', expand: 'data.items.data.price' });
        if (sa) p.set('starting_after', sa);
        const res = await fetchRetry(`Stripe subscriptions(${status})`, `https://api.stripe.com/v1/subscriptions?${p}`, { headers: stripeHeaders });
        if (!res.ok) break;
        const page = await res.json();
        for (const sub of page.data) {
          if (status === 'active') activeSubscriptions++;
          if (status === 'trialing') trialingSubscriptions++;
          // MRR: normalise each item's price to monthly
          for (const item of (sub.items?.data ?? [])) {
            const price = item.price ?? {};
            const unitAmount = price.unit_amount ?? 0;
            const qty = item.quantity ?? 1;
            const interval = price.recurring?.interval ?? 'month';
            const intervalCount = price.recurring?.interval_count ?? 1;
            // Convert to monthly equivalent
            let monthlyAmount = 0;
            if (interval === 'month')  monthlyAmount = (unitAmount * qty) / intervalCount;
            else if (interval === 'year')  monthlyAmount = (unitAmount * qty) / (intervalCount * 12);
            else if (interval === 'week')  monthlyAmount = (unitAmount * qty * 52) / (intervalCount * 12);
            else if (interval === 'day')   monthlyAmount = (unitAmount * qty * 365) / (intervalCount * 12);
            mrr += Math.round(monthlyAmount);
          }
        }
        if (!page.has_more) break;
        sa = page.data.at(-1).id;
      }
    }
  } catch (_) { /* subscriptions optional */ }

  // ── 4. Subscriptions canceled today (churn) ─────────────────────────────
  let churnedToday = 0;
  try {
    let sa = null;
    while (true) {
      const p = new URLSearchParams({ status: 'canceled', 'canceled_at[gte]': gte, 'canceled_at[lte]': lte, limit: '100' });
      if (sa) p.set('starting_after', sa);
      const res = await fetchRetry('Stripe canceled subs', `https://api.stripe.com/v1/subscriptions?${p}`, { headers: stripeHeaders });
      if (!res.ok) break;
      const page = await res.json();
      churnedToday += page.data.length;
      if (!page.has_more) break;
      sa = page.data.at(-1).id;
    }
  } catch (_) { /* churn optional */ }

  // ── 5. Total customer count (current state) ──────────────────────────────
  let totalCustomers = 0;
  try {
    const res = await fetchRetry('Stripe customers count', `https://api.stripe.com/v1/customers?limit=1`, { headers: stripeHeaders });
    if (res.ok) {
      const page = await res.json();
      // Stripe doesn't give a total count directly, but we can use list metadata
      // total_count is not available in list — we store what we have
      totalCustomers = page.data?.length ?? 0; // fallback: store page count, backfill will aggregate
    }
  } catch (_) { /* optional */ }

  // ARPU = MRR / activeSubscriptions (in cents)
  const arpu = activeSubscriptions > 0 ? Math.round(mrr / activeSubscriptions) : 0;

  await SB.upsert('daily_snapshots',
    {
      user_id: userId, provider: 'stripe', date,
      data: {
        revenue, refunds, newCustomers, txCount,
        mrr, activeSubscriptions, trialingSubscriptions,
        churnedToday, arpu,
      }
    },
    'user_id,provider,date');

  // ── 6. Upsert individual customer records ───────────────────────────────
  // Collect all unique customer IDs that appear in today's succeeded intents.
  // Then fetch their full profiles from Stripe and upsert into the customers table.
  // We also pull their total lifetime charges so the LTV stays accurate.
  try {
    const customerIds = [...new Set(
      succeeded.filter(pi => pi.customer).map(pi => String(pi.customer))
    )];

    for (const cusId of customerIds) {
      try {
        // Fetch customer profile
        const cusRes = await fetchRetry(`Stripe customer ${cusId}`,
          `https://api.stripe.com/v1/customers/${cusId}`, { headers: stripeHeaders });
        if (!cusRes.ok) continue;
        const cus = await cusRes.json();

        // Compute LTV: sum all succeeded charges for this customer (up to 100)
        let totalSpent = 0;
        let orderCount = 0;
        let firstSeenTs = null;
        let lastSeenTs  = null;

        const chargesRes = await fetchRetry(`Stripe charges ${cusId}`,
          `https://api.stripe.com/v1/charges?customer=${cusId}&limit=100&status=succeeded`,
          { headers: stripeHeaders });
        if (chargesRes.ok) {
          const chargesBody = await chargesRes.json();
          for (const ch of (chargesBody.data ?? [])) {
            totalSpent += ch.amount_captured ?? ch.amount ?? 0;
            orderCount += 1;
            if (!firstSeenTs || ch.created < firstSeenTs) firstSeenTs = ch.created;
            if (!lastSeenTs  || ch.created > lastSeenTs)  lastSeenTs  = ch.created;
          }
        }

        // Check if customer has an active subscription
        const subsRes = await fetchRetry(`Stripe subs ${cusId}`,
          `https://api.stripe.com/v1/subscriptions?customer=${cusId}&limit=10`,
          { headers: stripeHeaders });
        let subscribed = false;
        let churned    = false;
        if (subsRes.ok) {
          const subsBody = await subsRes.json();
          const subs = subsBody.data ?? [];
          subscribed = subs.some(s => s.status === 'active' || s.status === 'trialing');
          churned    = !subscribed && subs.some(s => s.status === 'canceled');
        }

        const firstSeen = firstSeenTs
          ? new Date(firstSeenTs * 1000).toISOString().slice(0, 10)
          : date;
        const lastSeen  = lastSeenTs
          ? new Date(lastSeenTs  * 1000).toISOString().slice(0, 10)
          : date;

        await SB.upsert('customers', {
          user_id:    userId,
          provider:   'stripe',
          provider_id: cusId,
          email:      cus.email   ?? null,
          name:       cus.name    ?? null,
          total_spent: totalSpent,
          order_count: orderCount,
          first_seen:  firstSeen,
          last_seen:   lastSeen,
          subscribed,
          churned,
        }, 'user_id,provider,provider_id');
      } catch (_) { /* individual customer errors are non-fatal */ }
    }
  } catch (_) { /* customer upsert block is non-fatal */ }

  return { revenue, txCount, newCustomers, mrr, activeSubscriptions, churnedToday };
}

/** Daily sync — yesterday only */
async function syncStripe(userId, accessToken) {
  const date = yesterday();
  const r = await syncStripeDay(userId, accessToken, date);
  return { date, ...r };
}

/** Auto-heal: if the integrations row for Stripe has no currency, detect it from
 *  the Stripe account and persist it so the dashboard shows the right symbol. */
async function healStripeCurrency(userId, accessToken) {
  try {
    const { data: row } = await SB.supabase
      .from('integrations')
      .select('currency, account_id')
      .eq('user_id', userId)
      .eq('platform', 'stripe')
      .maybeSingle();

    // Already has a currency — nothing to do
    if (row?.currency) return;

    const accountId = row?.account_id;
    const stripeHeaders = { Authorization: `Bearer ${accessToken}`, 'Stripe-Version': '2024-12-18.acacia' };

    let currency = null;

    // Try 1: most recent charge currency (what they actually charge customers in)
    try {
      const res = await fetch('https://api.stripe.com/v1/charges?limit=5', { headers: stripeHeaders });
      if (res.ok) {
        const body = await res.json();
        const charge = body.data?.find(c => c.status === 'succeeded') ?? body.data?.[0];
        if (charge?.currency) currency = charge.currency.toUpperCase();
      }
    } catch (_) { /* fall through */ }

    // Try 2: most recent payment intent
    if (!currency) {
      try {
        const res = await fetch('https://api.stripe.com/v1/payment_intents?limit=5', { headers: stripeHeaders });
        if (res.ok) {
          const body = await res.json();
          const intent = body.data?.[0];
          if (intent?.currency) currency = intent.currency.toUpperCase();
        }
      } catch (_) { /* fall through */ }
    }

    // Try 3: account default_currency (last resort — may be settlement currency not charge currency)
    if (!currency) {
      try {
        const res = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, { headers: stripeHeaders });
        if (res.ok) {
          const acc = await res.json();
          if (acc.default_currency) currency = acc.default_currency.toUpperCase();
        }
      } catch (_) { /* fall through */ }
    }

    if (!currency) return;

    await SB.patch('integrations', { currency }, { user_id: userId, platform: 'stripe' });
    logOk(`[stripe] Auto-healed currency → ${currency} for user ${userId.slice(0, 8)}`);
  } catch (err) {
    logWarn(`[stripe] healStripeCurrency failed for ${userId.slice(0, 8)}: ${err.message}`);
  }
}
async function backfillStripe(userId, accessToken, days = BACKFILL_DAYS.stripe) {
  log(`  [stripe backfill] ${days} days for user ${userId.slice(0, 8)} — bulk paginated fetch`);
  const stripeHeaders = { Authorization: `Bearer ${accessToken}` };
  const startTs = Math.floor(Date.now() / 1000) - days * 86400;

  // --- Fetch all successful PaymentIntents in range (paginated) ---
  const allCharges = [];
  let chargesUrl = `https://api.stripe.com/v1/charges?limit=100&status=succeeded&created[gte]=${startTs}`;
  while (chargesUrl) {
    const res = await fetchRetry('Stripe charges page', chargesUrl, { headers: stripeHeaders });
    if (!res.ok) break;
    const body = await res.json();
    allCharges.push(...(body.data ?? []));
    chargesUrl = body.has_more ? `https://api.stripe.com/v1/charges?limit=100&status=succeeded&created[gte]=${startTs}&starting_after=${body.data.at(-1).id}` : null;
    if (chargesUrl) await sleep(200);
  }

  // --- Fetch all refunds in range ---
  const allRefunds = [];
  let refundsUrl = `https://api.stripe.com/v1/refunds?limit=100&created[gte]=${startTs}`;
  while (refundsUrl) {
    const res = await fetchRetry('Stripe refunds page', refundsUrl, { headers: stripeHeaders });
    if (!res.ok) break;
    const body = await res.json();
    allRefunds.push(...(body.data ?? []));
    refundsUrl = body.has_more ? `https://api.stripe.com/v1/refunds?limit=100&created[gte]=${startTs}&starting_after=${body.data.at(-1).id}` : null;
    if (refundsUrl) await sleep(200);
  }

  // --- Current MRR / active subscriptions (snapshot, not historic) ---
  let mrr = 0, activeSubscriptions = 0;
  try {
    let subsUrl = `https://api.stripe.com/v1/subscriptions?limit=100&status=active&expand[]=data.items.data.price`;
    while (subsUrl) {
      const res = await fetchRetry('Stripe subs page', subsUrl, { headers: stripeHeaders });
      if (!res.ok) break;
      const body = await res.json();
      for (const s of (body.data ?? [])) {
        activeSubscriptions++;
        // Use expanded price (new API) with fallback to deprecated plan
        for (const item of (s.items?.data ?? [])) {
          const price = item.price ?? {};
          const unitAmount = price.unit_amount ?? item.plan?.amount ?? 0;
          const qty = item.quantity ?? 1;
          const interval = price.recurring?.interval ?? item.plan?.interval ?? 'month';
          const intervalCount = price.recurring?.interval_count ?? item.plan?.interval_count ?? 1;
          let monthlyAmount = 0;
          if (interval === 'month')  monthlyAmount = (unitAmount * qty) / intervalCount;
          else if (interval === 'year')  monthlyAmount = (unitAmount * qty) / (intervalCount * 12);
          else if (interval === 'week')  monthlyAmount = (unitAmount * qty * 52) / (intervalCount * 12);
          else if (interval === 'day')   monthlyAmount = (unitAmount * qty * 365) / (intervalCount * 12);
          mrr += Math.round(monthlyAmount);
        }
      }
      subsUrl = body.has_more
        ? `https://api.stripe.com/v1/subscriptions?limit=100&status=active&expand[]=data.items.data.price&starting_after=${body.data.at(-1).id}`
        : null;
      if (subsUrl) await sleep(200);
    }
  } catch { /* non-fatal */ }

  // --- Group charges by date ---
  const byDate = {};
  for (const ch of allCharges) {
    const date = new Date(ch.created * 1000).toISOString().slice(0, 10);
    byDate[date] ??= { revenue: 0, txCount: 0, refunds: 0, newCustomers: 0 };
    byDate[date].revenue  += ch.amount_captured ?? ch.amount ?? 0;
    byDate[date].txCount  += 1;
  }
  for (const rf of allRefunds) {
    const date = new Date(rf.created * 1000).toISOString().slice(0, 10);
    byDate[date] ??= { revenue: 0, txCount: 0, refunds: 0, newCustomers: 0 };
    byDate[date].refunds += rf.amount ?? 0;
  }

  // --- Upsert each day ---
  let ok = 0;
  for (const [date, vals] of Object.entries(byDate)) {
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'stripe', date, data: {
        revenue:           vals.revenue,
        txCount:           vals.txCount,
        refunds:           vals.refunds,
        newCustomers:      vals.newCustomers,
        mrr,
        activeSubscriptions,
        churnedToday:      0,
      }},
      'user_id,provider,date');
    ok++;
  }
  log(`  [stripe backfill] done — ${ok} days with data (${allCharges.length} charges fetched)`);

  // --- Backfill individual customer records from all historical charges ---
  await backfillStripeCustomers(userId, accessToken, allCharges);
}

/**
 * Upsert all unique Stripe customers found in a charge list into the customers table.
 * Called by backfillStripe (passing charges already fetched) and can be called
 * standalone to populate customers without re-fetching all charges.
 */
async function backfillStripeCustomers(userId, accessToken, preloadedCharges = null) {
  const stripeHeaders = { Authorization: `Bearer ${accessToken}` };

  let allCharges = preloadedCharges;
  if (!allCharges) {
    // Fetch all charges ever (no date filter — we want every customer)
    log(`  [stripe customers] fetching all charges for user ${userId.slice(0, 8)}`);
    allCharges = [];
    let url = `https://api.stripe.com/v1/charges?limit=100&status=succeeded`;
    while (url) {
      const res = await fetchRetry('Stripe all charges', url, { headers: stripeHeaders });
      if (!res.ok) break;
      const body = await res.json();
      allCharges.push(...(body.data ?? []));
      url = body.has_more
        ? `https://api.stripe.com/v1/charges?limit=100&status=succeeded&starting_after=${body.data.at(-1).id}`
        : null;
      if (url) await sleep(200);
    }
  }

  // Collect unique customer IDs from charges
  const customerIds = [...new Set(
    allCharges.filter(ch => ch.customer).map(ch => String(ch.customer))
  )];

  if (customerIds.length === 0) {
    log(`  [stripe customers] no customer IDs found in charges — skipping`);
    return;
  }

  log(`  [stripe customers] upserting ${customerIds.length} unique customers`);
  let ok = 0, skipped = 0;

  for (const cusId of customerIds) {
    try {
      // Fetch customer profile
      const cusRes = await fetchRetry(`Stripe customer ${cusId}`,
        `https://api.stripe.com/v1/customers/${cusId}`, { headers: stripeHeaders });
      if (!cusRes.ok) { skipped++; continue; }
      const cus = await cusRes.json();

      // Compute LTV from this customer's charges in our already-fetched list
      const cusCharges = allCharges.filter(ch => ch.customer === cusId);
      let totalSpent = 0, orderCount = 0, firstSeenTs = null, lastSeenTs = null;
      for (const ch of cusCharges) {
        totalSpent += ch.amount_captured ?? ch.amount ?? 0;
        orderCount += 1;
        if (!firstSeenTs || ch.created < firstSeenTs) firstSeenTs = ch.created;
        if (!lastSeenTs  || ch.created > lastSeenTs)  lastSeenTs  = ch.created;
      }

      // Check subscription status
      const subsRes = await fetchRetry(`Stripe subs ${cusId}`,
        `https://api.stripe.com/v1/subscriptions?customer=${cusId}&limit=10`,
        { headers: stripeHeaders });
      let subscribed = false, churned = false;
      if (subsRes.ok) {
        const subs = (await subsRes.json()).data ?? [];
        subscribed = subs.some(s => s.status === 'active' || s.status === 'trialing');
        churned    = !subscribed && subs.some(s => s.status === 'canceled');
      }

      const today      = new Date().toISOString().slice(0, 10);
      const firstSeen  = firstSeenTs ? new Date(firstSeenTs * 1000).toISOString().slice(0, 10) : today;
      const lastSeen   = lastSeenTs  ? new Date(lastSeenTs  * 1000).toISOString().slice(0, 10) : today;

      await SB.upsert('customers', {
        user_id:     userId,
        provider:    'stripe',
        provider_id: cusId,
        email:       cus.email ?? null,
        name:        cus.name  ?? null,
        total_spent: totalSpent,
        order_count: orderCount,
        first_seen:  firstSeen,
        last_seen:   lastSeen,
        subscribed,
        churned,
      }, 'user_id,provider,provider_id');

      ok++;
      await sleep(100); // gentle rate-limiting
    } catch (err) {
      logFail(`  [stripe customers] ${cusId}: ${err.message}`);
      skipped++;
    }
  }

  log(`  [stripe customers] done — ${ok} upserted, ${skipped} skipped`);
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
  // account_id stores the bare numeric property ID (e.g. "123456789")
  // The GA4 Data API requires the "properties/XXXXXXXXX" prefix in the URL
  const propId = integration.account_id.startsWith('properties/')
    ? integration.account_id
    : `properties/${integration.account_id}`;

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
  // account_id stores the bare numeric property ID (e.g. "123456789")
  // The GA4 Data API requires the "properties/XXXXXXXXX" prefix in the URL
  const propId    = integration.account_id.startsWith('properties/')
    ? integration.account_id
    : `properties/${integration.account_id}`;

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
async function fetchMetaDay(adAccountId, token, date, currency = 'USD') {
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
    currency,   // store the ad account currency so the UI can format spend correctly
  };
}

/** Daily sync — yesterday only */
async function syncMeta(userId, integration) {
  const freshToken  = await extendMetaToken(userId, integration.access_token);
  const date        = yesterday();
  const adAccountId = integration.account_id;
  const currency    = integration.currency ?? 'USD';
  const d           = await fetchMetaDay(adAccountId, freshToken, date, currency);

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'meta', date, data: d },
    'user_id,provider,date');

  return { date, ...d };
}

/**
 * Full Meta backfill — single Insights API call with time_increment=1.
 * Meta returns one entry per day over the requested date range.
 */
async function backfillMeta(userId, integration, days = BACKFILL_DAYS.meta) {
  log(`  [meta backfill] ${days} days for user ${userId.slice(0, 8)} — single bulk request`);
  const freshToken  = await extendMetaToken(userId, integration.access_token);
  const adAccountId = integration.account_id;
  const currency    = integration.currency ?? 'USD';
  const startDate   = daysAgo(days);
  const endDate     = yesterday();

  const timeRange = JSON.stringify({ since: startDate, until: endDate });
  const url = `https://graph.facebook.com/v22.0/${adAccountId}/insights` +
    `?fields=spend,reach,clicks,actions,date_start` +
    `&time_increment=1` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&limit=365` +
    `&access_token=${encodeURIComponent(freshToken)}`;

  let ok = 0, skipped = 0;
  let nextUrl = url;

  while (nextUrl) {
    const res = await fetchRetry('Meta bulk insights', nextUrl);
    if (!res.ok) {
      logWarn(`  [meta backfill] bulk failed (${res.status}), falling back to per-day batches`);
      // Fallback: 5-day parallel batches
      const BATCH = 5;
      for (let batchStart = days; batchStart >= 1; batchStart -= BATCH) {
        const offsets = [];
        for (let k = 0; k < BATCH && (batchStart - k) >= 1; k++) offsets.push(batchStart - k);
        const results = await Promise.allSettled(
          offsets.map(offset => fetchMetaDay(adAccountId, freshToken, daysAgo(offset), currency))
        );
        for (let j = 0; j < results.length; j++) {
          const r = results[j]; const date = daysAgo(offsets[j]);
          if (r.status === 'fulfilled') {
            await SB.upsert('daily_snapshots', { user_id: userId, provider: 'meta', date, data: r.value }, 'user_id,provider,date');
            ok++;
          } else { logFail(`  meta ${date} — ${r.reason?.message}`); skipped++; }
        }
        if (batchStart - BATCH >= 1) await sleep(1_000);
      }
      log(`  [meta backfill] fallback done — ${ok} days saved, ${skipped} errors`);
      return;
    }

    const body = await res.json();
    const entries = body.data ?? [];
    for (const d of entries) {
      const date = (d.date_start ?? '').slice(0, 10);
      if (!date) continue;
      const data = {
        spend:       parseFloat(d.spend ?? '0'),
        reach:       parseInt(d.reach   ?? '0', 10),
        clicks:      parseInt(d.clicks  ?? '0', 10),
        conversions: (d.actions ?? [])
          .filter(a => ['purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type))
          .reduce((s, a) => s + parseInt(a.value ?? '0', 10), 0),
        currency,
      };
      await SB.upsert('daily_snapshots', { user_id: userId, provider: 'meta', date, data }, 'user_id,provider,date');
      ok++;
    }
    // Handle Meta pagination cursors
    nextUrl = body.paging?.next ?? null;
    if (nextUrl) await sleep(500);
  }

  log(`  [meta backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ④ PAYPAL  (PayPal Reporting API v1 — no SDK)
// ─────────────────────────────────────────────────────────────────────────────

/** Refresh a PayPal access token and persist it to the integrations table */
async function refreshPayPalToken(userId, refreshToken) {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SEC}`).toString('base64');
  const res = await fetchRetry('PayPal token refresh', 'https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`PayPal token refresh: ${e?.error_description ?? e?.error ?? res.status}`); }
  const newToken = (await res.json()).access_token;
  await SB.patch('integrations', { access_token: newToken }, { user_id: userId, platform: 'paypal' });
  return newToken;
}

/** Fetch + upsert one day of PayPal transaction data */
async function syncPayPalDay(userId, accessToken, refreshToken, date) {
  const startDate = `${date}T00:00:00-0000`;
  const endDate   = `${date}T23:59:59-0000`;
  const params    = new URLSearchParams({ start_date: startDate, end_date: endDate, fields: 'all', page_size: '500' });

  let token = accessToken;
  let res   = await fetchRetry('PayPal transactions', `https://api-m.paypal.com/v1/reporting/transactions?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Attempt one token refresh on 401
  if (res.status === 401 && refreshToken) {
    token = await refreshPayPalToken(userId, refreshToken);
    res   = await fetchRetry('PayPal transactions (retry)', `https://api-m.paypal.com/v1/reporting/transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`PayPal transactions: ${e?.message ?? res.status}`); }

  const body         = (await res.json());
  const transactions = body.transaction_details ?? [];

  let revenue = 0, fees = 0, txCount = 0;
  for (const tx of transactions) {
    const info   = tx.transaction_info ?? {};
    if (info.transaction_status !== 'S') continue; // only success
    const amount = parseFloat(info.transaction_amount?.value ?? '0');
    const fee    = parseFloat(info.fee_amount?.value ?? '0');
    if (amount > 0) { revenue += amount; fees += Math.abs(fee); txCount += 1; }
  }
  const netRevenue = revenue - fees;

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'paypal', date, data: { revenue, fees, netRevenue, txCount } },
    'user_id,provider,date');

  return { revenue, txCount, fees, netRevenue };
}

/** Daily sync — yesterday only */
async function syncPayPal(userId, integration) {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SEC) throw new Error('PayPal: missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET in .env');
  const date = yesterday();
  const r = await syncPayPalDay(userId, integration.access_token, integration.refresh_token, date);
  return { date, ...r };
}

/** Full backfill — sequential per day (PayPal reporting has strict rate limits) */
async function backfillPayPal(userId, integration, days = BACKFILL_DAYS.paypal) {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SEC) throw new Error('PayPal: missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET in .env');
  log(`  [paypal backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;

  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try {
      const r = await syncPayPalDay(userId, integration.access_token, integration.refresh_token, date);
      if (r.txCount > 0) logOk(`  paypal ${date} — $${r.revenue.toFixed(2)} revenue | ${r.txCount} tx`);
      ok++;
    } catch (err) {
      logFail(`  paypal ${date} — ${err.message}`);
      skipped++;
    }
    // 200ms between each day to respect PayPal rate limits
    await sleep(200);
  }
  log(`  [paypal backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ PADDLE  (Paddle Billing API v1 — no SDK, API key per user)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch + upsert one day of Paddle transaction data */
async function syncPaddleDay(userId, apiKey, date) {
  const from    = `${date}T00:00:00Z`;
  const to      = `${date}T23:59:59Z`;
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  let revenue = 0, fees = 0, txCount = 0;
  let after   = null;
  const customerMap = new Map(); // provider_id → { email, name, total_spent (cents), order_count, first_seen, last_seen, subscribed }

  while (true) {
    const params = new URLSearchParams({
      'billed_at[gte]': from,
      'billed_at[lte]': to,
      status:           'completed',
      per_page:         '200',
      include:          'customer',  // embed customer object in each transaction
    });
    if (after) params.set('after', after);

    const res = await fetchRetry('Paddle transactions', `https://api.paddle.com/transactions?${params}`, { headers });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Paddle transactions: ${e?.error?.detail ?? res.status}`); }

    const body  = await res.json();
    const items = body.data ?? [];

    for (const tx of items) {
      const totals     = tx.details?.totals ?? {};
      const grandTotal = parseInt(totals.grand_total ?? '0', 10);
      const earnings   = parseInt(totals.earnings   ?? '0', 10);
      if (grandTotal > 0) {
        revenue  += grandTotal / 100;
        fees     += (grandTotal - earnings) / 100;
        txCount  += 1;
      }

      // ── Customer accumulation ──────────────────────────────────────────────
      const cusId = tx.customer_id;
      if (cusId) {
        const existing = customerMap.get(cusId);
        const billedAt = (tx.billed_at ?? date).split('T')[0];
        if (existing) {
          existing.total_spent  += grandTotal;
          existing.order_count  += 1;
          if (billedAt < existing.first_seen) existing.first_seen = billedAt;
          if (billedAt > existing.last_seen)  existing.last_seen  = billedAt;
          if (tx.subscription_id) existing.subscribed = true;
        } else {
          customerMap.set(cusId, {
            email:       tx.customer?.email ?? null,
            name:        tx.customer?.name  ?? null,
            total_spent: grandTotal,
            order_count: 1,
            first_seen:  billedAt,
            last_seen:   billedAt,
            subscribed:  !!tx.subscription_id,
          });
        }
      }
    }

    const nextUrl = body.meta?.pagination?.next;
    if (!nextUrl) break;
    try { after = new URL(nextUrl).searchParams.get('after'); if (!after) break; } catch { break; }
  }

  const netRevenue = revenue - fees;
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'paddle', date, data: { revenue, fees, netRevenue, txCount } },
    'user_id,provider,date');

  // ── Upsert customer records (non-fatal) ────────────────────────────────────
  if (customerMap.size > 0) {
    try {
      const records = [...customerMap.entries()].map(([provider_id, c]) => ({
        user_id:     userId,
        provider:    'paddle',
        provider_id,
        email:       c.email,
        name:        c.name,
        total_spent: c.total_spent,
        order_count: c.order_count,
        first_seen:  c.first_seen,
        last_seen:   c.last_seen,
        subscribed:  c.subscribed,
        churned:     false,
      }));
      await SB.upsert('customers', records, 'user_id,provider,provider_id');
    } catch (err) {
      logWarn(`paddle customer upsert: ${err.message}`);
    }
  }

  return { revenue, fees, netRevenue, txCount };
}

/** Daily sync — yesterday only */
async function syncPaddle(userId, integration) {
  const date = yesterday();
  const r = await syncPaddleDay(userId, integration.access_token, date);
  return { date, ...r };
}

/** Full backfill — sequential per day */
/** Full backfill — single paginated fetch for entire date range, grouped by date */
async function backfillPaddle(userId, integration, days = BACKFILL_DAYS.paddle) {
  log(`  [paddle backfill] ${days} days for user ${userId.slice(0, 8)} — bulk paginated fetch`);
  const apiKey    = integration.access_token;
  const headers   = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const startDate = daysAgo(days);
  const from      = `${startDate}T00:00:00Z`;
  const to        = `${yesterday()}T23:59:59Z`;

  const byDate = {};
  let after    = null;

  while (true) {
    const params = new URLSearchParams({
      'billed_at[gte]': from,
      'billed_at[lte]': to,
      status:    'completed',
      per_page:  '200',
    });
    if (after) params.set('after', after);

    const res = await fetchRetry('Paddle bulk transactions', `https://api.paddle.com/transactions?${params}`, { headers });
    if (!res.ok) {
      logWarn(`  [paddle backfill] bulk failed (${res.status}), falling back to per-day`);
      let ok = 0, skipped = 0;
      for (let offset = days; offset >= 1; offset--) {
        const date = daysAgo(offset);
        try { await syncPaddleDay(userId, apiKey, date); ok++; }
        catch (err) { logFail(`  paddle ${date} — ${err.message}`); skipped++; }
        await sleep(100);
      }
      log(`  [paddle backfill] fallback done — ${ok} days saved, ${skipped} errors`);
      return;
    }

    const body  = await res.json();
    const items = body.data ?? [];
    for (const tx of items) {
      const date       = (tx.billed_at ?? '').slice(0, 10);
      if (!date) continue;
      const totals     = tx.details?.totals ?? {};
      const grandTotal = parseInt(totals.grand_total ?? '0', 10);
      const earnings   = parseInt(totals.earnings   ?? '0', 10);
      if (grandTotal > 0) {
        byDate[date] ??= { revenue: 0, fees: 0, txCount: 0 };
        byDate[date].revenue  += grandTotal / 100;
        byDate[date].fees     += (grandTotal - earnings) / 100;
        byDate[date].txCount  += 1;
      }
    }

    const nextUrl = body.meta?.pagination?.next;
    if (!nextUrl) break;
    try { after = new URL(nextUrl).searchParams.get('after'); if (!after) break; } catch { break; }
    await sleep(100);
  }

  let ok = 0;
  for (const [date, vals] of Object.entries(byDate)) {
    const netRevenue = vals.revenue - vals.fees;
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'paddle', date, data: { revenue: vals.revenue, fees: vals.fees, netRevenue, txCount: vals.txCount } },
      'user_id,provider,date');
    ok++;
  }
  log(`  [paddle backfill] done — ${ok} days with data (bulk fetch)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ LEMON SQUEEZY  (Lemon Squeezy API v1 — no SDK, API key per user)
// ─────────────────────────────────────────────────────────────────────────────

async function syncLemonSqueezyDay(userId, apiKey, storeId, date) {
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' };
  const from    = `${date}T00:00:00.000Z`;
  const to      = `${date}T23:59:59.999Z`;

  let revenue = 0, fees = 0, txCount = 0, page = 1;
  const customerMap = new Map(); // provider_id → { email, name, total_spent (cents), order_count, first_seen, last_seen }

  while (true) {
    const params = new URLSearchParams({
      'filter[store_id]':       storeId,
      'filter[status]':         'paid',
      'filter[created_at_gte]': from,
      'filter[created_at_lte]': to,
      'page[size]':             '100',
      'page[number]':           String(page),
    });

    const res = await fetchRetry('LemonSqueezy orders', `https://api.lemonsqueezy.com/v1/orders?${params}`, { headers });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`LemonSqueezy orders: ${e?.errors?.[0]?.detail ?? res.status}`); }

    const body  = await res.json();
    const items = body.data ?? [];

    for (const order of items) {
      const attrs    = order.attributes ?? {};
      const totalUsd = attrs.total_usd ?? attrs.total ?? 0;
      if (totalUsd > 0) {
        revenue  += totalUsd / 100;
        fees     += Math.round(totalUsd * 0.05 + 50) / 100; // ~5% + $0.50 LS fee
        txCount  += 1;
      }

      // ── Customer accumulation ──────────────────────────────────────────────
      const providerId = String(attrs.customer_id ?? attrs.user_email ?? '');
      if (providerId) {
        const orderDate = (attrs.created_at ?? date).split('T')[0];
        const existing  = customerMap.get(providerId);
        if (existing) {
          existing.total_spent += totalUsd;
          existing.order_count += 1;
          if (orderDate < existing.first_seen) existing.first_seen = orderDate;
          if (orderDate > existing.last_seen)  existing.last_seen  = orderDate;
        } else {
          customerMap.set(providerId, {
            email:       attrs.user_email ?? null,
            name:        attrs.user_name  ?? null,
            total_spent: totalUsd,
            order_count: 1,
            first_seen:  orderDate,
            last_seen:   orderDate,
          });
        }
      }
    }

    const lastPage = body.meta?.page?.lastPage ?? 1;
    if (page >= lastPage) break;
    page++;
  }

  const netRevenue = revenue - fees;
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'lemon-squeezy', date, data: { revenue, fees, netRevenue, txCount } },
    'user_id,provider,date');

  // ── Upsert customer records (non-fatal) ────────────────────────────────────
  if (customerMap.size > 0) {
    try {
      const records = [...customerMap.entries()].map(([provider_id, c]) => ({
        user_id:     userId,
        provider:    'lemon-squeezy',
        provider_id,
        email:       c.email,
        name:        c.name,
        total_spent: c.total_spent,
        order_count: c.order_count,
        first_seen:  c.first_seen,
        last_seen:   c.last_seen,
        subscribed:  false,
        churned:     false,
      }));
      await SB.upsert('customers', records, 'user_id,provider,provider_id');
    } catch (err) {
      logWarn(`lemon-squeezy customer upsert: ${err.message}`);
    }
  }

  return { revenue, fees, netRevenue, txCount };
}

async function syncLemonSqueezy(userId, integration) {
  const date = yesterday();
  const r = await syncLemonSqueezyDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillLemonSqueezy(userId, integration, days = 365) {
  log(`  [lemonsqueezy backfill] ${days} days for user ${userId.slice(0, 8)} — bulk paginated fetch`);
  const apiKey   = integration.access_token;
  const storeId  = integration.account_id;
  const startDate = daysAgo(days);
  const headers  = { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' };

  // Fetch ALL orders for the date range (paginated)
  const byDate = {};
  let url = `https://api.lemonsqueezy.com/v1/orders?filter[store_id]=${storeId}&filter[status]=paid&page[size]=100&sort=created_at`;
  while (url) {
    const res = await fetchRetry('LemonSqueezy orders page', url, { headers });
    if (!res.ok) break;
    const body = await res.json();
    for (const order of (body.data ?? [])) {
      const date = (order.attributes?.created_at ?? '').slice(0, 10);
      if (!date || date < startDate) { url = null; break; } // past the range
      const total      = Number(order.attributes?.total          ?? 0) / 100;
      const totalUSD   = Number(order.attributes?.total_usd      ?? total * 100) / 100;
      const tax        = Number(order.attributes?.tax            ?? 0) / 100;
      const setupFee   = Number(order.attributes?.setup_fee      ?? 0) / 100;
      const revenue    = totalUSD;
      const fees       = tax + setupFee;
      byDate[date] ??= { revenue: 0, fees: 0, txCount: 0 };
      byDate[date].revenue  += revenue;
      byDate[date].fees     += fees;
      byDate[date].txCount  += 1;
    }
    const nextLink = body.links?.next;
    url = (url !== null && nextLink) ? nextLink : null;
    if (url) await sleep(150);
  }

  let ok = 0;
  for (const [date, vals] of Object.entries(byDate)) {
    const netRevenue = vals.revenue - vals.fees;
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'lemon-squeezy', date, data: { revenue: vals.revenue, fees: vals.fees, netRevenue, txCount: vals.txCount } },
      'user_id,provider,date');
    ok++;
  }
  log(`  [lemonsqueezy backfill] done — ${ok} days with data (bulk fetch)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑦ GUMROAD  (Gumroad API v2 — API key per user)
// ─────────────────────────────────────────────────────────────────────────────

async function syncGumroadDay(userId, apiKey, date) {
  const after  = new Date(date); after.setDate(after.getDate() - 1);
  const before = new Date(date); before.setDate(before.getDate() + 1);
  const afterStr  = after.toISOString().split('T')[0];
  const beforeStr = before.toISOString().split('T')[0];

  let revenue = 0, fees = 0, txCount = 0, page = 1;
  const customerMap = new Map(); // provider_id → { email, name, total_spent (cents), order_count, first_seen, last_seen }

  while (true) {
    const params = new URLSearchParams({ after: afterStr, before: beforeStr, page: String(page) });
    const res = await fetchRetry('Gumroad sales', `https://api.gumroad.com/v2/sales?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Gumroad sales: ${e?.message ?? res.status}`); }

    const body  = await res.json();
    const sales = body.sales ?? [];

    for (const sale of sales) {
      const saleDate = (sale.created_at ?? '').split('T')[0];
      if (saleDate !== date) continue;
      const price = typeof sale.price === 'number' ? sale.price : 0;
      const gFee  = typeof sale.gumroad_fee === 'number' ? sale.gumroad_fee : 0;
      revenue += price / 100;
      fees    += gFee  / 100;
      txCount += 1;

      // ── Customer accumulation ──────────────────────────────────────────────
      const providerId = String(sale.purchaser_id ?? sale.email ?? '');
      if (providerId) {
        const existing = customerMap.get(providerId);
        if (existing) {
          existing.total_spent += price;
          existing.order_count += 1;
          if (saleDate < existing.first_seen) existing.first_seen = saleDate;
          if (saleDate > existing.last_seen)  existing.last_seen  = saleDate;
        } else {
          customerMap.set(providerId, {
            email:       sale.email     ?? null,
            name:        sale.full_name ?? null,
            total_spent: price,
            order_count: 1,
            first_seen:  saleDate,
            last_seen:   saleDate,
          });
        }
      }
    }

    if (!body.next_page_url || sales.length === 0) break;
    page++;
  }

  const netRevenue = revenue - fees;
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'gumroad', date, data: { revenue, fees, netRevenue, txCount } },
    'user_id,provider,date');

  // ── Upsert customer records (non-fatal) ────────────────────────────────────
  if (customerMap.size > 0) {
    try {
      const records = [...customerMap.entries()].map(([provider_id, c]) => ({
        user_id:     userId,
        provider:    'gumroad',
        provider_id,
        email:       c.email,
        name:        c.name,
        total_spent: c.total_spent,
        order_count: c.order_count,
        first_seen:  c.first_seen,
        last_seen:   c.last_seen,
        subscribed:  false,
        churned:     false,
      }));
      await SB.upsert('customers', records, 'user_id,provider,provider_id');
    } catch (err) {
      logWarn(`gumroad customer upsert: ${err.message}`);
    }
  }

  return { revenue, fees, netRevenue, txCount };
}

async function syncGumroad(userId, integration) {
  const date = yesterday();
  const r = await syncGumroadDay(userId, integration.access_token, date);
  return { date, ...r };
}

async function backfillGumroad(userId, integration, days = 365) {
  log(`  [gumroad backfill] ${days} days for user ${userId.slice(0, 8)} — bulk paginated fetch`);
  const apiKey    = integration.access_token;
  const startDate = daysAgo(days);
  const endDate   = yesterday();

  // Fetch ALL sales in date range (Gumroad supports before/after at the list level)
  const byDate = {};
  let page = 1;
  while (true) {
    const params = new URLSearchParams({ after: startDate, before: endDate, page: String(page) });
    const res = await fetchRetry('Gumroad sales bulk', `https://api.gumroad.com/v2/sales?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) break;
    const body  = await res.json();
    const sales = body.sales ?? [];
    if (sales.length === 0) break;

    for (const sale of sales) {
      const date = (sale.created_at ?? '').split('T')[0];
      if (!date) continue;
      const price = typeof sale.price === 'number' ? sale.price / 100 : 0;
      const gFee  = typeof sale.gumroad_fee === 'number' ? sale.gumroad_fee / 100 : 0;
      byDate[date] ??= { revenue: 0, fees: 0, txCount: 0 };
      byDate[date].revenue  += price;
      byDate[date].fees     += gFee;
      byDate[date].txCount  += 1;
    }

    if (!body.next_page_url) break;
    page++;
    await sleep(150);
  }

  let ok = 0;
  for (const [date, vals] of Object.entries(byDate)) {
    const netRevenue = vals.revenue - vals.fees;
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'gumroad', date, data: { revenue: vals.revenue, fees: vals.fees, netRevenue, txCount: vals.txCount } },
      'user_id,provider,date');
    ok++;
  }
  log(`  [gumroad backfill] done — ${ok} days with data (bulk fetch)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑧ PLAUSIBLE  (Plausible Stats API v1 — API key + siteId)
// ─────────────────────────────────────────────────────────────────────────────

async function syncPlausibleDay(userId, apiKey, siteId, date) {
  const params = new URLSearchParams({
    site_id: siteId,
    period:  'custom',
    date:    `${date},${date}`,
    metrics: 'visitors,pageviews,bounce_rate,visit_duration',
  });

  const res = await fetchRetry('Plausible stats', `https://plausible.io/api/v1/stats/aggregate?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Plausible stats: ${e?.error ?? res.status}`); }

  const body          = await res.json();
  const results       = body.results ?? {};
  const visitors      = results.visitors?.value      ?? 0;
  const pageviews     = results.pageviews?.value     ?? 0;
  const bounceRate    = results.bounce_rate?.value   ?? 0;
  const visitDuration = results.visit_duration?.value ?? 0;

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'plausible', date, data: { visitors, pageviews, bounceRate, visitDuration } },
    'user_id,provider,date');
  return { visitors, pageviews, bounceRate, visitDuration };
}

async function syncPlausible(userId, integration) {
  const date = yesterday();
  const r = await syncPlausibleDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillPlausible(userId, integration, days = 365) {
  log(`  [plausible backfill] ${days} days for user ${userId.slice(0, 8)} — single bulk request`);
  const apiKey  = integration.access_token;
  const siteId  = integration.account_id;
  const startDate = daysAgo(days);
  const endDate   = yesterday();

  const params = new URLSearchParams({
    site_id:       siteId,
    period:        'custom',
    date:          `${startDate},${endDate}`,
    metrics:       'visitors,pageviews,visits,bounce_rate,visit_duration',
    dimensions:    'time:day',
  });
  const res = await fetchRetry('Plausible bulk', `https://plausible.io/api/v2/query`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      site_id:    siteId,
      metrics:    ['visitors', 'pageviews', 'visits', 'bounce_rate', 'visit_duration'],
      date_range: [startDate, endDate],
      dimensions: ['time:day'],
    }),
  });

  if (!res.ok) {
    logWarn(`  [plausible backfill] bulk API failed (${res.status}), falling back to per-day`);
    let ok = 0, skipped = 0;
    for (let offset = days; offset >= 1; offset--) {
      const date = daysAgo(offset);
      try { await syncPlausibleDay(userId, apiKey, siteId, date); ok++; }
      catch (err) { logFail(`  plausible ${date} — ${err.message}`); skipped++; }
      await sleep(200);
    }
    log(`  [plausible backfill] done — ${ok} days saved, ${skipped} errors`);
    return;
  }

  const body = await res.json();
  const results = body.results ?? [];
  let ok = 0;
  for (const row of results) {
    const date        = (row.dimensions?.[0] ?? '').slice(0, 10);
    if (!date) continue;
    const visitors    = Number(row.metrics?.[0] ?? 0);
    const pageviews   = Number(row.metrics?.[1] ?? 0);
    const sessions    = Number(row.metrics?.[2] ?? 0);
    const bounceRate  = Number(row.metrics?.[3] ?? 0);
    const visitDuration = Number(row.metrics?.[4] ?? 0);
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'plausible', date, data: { visitors, pageviews, sessions, bounceRate, visitDuration } },
      'user_id,provider,date');
    ok++;
  }
  log(`  [plausible backfill] done — ${ok} days saved (1 request)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑨ MIXPANEL  (Mixpanel Segmentation API — service account basic auth)
// ─────────────────────────────────────────────────────────────────────────────

async function syncMixpanelDay(userId, credentials, projectId, date) {
  const headers = { Authorization: `Basic ${credentials}` };

  async function fetchSegment(type) {
    const e = JSON.stringify({ event_type: '_active' });
    const params = new URLSearchParams({ e, from_date: date, to_date: date, unit: 'day', type, project_id: projectId });
    const res = await fetchRetry(`Mixpanel ${type}`, `https://mixpanel.com/api/query/segmentation?${params}`, { headers });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Mixpanel ${type}: ${err?.error ?? res.status}`); }
    const body = await res.json();
    const values = body.data?.values ?? {};
    let total = 0;
    for (const ev of Object.keys(values)) total += values[ev]?.[date] ?? 0;
    return total;
  }

  const [events, uniqueUsers] = await Promise.all([
    fetchSegment('general').catch(() => 0),
    fetchSegment('unique').catch(() => 0),
  ]);

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'mixpanel', date, data: { events, uniqueUsers } },
    'user_id,provider,date');
  return { events, uniqueUsers };
}

async function syncMixpanel(userId, integration) {
  const date = yesterday();
  const r = await syncMixpanelDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillMixpanel(userId, integration, days = 365) {
  log(`  [mixpanel backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try {
      await syncMixpanelDay(userId, integration.access_token, integration.account_id, date);
      ok++;
    } catch (err) { logFail(`  mixpanel ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [mixpanel backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑩ AMPLITUDE  (Amplitude Events Segmentation API v2 — basic auth)
// ─────────────────────────────────────────────────────────────────────────────

async function syncAmplitudeDay(userId, credentials, date) {
  const headers = { Authorization: `Basic ${credentials}` };
  const dateStr = date.replace(/-/g, '');

  async function fetchMetric(math) {
    const e = JSON.stringify({ event_type: '_active' });
    const params = new URLSearchParams({ e, start: dateStr, end: dateStr, m: math });
    const res = await fetchRetry(`Amplitude ${math}`, `https://amplitude.com/api/2/events/segmentation?${params}`, { headers });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Amplitude ${math}: ${err?.error ?? res.status}`); }
    const body = await res.json();
    return (body.data?.series?.[0] ?? []).reduce((a, b) => a + b, 0);
  }

  async function fetchNewUsers() {
    const e = JSON.stringify({ event_type: '_new_user' });
    const params = new URLSearchParams({ e, start: dateStr, end: dateStr, m: 'uniques' });
    const res = await fetchRetry('Amplitude newUsers', `https://amplitude.com/api/2/events/segmentation?${params}`, { headers });
    if (!res.ok) return 0;
    const body = await res.json();
    return (body.data?.series?.[0] ?? []).reduce((a, b) => a + b, 0);
  }

  const [activeUsers, totalEvents, newUsers] = await Promise.all([
    fetchMetric('uniques').catch(() => 0),
    fetchMetric('totals').catch(() => 0),
    fetchNewUsers().catch(() => 0),
  ]);

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'amplitude', date, data: { activeUsers, totalEvents, newUsers } },
    'user_id,provider,date');
  return { activeUsers, totalEvents, newUsers };
}

async function syncAmplitude(userId, integration) {
  const date = yesterday();
  const r = await syncAmplitudeDay(userId, integration.access_token, date);
  return { date, ...r };
}

async function backfillAmplitude(userId, integration, days = 365) {
  log(`  [amplitude backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try {
      await syncAmplitudeDay(userId, integration.access_token, date);
      ok++;
    } catch (err) { logFail(`  amplitude ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [amplitude backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑪ POSTHOG  (HogQL Query API — synchronous, returns exact counts directly)
// The legacy /insights/trend/ endpoint creates cached insight objects and can
// return empty data arrays or async task IDs, causing silent 0s every time.
// The HogQL Query API (POST /query) is direct and always returns real data.
// account_id format: "eu:<projectId>" for EU cloud, "<projectId>" for US cloud
// ─────────────────────────────────────────────────────────────────────────────

async function syncPostHogDay(userId, apiKey, rawAccountId, date) {
  if (!rawAccountId) throw new Error('PostHog account_id (project ID) is missing — reconnect the integration and enter your Project ID manually');
  const isEU = rawAccountId.startsWith('eu:');
  const host = isEU ? 'https://eu.posthog.com' : 'https://app.posthog.com';
  const projectId = isEU ? rawAccountId.slice(3) : rawAccountId;

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  // Single HogQL query — all three metrics in one round trip.
  // count()                                → total $pageview events
  // count(distinct person_id)              → unique visitors
  // count(distinct properties.$session_id) → sessions via session property
  const res = await fetchRetry('PostHog HogQL', `${host}/api/projects/${projectId}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: `SELECT count() AS pageviews, count(distinct person_id) AS unique_users, count(distinct properties.\`$session_id\`) AS sessions FROM events WHERE event = '$pageview' AND toDate(timestamp) = '${date}'`,
      },
    }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`PostHog HogQL: ${e?.detail ?? e?.code ?? res.status}`);
  }

  const body = await res.json();
  const row = body.results?.[0] ?? [];
  const pageviews   = Number(row[0]) || 0;
  const uniqueUsers = Number(row[1]) || 0;
  const sessions    = Number(row[2]) || 0;

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'posthog', date, data: { pageviews, uniqueUsers, sessions } },
    'user_id,provider,date');
  return { pageviews, uniqueUsers, sessions };
}

async function syncPostHog(userId, integration) {
  const date = yesterday();
  const r = await syncPostHogDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillPostHog(userId, integration, days = 365) {
  log(`  [posthog backfill] ${days} days for user ${userId.slice(0, 8)} — single bulk HogQL query`);
  const apiKey      = integration.access_token;
  const rawAccountId = integration.account_id;
  if (!rawAccountId) {
    logFail(`  [posthog backfill] skipping user ${userId.slice(0, 8)} — account_id (project ID) is missing. Reconnect the integration and enter Project ID manually.`);
    return;
  }
  const isEU        = rawAccountId.startsWith('eu:');
  const host        = isEU ? 'https://eu.posthog.com' : 'https://app.posthog.com';
  const projectId   = isEU ? rawAccountId.slice(3) : rawAccountId;
  const startDate   = daysAgo(days);
  const endDate     = yesterday();

  const res = await fetchRetry('PostHog bulk HogQL', `${host}/api/projects/${projectId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: `SELECT toDate(timestamp) AS date, count() AS pageviews, count(distinct person_id) AS unique_users, count(distinct properties.\`$session_id\`) AS sessions FROM events WHERE event = '$pageview' AND toDate(timestamp) >= '${startDate}' AND toDate(timestamp) <= '${endDate}' GROUP BY date ORDER BY date`,
      },
    }),
  });

  if (!res.ok) {
    logWarn(`  [posthog backfill] bulk HogQL failed (${res.status}), falling back to per-day`);
    let ok = 0, skipped = 0;
    for (let offset = days; offset >= 1; offset--) {
      const date = daysAgo(offset);
      try { await syncPostHogDay(userId, apiKey, rawAccountId, date); ok++; }
      catch (err) { logFail(`  posthog ${date} — ${err.message}`); skipped++; }
      await sleep(500);
    }
    log(`  [posthog backfill] done — ${ok} days saved, ${skipped} errors`);
    return;
  }

  const body = await res.json();
  const results = body.results ?? [];
  let ok = 0;
  for (const row of results) {
    const date        = (row[0] ?? '').slice(0, 10);
    if (!date) continue;
    const pageviews   = Number(row[1]) || 0;
    const uniqueUsers = Number(row[2]) || 0;
    const sessions    = Number(row[3]) || 0;
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'posthog', date, data: { pageviews, uniqueUsers, sessions } },
      'user_id,provider,date');
    ok++;
  }
  log(`  [posthog backfill] done — ${ok} days saved (1 request)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑫ FATHOM  (Fathom Analytics API — apiKey + siteId)
// ─────────────────────────────────────────────────────────────────────────────

async function syncFathomDay(userId, apiKey, siteId, date) {
  const params = new URLSearchParams({
    entity: 'pageview', entity_id: siteId,
    aggregates: 'pageviews,uniques,visits,bounce_rate,avg_duration',
    date_grouping: 'day', date_from: date, date_to: date,
  });
  const res = await fetchRetry('Fathom', `https://api.usefathom.com/v1/aggregations?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Fathom ${res.status}: ${e?.detail ?? res.statusText}`); }
  const body = await res.json();
  const row  = Array.isArray(body) ? body[0] : body;
  const pageviews   = Number(row?.pageviews   ?? 0);
  const uniques     = Number(row?.uniques      ?? 0);
  const visits      = Number(row?.visits       ?? 0);
  const bounceRate  = Number(row?.bounce_rate  ?? 0);
  const avgDuration = Number(row?.avg_duration ?? 0);
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'fathom', date, data: { pageviews, uniques, visits, bounceRate, avgDuration } },
    'user_id,provider,date');
  return { pageviews, uniques, visits, bounceRate, avgDuration };
}

async function syncFathom(userId, integration) {
  const date = yesterday();
  const r = await syncFathomDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillFathom(userId, integration, days = 365) {
  log(`  [fathom backfill] ${days} days for user ${userId.slice(0, 8)} — single bulk request`);
  const apiKey  = integration.access_token;
  const siteId  = integration.account_id;
  const startDate = daysAgo(days);
  const endDate   = yesterday();

  const params = new URLSearchParams({
    entity:        'pageview',
    entity_id:     siteId,
    aggregates:    'pageviews,uniques,visits,bounce_rate,avg_duration',
    date_grouping: 'day',
    date_from:     startDate,
    date_to:       endDate,
  });
  const res = await fetchRetry('Fathom bulk', `https://api.usefathom.com/v1/aggregations?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    logWarn(`  [fathom backfill] bulk failed (${res.status}), falling back to per-day`);
    let ok = 0, skipped = 0;
    for (let offset = days; offset >= 1; offset--) {
      const date = daysAgo(offset);
      try { await syncFathomDay(userId, apiKey, siteId, date); ok++; }
      catch (err) { logFail(`  fathom ${date} — ${err.message}`); skipped++; }
      await sleep(200);
    }
    log(`  [fathom backfill] done — ${ok} days saved, ${skipped} errors`);
    return;
  }

  const rows = await res.json();
  let ok = 0;
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const date        = (row.date ?? '').slice(0, 10);
    if (!date) continue;
    const pageviews   = Number(row.pageviews   ?? 0);
    const uniques     = Number(row.uniques      ?? 0);
    const visits      = Number(row.visits       ?? 0);
    const bounceRate  = Number(row.bounce_rate  ?? 0);
    const avgDuration = Number(row.avg_duration ?? 0);
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'fathom', date, data: { pageviews, uniques, visits, bounceRate, avgDuration } },
      'user_id,provider,date');
    ok++;
  }
  log(`  [fathom backfill] done — ${ok} days saved (1 request)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑬ GOOGLE ADS  (Google Ads API v17 — OAuth access token + refresh token)
// developer-token is a server-side app credential from GOOGLE_ADS_DEVELOPER_TOKEN env var
// ─────────────────────────────────────────────────────────────────────────────

/** Refresh an expired Google OAuth access token and persist the new one */
async function refreshGoogleAdsToken(userId, refreshToken) {
  if (!refreshToken) throw new Error('No refresh token stored — user must reconnect via OAuth.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Google token refresh failed: ${data.error_description ?? data.error ?? res.status}`);
  await SB.patch('integrations', { access_token: data.access_token }, { user_id: userId, platform: 'google-ads' });
  return data.access_token;
}

async function syncGoogleAdsDay(userId, accessToken, refreshToken, customerId, date) {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const query = `SELECT metrics.cost_micros,metrics.clicks,metrics.impressions,metrics.conversions FROM customer WHERE segments.date = '${date}'`;

  const doRequest = (token) => fetchRetry('GoogleAds', `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization:       `Bearer ${token}`,
      'developer-token':   devToken,
      'login-customer-id': customerId,
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({ query }),
  });

  let res = await doRequest(accessToken);

  // Auto-refresh on 401
  if (res.status === 401 && refreshToken) {
    const newToken = await refreshGoogleAdsToken(userId, refreshToken);
    res = await doRequest(newToken);
  }

  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Google Ads ${res.status}: ${e?.error?.message ?? res.statusText}`); }
  const body = await res.json();
  const rows = body.results ?? [];
  let costMicros = 0, clicks = 0, impressions = 0, conversions = 0;
  for (const row of rows) {
    costMicros  += Number(row.metrics?.cost_micros  ?? 0);
    clicks      += Number(row.metrics?.clicks       ?? 0);
    impressions += Number(row.metrics?.impressions  ?? 0);
    conversions += Number(row.metrics?.conversions  ?? 0);
  }
  const spend = costMicros / 1_000_000;
  const ctr   = impressions > 0 ? (clicks / impressions) * 100 : 0;
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'google-ads', date, data: { spend, clicks, impressions, conversions, ctr } },
    'user_id,provider,date');
  return { spend, clicks, impressions, conversions, ctr };
}

async function syncGoogleAds(userId, integration) {
  const date = yesterday();
  const r = await syncGoogleAdsDay(userId, integration.access_token, integration.refresh_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillGoogleAds(userId, integration, days = 365) {
  log(`  [google-ads backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncGoogleAdsDay(userId, integration.access_token, integration.refresh_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  google-ads ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [google-ads backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑭ TIKTOK ADS  (TikTok Business API v1.3 — accessToken + advertiserId)
// ─────────────────────────────────────────────────────────────────────────────

async function syncTikTokAdsDay(userId, accessToken, advertiserId, date) {
  const params = new URLSearchParams({
    advertiser_id: advertiserId,
    report_type: 'BASIC',
    dimensions: JSON.stringify(['stat_time_day']),
    metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'conversions']),
    data_level: 'AUCTION_ADVERTISER',
    start_date: date, end_date: date, page_size: '1',
  });
  const res = await fetchRetry('TikTokAds', `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params}`, {
    headers: { 'Access-Token': accessToken },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`TikTok Ads ${res.status}: ${e?.message ?? res.statusText}`); }
  const body = await res.json();
  if (body?.code !== 0) throw new Error(`TikTok Ads: ${body?.message ?? 'unknown'}`);
  const rows = body?.data?.list ?? [];
  let spend = 0, impressions = 0, clicks = 0, conversions = 0;
  for (const row of rows) {
    spend       += parseFloat(row.metrics?.spend       ?? '0');
    impressions += parseFloat(row.metrics?.impressions ?? '0');
    clicks      += parseFloat(row.metrics?.clicks      ?? '0');
    conversions += parseFloat(row.metrics?.conversions ?? '0');
  }
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'tiktok-ads', date, data: { spend, impressions, clicks, conversions, ctr } },
    'user_id,provider,date');
  return { spend, impressions, clicks, conversions, ctr };
}

async function syncTikTokAds(userId, integration) {
  const date = yesterday();
  const r = await syncTikTokAdsDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillTikTokAds(userId, integration, days = 365) {
  log(`  [tiktok-ads backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncTikTokAdsDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  tiktok-ads ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [tiktok-ads backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑮ TWITTER ADS  (Twitter Ads API v12 — bearerToken + accountId)
// ─────────────────────────────────────────────────────────────────────────────

async function syncTwitterAdsDay(userId, bearerToken, accountId, date) {
  const startTime = `${date}T00:00:00Z`;
  const endTime   = `${date}T23:59:59Z`;
  const params = new URLSearchParams({
    metric_groups: 'BILLING,ENGAGEMENT', start_time: startTime, end_time: endTime,
    granularity: 'DAY', placement: 'ALL_ON_TWITTER',
  });
  const res = await fetchRetry('TwitterAds', `https://ads-api.twitter.com/12/stats/accounts/${accountId}?${params}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Twitter Ads ${res.status}: ${e?.errors?.[0]?.message ?? res.statusText}`); }
  const body = await res.json();
  const metrics = body?.data?.[0]?.id_data?.[0]?.metrics ?? {};
  const billedMicros = (metrics.billed_charge_local_micro ?? [])[0] ?? 0;
  const impressions  = (metrics.impressions               ?? [])[0] ?? 0;
  const clicks       = (metrics.clicks                    ?? [])[0] ?? 0;
  const conversions  = (metrics.conversion_custom         ?? [])[0] ?? 0;
  const spend = billedMicros / 1_000_000;
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'twitter-ads', date, data: { spend, impressions, clicks, conversions } },
    'user_id,provider,date');
  return { spend, impressions, clicks, conversions };
}

async function syncTwitterAds(userId, integration) {
  const date = yesterday();
  const r = await syncTwitterAdsDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillTwitterAds(userId, integration, days = 365) {
  log(`  [twitter-ads backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncTwitterAdsDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  twitter-ads ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [twitter-ads backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑯ LINKEDIN ADS  (LinkedIn Marketing API v202401 — accessToken + accountId)
// ─────────────────────────────────────────────────────────────────────────────

async function syncLinkedInAdsDay(userId, accessToken, accountId, date) {
  const [year, month, day] = date.split('-').map(Number);
  const params = new URLSearchParams({
    q: 'analytics', pivot: 'ACCOUNT',
    dateRange: JSON.stringify({ start: { year, month, day }, end: { year, month, day } }),
    timeGranularity: 'DAILY',
    accounts: `urn:li:sponsoredAccount:${accountId}`,
    fields: 'costInLocalCurrency,impressions,clicks,externalWebsiteConversions',
  });
  const res = await fetchRetry('LinkedInAds', `https://api.linkedin.com/rest/adAnalytics?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': '202401', 'X-Restli-Protocol-Version': '2.0.0' },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`LinkedIn Ads ${res.status}: ${e?.message ?? res.statusText}`); }
  const body = await res.json();
  let spend = 0, impressions = 0, clicks = 0, conversions = 0;
  for (const el of body?.elements ?? []) {
    spend       += parseFloat(el.costInLocalCurrency ?? '0');
    impressions += el.impressions ?? 0;
    clicks      += el.clicks ?? 0;
    conversions += el.externalWebsiteConversions ?? 0;
  }
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'linkedin-ads', date, data: { spend, impressions, clicks, conversions, ctr } },
    'user_id,provider,date');
  return { spend, impressions, clicks, conversions, ctr };
}

async function syncLinkedInAds(userId, integration) {
  const date = yesterday();
  const r = await syncLinkedInAdsDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillLinkedInAds(userId, integration, days = 365) {
  log(`  [linkedin-ads backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncLinkedInAdsDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  linkedin-ads ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [linkedin-ads backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑰ SNAPCHAT ADS  (Snapchat Ads API v1 — accessToken + accountId)
// ─────────────────────────────────────────────────────────────────────────────

async function syncSnapchatAdsDay(userId, accessToken, accountId, date) {
  const params = new URLSearchParams({
    granularity: 'DAY', fields: 'impressions,swipes,spend,conversions',
    start_time: `${date}T00:00:00.000-0000`, end_time: `${date}T23:59:59.000-0000`,
  });
  const res = await fetchRetry('SnapchatAds', `https://adsapi.snapchat.com/v1/adaccounts/${accountId}/stats?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Snapchat Ads ${res.status}: ${e?.request_status ?? res.statusText}`); }
  const body = await res.json();
  const timeseries = body?.total_stats?.[0]?.total_stat?.timeseries ?? [];
  let spend = 0, impressions = 0, swipes = 0, conversions = 0;
  for (const t of timeseries) {
    spend       += (t.stats?.spend       ?? 0) / 1_000_000;
    impressions += t.stats?.impressions ?? 0;
    swipes      += t.stats?.swipes      ?? 0;
    conversions += t.stats?.conversions ?? 0;
  }
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'snapchat-ads', date, data: { spend, impressions, swipes, conversions } },
    'user_id,provider,date');
  return { spend, impressions, swipes, conversions };
}

async function syncSnapchatAds(userId, integration) {
  const date = yesterday();
  const r = await syncSnapchatAdsDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillSnapchatAds(userId, integration, days = 365) {
  log(`  [snapchat-ads backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncSnapchatAdsDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  snapchat-ads ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [snapchat-ads backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑱ PINTEREST ADS  (Pinterest Ads API v5 — accessToken + accountId)
// ─────────────────────────────────────────────────────────────────────────────

async function syncPinterestAdsDay(userId, accessToken, accountId, date) {
  const params = new URLSearchParams({
    start_date: date, end_date: date,
    columns: 'SPEND_IN_DOLLAR,IMPRESSION_1,CLICK_TYPE_URL,TOTAL_CONVERSIONS',
    granularity: 'DAY',
  });
  const res = await fetchRetry('PinterestAds', `https://api.pinterest.com/v5/ad_accounts/${accountId}/analytics?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Pinterest Ads ${res.status}: ${e?.message ?? res.statusText}`); }
  const body = await res.json();
  const rows = body?.value ?? body ?? [];
  let spend = 0, impressions = 0, clicks = 0, conversions = 0;
  for (const row of rows) {
    spend       += row.metrics?.SPEND_IN_DOLLAR   ?? 0;
    impressions += row.metrics?.IMPRESSION_1      ?? 0;
    clicks      += row.metrics?.CLICK_TYPE_URL    ?? 0;
    conversions += row.metrics?.TOTAL_CONVERSIONS ?? 0;
  }
  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'pinterest-ads', date, data: { spend, impressions, clicks, conversions } },
    'user_id,provider,date');
  return { spend, impressions, clicks, conversions };
}

async function syncPinterestAds(userId, integration) {
  const date = yesterday();
  const r = await syncPinterestAdsDay(userId, integration.access_token, integration.account_id, date);
  return { date, ...r };
}

async function backfillPinterestAds(userId, integration, days = 365) {
  log(`  [pinterest-ads backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncPinterestAdsDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  pinterest-ads ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [pinterest-ads backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑲ MAILCHIMP  (Mailchimp API v3 — apiKey, dc extracted from key)
// ─────────────────────────────────────────────────────────────────────────────

async function syncMailchimpDay(userId, apiKey, dc, date) {
  const base = `https://${dc}.api.mailchimp.com/3.0`;
  const authHeader = `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`;
  const headers = { Authorization: authHeader };

  const dateStart = `${date}T00:00:00+00:00`;
  const dateEnd   = `${date}T23:59:59+00:00`;

  let emailsSent = 0, opens = 0, clicks = 0;
  try {
    const params = new URLSearchParams({
      count: '200', since_send_time: dateStart, before_send_time: dateEnd,
      fields: 'reports.emails_sent,reports.opens.opens_total,reports.clicks.clicks_total',
    });
    const res = await fetchRetry('Mailchimp', `${base}/reports?${params}`, { headers });
    if (res.ok) {
      const body = await res.json();
      for (const r of body?.reports ?? []) {
        emailsSent += r.emails_sent          ?? 0;
        opens      += r.opens?.opens_total   ?? 0;
        clicks     += r.clicks?.clicks_total ?? 0;
      }
    }
  } catch { /* optional */ }

  let subscribers = 0, unsubscribes = 0;
  try {
    const listsRes = await fetchRetry('Mailchimp-lists', `${base}/lists?count=50&fields=lists.id`, { headers });
    if (listsRes.ok) {
      const listsBody = await listsRes.json();
      for (const list of listsBody?.lists ?? []) {
        const actRes = await fetchRetry('Mailchimp-activity', `${base}/lists/${list.id}/activity?count=1&fields=activity.subs,activity.unsubs,activity.day`, { headers });
        if (!actRes.ok) continue;
        const actBody = await actRes.json();
        for (const day of actBody?.activity ?? []) {
          if (day.day === date) { subscribers += day.subs ?? 0; unsubscribes += day.unsubs ?? 0; }
        }
      }
    }
  } catch { /* optional */ }

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'mailchimp', date, data: { emailsSent, opens, clicks, subscribers, unsubscribes } },
    'user_id,provider,date');
  return { emailsSent, opens, clicks, subscribers, unsubscribes };
}

async function syncMailchimp(userId, integration) {
  const date = yesterday();
  const dc = integration.account_id || (integration.access_token.split('-').pop());
  const r = await syncMailchimpDay(userId, integration.access_token, dc, date);
  return { date, ...r };
}

async function backfillMailchimp(userId, integration, days = 365) {
  log(`  [mailchimp backfill] ${days} days for user ${userId.slice(0, 8)}`);
  const dc = integration.account_id || (integration.access_token.split('-').pop());
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncMailchimpDay(userId, integration.access_token, dc, date); ok++; }
    catch (err) { logFail(`  mailchimp ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [mailchimp backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑳ KLAVIYO  (Klaviyo API v2024-02-15 — private API key)
// ─────────────────────────────────────────────────────────────────────────────

async function syncKlaviyoDay(userId, apiKey, date) {
  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-02-15',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const dateStart = `${date}T00:00:00+00:00`;
  const dateEnd   = `${date}T23:59:59+00:00`;

  async function fetchAggregate(metricName, measurement) {
    const listRes = await fetchRetry(`Klaviyo-metric-${metricName}`,
      `https://a.klaviyo.com/api/metrics/?filter=equals(name,"${encodeURIComponent(metricName)}")`,
      { headers });
    if (!listRes.ok) return 0;
    const listBody = await listRes.json();
    const metricId = listBody?.data?.[0]?.id;
    if (!metricId) return 0;
    const aggRes = await fetchRetry(`Klaviyo-agg-${metricName}`, 'https://a.klaviyo.com/api/metric-aggregates/', {
      method: 'POST', headers,
      body: JSON.stringify({ data: { type: 'metric-aggregate', attributes: {
        metric_id: metricId, measurements: [measurement], interval: 'day', page_size: 1,
        filter: [`greater-or-equal(datetime,${dateStart})`, `less-than(datetime,${dateEnd})`],
        timezone: 'UTC',
      }}}),
    });
    if (!aggRes.ok) return 0;
    const aggBody = await aggRes.json();
    const values = aggBody?.data?.attributes?.values?.[0] ?? [];
    return values.reduce((a, b) => a + b, 0);
  }

  const [emailsSent, opens, clicks, revenue] = await Promise.all([
    fetchAggregate('Received Email', 'count').catch(() => 0),
    fetchAggregate('Opened Email',   'count').catch(() => 0),
    fetchAggregate('Clicked Email',  'count').catch(() => 0),
    fetchAggregate('Placed Order',   'sum_value').catch(() => 0),
  ]);

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'klaviyo', date, data: { emailsSent, opens, clicks, revenue, activeProfiles: 0 } },
    'user_id,provider,date');
  return { emailsSent, opens, clicks, revenue };
}

async function syncKlaviyo(userId, integration) {
  const date = yesterday();
  const r = await syncKlaviyoDay(userId, integration.access_token, date);
  return { date, ...r };
}

async function backfillKlaviyo(userId, integration, days = 365) {
  log(`  [klaviyo backfill] ${days} days for user ${userId.slice(0, 8)} — 4 bulk requests`);
  const apiKey    = integration.access_token;
  const startDate = daysAgo(days);
  const endDate   = yesterday();
  const startISO  = `${startDate}T00:00:00+00:00`;
  const endISO    = `${endDate}T23:59:59+00:00`;

  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-02-15',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  // Resolve metric ID by name
  async function getMetricId(name) {
    const res = await fetchRetry(`Klaviyo-metric-${name}`,
      `https://a.klaviyo.com/api/metrics/?filter=equals(name,"${encodeURIComponent(name)}")`,
      { headers });
    if (!res.ok) return null;
    return (await res.json())?.data?.[0]?.id ?? null;
  }

  // Fetch full date-range aggregation for a metric (returns [{date, value}])
  async function fetchBulkAggregate(metricId, measurement) {
    const res = await fetchRetry(`Klaviyo-bulk-agg-${metricId}`, 'https://a.klaviyo.com/api/metric-aggregates/', {
      method: 'POST', headers,
      body: JSON.stringify({ data: { type: 'metric-aggregate', attributes: {
        metric_id: metricId, measurements: [measurement], interval: 'day',
        page_size: 500,
        filter: [`greater-or-equal(datetime,${startISO})`, `less-than(datetime,${endISO})`],
        timezone: 'UTC',
      }}}),
    });
    if (!res.ok) return [];
    const body = await res.json();
    const dates  = body?.data?.attributes?.dates  ?? [];
    const values = body?.data?.attributes?.values?.[0] ?? [];
    return dates.map((d, i) => ({ date: d.slice(0, 10), value: values[i] ?? 0 }));
  }

  try {
    const [sentId, openId, clickId, orderId] = await Promise.all([
      getMetricId('Received Email'),
      getMetricId('Opened Email'),
      getMetricId('Clicked Email'),
      getMetricId('Placed Order'),
    ]);

    const [sentRows, openRows, clickRows, revenueRows] = await Promise.all([
      sentId    ? fetchBulkAggregate(sentId,    'count')     : Promise.resolve([]),
      openId    ? fetchBulkAggregate(openId,    'count')     : Promise.resolve([]),
      clickId   ? fetchBulkAggregate(clickId,   'count')     : Promise.resolve([]),
      orderId   ? fetchBulkAggregate(orderId,   'sum_value') : Promise.resolve([]),
    ]);

    // Index by date
    const byDate = {};
    for (const r of sentRows)    { byDate[r.date] ??= {}; byDate[r.date].emailsSent = r.value; }
    for (const r of openRows)    { byDate[r.date] ??= {}; byDate[r.date].opens      = r.value; }
    for (const r of clickRows)   { byDate[r.date] ??= {}; byDate[r.date].clicks     = r.value; }
    for (const r of revenueRows) { byDate[r.date] ??= {}; byDate[r.date].revenue    = r.value; }

    let ok = 0;
    for (const [date, vals] of Object.entries(byDate)) {
      await SB.upsert('daily_snapshots',
        { user_id: userId, provider: 'klaviyo', date, data: {
          emailsSent:    vals.emailsSent    ?? 0,
          opens:         vals.opens         ?? 0,
          clicks:        vals.clicks        ?? 0,
          revenue:       vals.revenue       ?? 0,
          activeProfiles: 0,
        }},
        'user_id,provider,date');
      ok++;
    }
    log(`  [klaviyo backfill] done — ${ok} days saved (4 requests)`);
  } catch (err) {
    logWarn(`  [klaviyo backfill] bulk failed (${err.message}), falling back to per-day`);
    let ok = 0, skipped = 0;
    for (let offset = days; offset >= 1; offset--) {
      const date = daysAgo(offset);
      try { await syncKlaviyoDay(userId, apiKey, date); ok++; }
      catch (e) { logFail(`  klaviyo ${date} — ${e.message}`); skipped++; }
      await sleep(400);
    }
    log(`  [klaviyo backfill] fallback done — ${ok} days saved, ${skipped} errors`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉑ CONVERTKIT  (ConvertKit API v3 — API secret key)
// ─────────────────────────────────────────────────────────────────────────────

async function syncConvertKitDay(userId, apiKey, date) {
  const base   = 'https://api.convertkit.com/v3';
  const secret = `api_secret=${encodeURIComponent(apiKey)}`;

  let totalSubscribers = 0;
  try {
    const res = await fetchRetry('CK-subscribers', `${base}/subscribers?${secret}&sort_field=created_at`);
    if (res.ok) { const body = await res.json(); totalSubscribers = body?.total_subscribers ?? 0; }
  } catch { /* optional */ }

  let newSubscribers = 0;
  try {
    const params = new URLSearchParams({ api_secret: apiKey, from: date, to: date, sort_field: 'created_at' });
    const res = await fetchRetry('CK-new-subs', `${base}/subscribers?${params}`);
    if (res.ok) { const body = await res.json(); newSubscribers = body?.total_subscribers ?? 0; }
  } catch { /* optional */ }

  let broadcastsSent = 0;
  try {
    const res = await fetchRetry('CK-broadcasts', `${base}/broadcasts?${secret}`);
    if (res.ok) {
      const body = await res.json();
      broadcastsSent = (body?.broadcasts ?? []).filter(b => {
        const sentDate = (b.published_at ?? b.send_date ?? '').slice(0, 10);
        return sentDate === date;
      }).length;
    }
  } catch { /* optional */ }

  await SB.upsert('daily_snapshots',
    { user_id: userId, provider: 'convertkit', date, data: { totalSubscribers, broadcastsSent, newSubscribers } },
    'user_id,provider,date');
  return { totalSubscribers, broadcastsSent, newSubscribers };
}

async function syncConvertKit(userId, integration) {
  const date = yesterday();
  const r = await syncConvertKitDay(userId, integration.access_token, date);
  return { date, ...r };
}

async function backfillConvertKit(userId, integration, days = 365) {
  log(`  [convertkit backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncConvertKitDay(userId, integration.access_token, date); ok++; }
    catch (err) { logFail(`  convertkit ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [convertkit backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉒ ACTIVECAMPAIGN
// ─────────────────────────────────────────────────────────────────────────────
async function syncActiveCampaignDay(userId, apiUrl, apiKey, date) {
  const { syncActiveCampaignDay: fn } = await import('../lib/integrations/activecampaign/sync.js');
  return fn(userId, apiUrl, apiKey, date);
}
async function syncActiveCampaign(userId, integration) {
  const date = yesterday();
  const r = await syncActiveCampaignDay(userId, integration.account_id, integration.access_token, date);
  return { ...r, date };
}
async function backfillActiveCampaign(userId, integration, days = 365) {
  log(`  [activecampaign backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncActiveCampaignDay(userId, integration.account_id, integration.access_token, date); ok++; }
    catch (err) { logFail(`  activecampaign ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [activecampaign backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉓ BREVO
// ─────────────────────────────────────────────────────────────────────────────
async function syncBrevoDay(userId, apiKey, date) {
  const { syncBrevoDay: fn } = await import('../lib/integrations/brevo/sync.js');
  return fn(userId, apiKey, date);
}
async function syncBrevo(userId, integration) {
  const date = yesterday();
  const r = await syncBrevoDay(userId, integration.access_token, date);
  return { ...r, date };
}
async function backfillBrevo(userId, integration, days = 365) {
  log(`  [brevo backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncBrevoDay(userId, integration.access_token, date); ok++; }
    catch (err) { logFail(`  brevo ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [brevo backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉔ BEEHIIV
// ─────────────────────────────────────────────────────────────────────────────
async function syncBeehiivDay(userId, apiKey, publicationId, date) {
  const { syncBeehiivDay: fn } = await import('../lib/integrations/beehiiv/sync.js');
  return fn(userId, apiKey, publicationId, date);
}
async function syncBeehiiv(userId, integration) {
  const date = yesterday();
  const r = await syncBeehiivDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillBeehiiv(userId, integration, days = 365) {
  log(`  [beehiiv backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncBeehiivDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  beehiiv ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [beehiiv backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉕ SHOPIFY
// ─────────────────────────────────────────────────────────────────────────────
async function syncShopifyDay(userId, storeDomain, accessToken, date) {
  const { syncShopifyDay: fn } = await import('../lib/integrations/shopify/sync.js');
  return fn(userId, storeDomain, accessToken, date);
}
async function syncShopify(userId, integration) {
  const date = yesterday();
  const r = await syncShopifyDay(userId, integration.account_id, integration.access_token, date);
  return { ...r, date };
}
async function backfillShopify(userId, integration, days = 365) {
  log(`  [shopify backfill] ${days} days for user ${userId.slice(0, 8)} — bulk paginated fetch`);
  const storeDomain = integration.account_id;
  const accessToken = integration.access_token;
  const startDate   = `${daysAgo(days)}T00:00:00-00:00`;
  const headers     = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };

  const byDate = {};
  let url = `https://${storeDomain}/admin/api/2024-01/orders.json?status=any&created_at_min=${encodeURIComponent(startDate)}&limit=250&fields=id,created_at,total_price,total_tax,financial_status`;
  while (url) {
    const res = await fetchRetry('Shopify orders bulk', url, { headers });
    if (!res.ok) { logWarn(`  [shopify backfill] bulk failed (${res.status}), falling back to per-day`); break; }
    const body = await res.json();
    const orders = body.orders ?? [];
    if (orders.length === 0) break;
    for (const order of orders) {
      if (!['paid','partially_refunded','refunded'].includes(order.financial_status)) continue;
      const date    = (order.created_at ?? '').slice(0, 10);
      const revenue = parseFloat(order.total_price ?? '0');
      byDate[date] ??= { revenue: 0, txCount: 0 };
      byDate[date].revenue  += revenue;
      byDate[date].txCount  += 1;
    }
    // Shopify pagination via Link header
    const linkHeader = res.headers.get('Link') ?? '';
    const nextMatch  = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
    if (url) await sleep(200);
  }

  if (Object.keys(byDate).length === 0) {
    // Fallback to per-day
    let ok = 0, skipped = 0;
    for (let offset = days; offset >= 1; offset--) {
      const date = daysAgo(offset);
      try { await syncShopifyDay(userId, storeDomain, accessToken, date); ok++; }
      catch (err) { logFail(`  shopify ${date} — ${err.message}`); skipped++; }
      await sleep(300);
    }
    log(`  [shopify backfill] fallback done — ${ok} days saved, ${skipped} errors`);
    return;
  }

  let ok = 0;
  for (const [date, vals] of Object.entries(byDate)) {
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'shopify', date, data: { revenue: vals.revenue, txCount: vals.txCount, refunds: 0, newCustomers: 0 } },
      'user_id,provider,date');
    ok++;
  }
  log(`  [shopify backfill] done — ${ok} days with data (bulk fetch)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉖ WOOCOMMERCE
// ─────────────────────────────────────────────────────────────────────────────
async function syncWooCommerceDay(userId, credentials, siteUrl, date) {
  const { syncWooCommerceDay: fn } = await import('../lib/integrations/woocommerce/sync.js');
  return fn(userId, credentials, siteUrl, date);
}
async function syncWooCommerce(userId, integration) {
  const date = yesterday();
  const r = await syncWooCommerceDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillWooCommerce(userId, integration, days = 365) {
  log(`  [woocommerce backfill] ${days} days for user ${userId.slice(0, 8)} — bulk paginated fetch`);
  const credentials = integration.access_token; // "consumerKey:consumerSecret"
  const siteUrl     = integration.account_id;
  const startDate   = `${daysAgo(days)}T00:00:00`;
  const auth        = Buffer.from(credentials).toString('base64');
  const headers     = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  const byDate = {};
  let page = 1;
  while (true) {
    const params = new URLSearchParams({ after: startDate, per_page: '100', page: String(page), status: 'completed,processing,refunded' });
    const res = await fetchRetry('WooCommerce orders bulk', `${siteUrl}/wp-json/wc/v3/orders?${params}`, { headers });
    if (!res.ok) { logWarn(`  [woocommerce backfill] bulk failed (${res.status}), falling back to per-day`); break; }
    const orders = await res.json();
    if (!Array.isArray(orders) || orders.length === 0) break;
    for (const order of orders) {
      const date    = (order.date_created ?? '').slice(0, 10);
      const revenue = parseFloat(order.total ?? '0');
      byDate[date] ??= { revenue: 0, txCount: 0 };
      byDate[date].revenue  += revenue;
      byDate[date].txCount  += 1;
    }
    if (orders.length < 100) break;
    page++;
    await sleep(200);
  }

  if (Object.keys(byDate).length === 0) {
    let ok = 0, skipped = 0;
    for (let offset = days; offset >= 1; offset--) {
      const date = daysAgo(offset);
      try { await syncWooCommerceDay(userId, credentials, siteUrl, date); ok++; }
      catch (err) { logFail(`  woocommerce ${date} — ${err.message}`); skipped++; }
      await sleep(300);
    }
    log(`  [woocommerce backfill] fallback done — ${ok} days saved, ${skipped} errors`);
    return;
  }

  let ok = 0;
  for (const [date, vals] of Object.entries(byDate)) {
    await SB.upsert('daily_snapshots',
      { user_id: userId, provider: 'woocommerce', date, data: { revenue: vals.revenue, txCount: vals.txCount, refunds: 0, newCustomers: 0 } },
      'user_id,provider,date');
    ok++;
  }
  log(`  [woocommerce backfill] done — ${ok} days with data (bulk fetch)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉗ BIGCOMMERCE
// ─────────────────────────────────────────────────────────────────────────────
async function syncBigCommerceDay(userId, storeHash, accessToken, date) {
  const { syncBigCommerceDay: fn } = await import('../lib/integrations/bigcommerce/sync.js');
  return fn(userId, storeHash, accessToken, date);
}
async function syncBigCommerce(userId, integration) {
  const date = yesterday();
  const r = await syncBigCommerceDay(userId, integration.account_id, integration.access_token, date);
  return { ...r, date };
}
async function backfillBigCommerce(userId, integration, days = 365) {
  log(`  [bigcommerce backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncBigCommerceDay(userId, integration.account_id, integration.access_token, date); ok++; }
    catch (err) { logFail(`  bigcommerce ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [bigcommerce backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉘ AMAZON SELLER
// ─────────────────────────────────────────────────────────────────────────────
async function syncAmazonSellerDay(userId, credentials, refreshToken, sellerId, date) {
  const { syncAmazonSellerDay: fn } = await import('../lib/integrations/amazon-seller/sync.js');
  return fn(userId, credentials, refreshToken, sellerId, date);
}
async function syncAmazonSeller(userId, integration) {
  const date = yesterday();
  const r = await syncAmazonSellerDay(
    userId,
    integration.access_token,
    integration.refresh_token,
    integration.account_id,
    date,
  );
  return { ...r, date };
}
async function backfillAmazonSeller(userId, integration, days = 365) {
  log(`  [amazon-seller backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try {
      await syncAmazonSellerDay(
        userId,
        integration.access_token,
        integration.refresh_token,
        integration.account_id,
        date,
      );
      ok++;
    }
    catch (err) { logFail(`  amazon-seller ${date} — ${err.message}`); skipped++; }
    await sleep(500); // SP-API rate limits are strict
  }
  log(`  [amazon-seller backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉙ ETSY
// ─────────────────────────────────────────────────────────────────────────────
async function syncEtsyDay(userId, apiKey, shopId, date) {
  const { syncEtsyDay: fn } = await import('../lib/integrations/etsy/sync.js');
  return fn(userId, apiKey, shopId, date);
}
async function syncEtsy(userId, integration) {
  const date = yesterday();
  const r = await syncEtsyDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillEtsy(userId, integration, days = 365) {
  log(`  [etsy backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncEtsyDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  etsy ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [etsy backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉚ HUBSPOT
// ─────────────────────────────────────────────────────────────────────────────
async function syncHubSpotDay(userId, accessToken, date) {
  const { syncHubSpotDay: fn } = await import('../lib/integrations/hubspot/sync.js');
  return fn(userId, accessToken, date);
}
async function syncHubSpot(userId, integration) {
  const date = yesterday();
  const r = await syncHubSpotDay(userId, integration.access_token, date);
  return { ...r, date };
}
async function backfillHubSpot(userId, integration, days = 365) {
  log(`  [hubspot backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncHubSpotDay(userId, integration.access_token, date); ok++; }
    catch (err) { logFail(`  hubspot ${date} — ${err.message}`); skipped++; }
    await sleep(250);
  }
  log(`  [hubspot backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ㉛ SALESFORCE
// ─────────────────────────────────────────────────────────────────────────────
async function syncSalesforceDay(userId, instanceUrl, accessToken, date) {
  const { syncSalesforceDay: fn } = await import('../lib/integrations/salesforce/sync.js');
  return fn(userId, instanceUrl, accessToken, date);
}
async function syncSalesforce(userId, integration) {
  const date = yesterday();
  const r = await syncSalesforceDay(userId, integration.account_id, integration.access_token, date);
  return { ...r, date };
}
async function backfillSalesforce(userId, integration, days = 365) {
  log(`  [salesforce backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncSalesforceDay(userId, integration.account_id, integration.access_token, date); ok++; }
    catch (err) { logFail(`  salesforce ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [salesforce backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㉜ PIPEDRIVE
// ─────────────────────────────────────────────────────────────────────────────
async function syncPipedriveDay(userId, apiToken, date) {
  const { syncPipedriveDay: fn } = await import('../lib/integrations/pipedrive/sync.js');
  return fn(userId, apiToken, date);
}
async function syncPipedrive(userId, integration) {
  const date = yesterday();
  const r = await syncPipedriveDay(userId, integration.access_token, date);
  return { ...r, date };
}
async function backfillPipedrive(userId, integration, days = 365) {
  log(`  [pipedrive backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncPipedriveDay(userId, integration.access_token, date); ok++; }
    catch (err) { logFail(`  pipedrive ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [pipedrive backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㉝ NOTION
// ─────────────────────────────────────────────────────────────────────────────
async function syncNotionDay(userId, apiToken, databaseId, date) {
  const { syncNotionDay: fn } = await import('../lib/integrations/notion/sync.js');
  return fn(userId, apiToken, databaseId, date);
}
async function syncNotion(userId, integration) {
  const date = yesterday();
  const r = await syncNotionDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillNotion(userId, integration, days = 365) {
  log(`  [notion backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncNotionDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  notion ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [notion backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㉞ INTERCOM
// ─────────────────────────────────────────────────────────────────────────────
async function syncIntercomDay(userId, accessToken, date) {
  const { syncIntercomDay: fn } = await import('../lib/integrations/intercom/sync.js');
  return fn(userId, accessToken, date);
}
async function syncIntercom(userId, integration) {
  const date = yesterday();
  const r = await syncIntercomDay(userId, integration.access_token, date);
  return { ...r, date };
}
async function backfillIntercom(userId, integration, days = 365) {
  log(`  [intercom backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncIntercomDay(userId, integration.access_token, date); ok++; }
    catch (err) { logFail(`  intercom ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [intercom backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㉟ ZENDESK
// ─────────────────────────────────────────────────────────────────────────────
async function syncZendeskDay(userId, credentials, subdomain, date) {
  const { syncZendeskDay: fn } = await import('../lib/integrations/zendesk/sync.js');
  return fn(userId, credentials, subdomain, date);
}
async function syncZendesk(userId, integration) {
  const date = yesterday();
  const r = await syncZendeskDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillZendesk(userId, integration, days = 365) {
  log(`  [zendesk backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncZendeskDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  zendesk ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [zendesk backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㊱ FRESHDESK
// ─────────────────────────────────────────────────────────────────────────────
async function syncFreshdeskDay(userId, apiKey, subdomain, date) {
  const { syncFreshdeskDay: fn } = await import('../lib/integrations/freshdesk/sync.js');
  return fn(userId, apiKey, subdomain, date);
}
async function syncFreshdesk(userId, integration) {
  const date = yesterday();
  const r = await syncFreshdeskDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillFreshdesk(userId, integration, days = 365) {
  log(`  [freshdesk backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncFreshdeskDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  freshdesk ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [freshdesk backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㊲ SEGMENT
// ─────────────────────────────────────────────────────────────────────────────
async function syncSegmentDay(userId, accessToken, workspaceId, date) {
  const { syncSegmentDay: fn } = await import('../lib/integrations/segment/sync.js');
  return fn(userId, accessToken, workspaceId, date);
}
async function syncSegment(userId, integration) {
  const date = yesterday();
  const r = await syncSegmentDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillSegment(userId, integration, days = 365) {
  log(`  [segment backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncSegmentDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  segment ${date} — ${err.message}`); skipped++; }
    await sleep(400);
  }
  log(`  [segment backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㊳ HEAP
// ─────────────────────────────────────────────────────────────────────────────
async function syncHeapDay(userId, credentials, appId, date) {
  const { syncHeapDay: fn } = await import('../lib/integrations/heap/sync.js');
  return fn(userId, credentials, appId, date);
}
async function syncHeap(userId, integration) {
  const date = yesterday();
  const r = await syncHeapDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillHeap(userId, integration, days = 90) {
  log(`  [heap backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncHeapDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  heap ${date} — ${err.message}`); skipped++; }
    await sleep(400);
  }
  log(`  [heap backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㊴ FULLSTORY
// ─────────────────────────────────────────────────────────────────────────────
async function syncFullStoryDay(userId, apiKey, orgId, date) {
  const { syncFullStoryDay: fn } = await import('../lib/integrations/fullstory/sync.js');
  return fn(userId, apiKey, orgId, date);
}
async function syncFullStory(userId, integration) {
  const date = yesterday();
  const r = await syncFullStoryDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillFullStory(userId, integration, days = 90) {
  log(`  [fullstory backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncFullStoryDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  fullstory ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [fullstory backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㊵ HOTJAR
// ─────────────────────────────────────────────────────────────────────────────
async function syncHotjarDay(userId, accessToken, siteId, date) {
  const { syncHotjarDay: fn } = await import('../lib/integrations/hotjar/sync.js');
  return fn(userId, accessToken, siteId, date);
}
async function syncHotjar(userId, integration) {
  const date = yesterday();
  const r = await syncHotjarDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillHotjar(userId, integration, days = 90) {
  log(`  [hotjar backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncHotjarDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  hotjar ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [hotjar backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㊶ INSTAGRAM
// ─────────────────────────────────────────────────────────────────────────────
async function syncInstagramDay(userId, accessToken, businessAccountId, date) {
  const { syncInstagramDay: fn } = await import('../lib/integrations/instagram/sync.js');
  return fn(userId, accessToken, businessAccountId, date);
}
async function syncInstagram(userId, integration) {
  const date = yesterday();
  const r = await syncInstagramDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillInstagram(userId, integration, days = 90) {
  log(`  [instagram backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncInstagramDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  instagram ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [instagram backfill] done — ${ok} days saved, ${skipped} errors`);
}
// ㊷ YOUTUBE
// ─────────────────────────────────────────────────────────────────────────────
async function syncYouTubeDay(userId, accessToken, channelId, date) {
  const { syncYouTubeDay: fn } = await import('../lib/integrations/youtube/sync.js');
  return fn(userId, accessToken, channelId, date);
}
async function syncYouTube(userId, integration) {
  const date = yesterday();
  const r = await syncYouTubeDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillYouTube(userId, integration, days = 90) {
  log(`  [youtube backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncYouTubeDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  youtube ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [youtube backfill] done — ${ok} days saved, ${skipped} errors`);
}

// ㊸ TWITTER (organic)
// ─────────────────────────────────────────────────────────────────────────────
async function syncTwitterOrganicDay(userId, bearerToken, accountId, date) {
  const { syncTwitterOrganicDay: fn } = await import('../lib/integrations/twitter-organic/sync.js');
  return fn(userId, bearerToken, accountId, date);
}
async function syncTwitterOrganic(userId, integration) {
  const date = yesterday();
  const r = await syncTwitterOrganicDay(userId, integration.access_token, integration.account_id, date);
  return { ...r, date };
}
async function backfillTwitterOrganic(userId, integration, days = 90) {
  log(`  [twitter-organic backfill] ${days} days for user ${userId.slice(0, 8)}`);
  let ok = 0, skipped = 0;
  for (let offset = days; offset >= 1; offset--) {
    const date = daysAgo(offset);
    try { await syncTwitterOrganicDay(userId, integration.access_token, integration.account_id, date); ok++; }
    catch (err) { logFail(`  twitter-organic ${date} — ${err.message}`); skipped++; }
    await sleep(300);
  }
  log(`  [twitter-organic backfill] done — ${ok} days saved, ${skipped} errors`);
}
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
    rows = await SB.select('integrations', 'user_id,platform,access_token,refresh_token,account_id,currency', filters);
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
      await sleep(2_000);
    }

    if (plats.paypal) {
      try {
        await backfillPayPal(uid, plats.paypal);
      } catch (err) { logFail(`paypal backfill: ${err.message}`); }
      await sleep(2_000);
    }

    if (plats.paddle) {
      try {
        await backfillPaddle(uid, plats.paddle);
      } catch (err) { logFail(`paddle backfill: ${err.message}`); }
    }

    if (plats['lemon-squeezy']) {
      try {
        await backfillLemonSqueezy(uid, plats['lemon-squeezy']);
      } catch (err) { logFail(`lemonsqueezy backfill: ${err.message}`); }
    }

    if (plats.gumroad) {
      try {
        await backfillGumroad(uid, plats.gumroad);
      } catch (err) { logFail(`gumroad backfill: ${err.message}`); }
    }

    if (plats.plausible) {
      try {
        await backfillPlausible(uid, plats.plausible);
      } catch (err) { logFail(`plausible backfill: ${err.message}`); }
    }

    if (plats.mixpanel) {
      try {
        await backfillMixpanel(uid, plats.mixpanel);
      } catch (err) { logFail(`mixpanel backfill: ${err.message}`); }
    }

    if (plats.amplitude) {
      try {
        await backfillAmplitude(uid, plats.amplitude);
      } catch (err) { logFail(`amplitude backfill: ${err.message}`); }
    }

    if (plats.posthog) {
      try {
        await backfillPostHog(uid, plats.posthog);
      } catch (err) { logFail(`posthog backfill: ${err.message}`); }
    }

    if (plats.fathom) {
      try {
        await backfillFathom(uid, plats.fathom);
      } catch (err) { logFail(`fathom backfill: ${err.message}`); }
    }

    if (plats['google-ads']) {
      try {
        await backfillGoogleAds(uid, plats['google-ads']);
      } catch (err) { logFail(`google-ads backfill: ${err.message}`); }
    }

    if (plats['tiktok-ads']) {
      try {
        await backfillTikTokAds(uid, plats['tiktok-ads']);
      } catch (err) { logFail(`tiktok-ads backfill: ${err.message}`); }
    }

    if (plats['twitter-ads']) {
      try {
        await backfillTwitterAds(uid, plats['twitter-ads']);
      } catch (err) { logFail(`twitter-ads backfill: ${err.message}`); }
    }

    if (plats['linkedin-ads']) {
      try {
        await backfillLinkedInAds(uid, plats['linkedin-ads']);
      } catch (err) { logFail(`linkedin-ads backfill: ${err.message}`); }
    }

    if (plats['snapchat-ads']) {
      try {
        await backfillSnapchatAds(uid, plats['snapchat-ads']);
      } catch (err) { logFail(`snapchat-ads backfill: ${err.message}`); }
    }

    if (plats['pinterest-ads']) {
      try {
        await backfillPinterestAds(uid, plats['pinterest-ads']);
      } catch (err) { logFail(`pinterest-ads backfill: ${err.message}`); }
    }

    if (plats.mailchimp) {
      try {
        await backfillMailchimp(uid, plats.mailchimp);
      } catch (err) { logFail(`mailchimp backfill: ${err.message}`); }
    }

    if (plats.klaviyo) {
      try {
        await backfillKlaviyo(uid, plats.klaviyo);
      } catch (err) { logFail(`klaviyo backfill: ${err.message}`); }
    }

    if (plats.convertkit) {
      try {
        await backfillConvertKit(uid, plats.convertkit);
      } catch (err) { logFail(`convertkit backfill: ${err.message}`); }
    }

    if (plats.activecampaign) {
      try {
        await backfillActiveCampaign(uid, plats.activecampaign);
      } catch (err) { logFail(`activecampaign backfill: ${err.message}`); }
    }

    if (plats.brevo) {
      try {
        await backfillBrevo(uid, plats.brevo);
      } catch (err) { logFail(`brevo backfill: ${err.message}`); }
    }

    if (plats.beehiiv) {
      try {
        await backfillBeehiiv(uid, plats.beehiiv);
      } catch (err) { logFail(`beehiiv backfill: ${err.message}`); }
    }

    if (plats.shopify) {
      try {
        await backfillShopify(uid, plats.shopify);
      } catch (err) { logFail(`shopify backfill: ${err.message}`); }
    }

    if (plats.woocommerce) {
      try {
        await backfillWooCommerce(uid, plats.woocommerce);
      } catch (err) { logFail(`woocommerce backfill: ${err.message}`); }
    }

    if (plats.bigcommerce) {
      try {
        await backfillBigCommerce(uid, plats.bigcommerce);
      } catch (err) { logFail(`bigcommerce backfill: ${err.message}`); }
    }

    if (plats['amazon-seller']) {
      try {
        await backfillAmazonSeller(uid, plats['amazon-seller']);
      } catch (err) { logFail(`amazon-seller backfill: ${err.message}`); }
    }

    if (plats.etsy) {
      try {
        await backfillEtsy(uid, plats.etsy);
      } catch (err) { logFail(`etsy backfill: ${err.message}`); }
    }

    if (plats.hubspot) {
      try {
        await backfillHubSpot(uid, plats.hubspot);
      } catch (err) { logFail(`hubspot backfill: ${err.message}`); }
    }

    if (plats.salesforce) {
      try {
        await backfillSalesforce(uid, plats.salesforce);
      } catch (err) { logFail(`salesforce backfill: ${err.message}`); }
    }

    if (plats.pipedrive) {
      try {
        await backfillPipedrive(uid, plats.pipedrive);
      } catch (err) { logFail(`pipedrive backfill: ${err.message}`); }
    }

    if (plats.notion) {
      try {
        await backfillNotion(uid, plats.notion);
      } catch (err) { logFail(`notion backfill: ${err.message}`); }
    }

    if (plats.intercom) {
      try {
        await backfillIntercom(uid, plats.intercom);
      } catch (err) { logFail(`intercom backfill: ${err.message}`); }
    }

    if (plats.zendesk) {
      try {
        await backfillZendesk(uid, plats.zendesk);
      } catch (err) { logFail(`zendesk backfill: ${err.message}`); }
    }

    if (plats.freshdesk) {
      try {
        await backfillFreshdesk(uid, plats.freshdesk);
      } catch (err) { logFail(`freshdesk backfill: ${err.message}`); }
    }

    if (plats.segment) {
      try {
        await backfillSegment(uid, plats.segment);
      } catch (err) { logFail(`segment backfill: ${err.message}`); }
    }

    if (plats.heap) {
      try {
        await backfillHeap(uid, plats.heap);
      } catch (err) { logFail(`heap backfill: ${err.message}`); }
    }

    if (plats.fullstory) {
      try {
        await backfillFullStory(uid, plats.fullstory);
      } catch (err) { logFail(`fullstory backfill: ${err.message}`); }
    }

    if (plats.hotjar) {
      try {
        await backfillHotjar(uid, plats.hotjar);
      } catch (err) { logFail(`hotjar backfill: ${err.message}`); }
    }

    if (plats.instagram) {
      try {
        await backfillInstagram(uid, plats.instagram);
      } catch (err) { logFail(`instagram backfill: ${err.message}`); }
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
    rows = await SB.select('integrations', 'user_id,platform,access_token,refresh_token,account_id,currency', filters);
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

  // ── helper: sync all platforms for one user in parallel ──────────────────
  async function syncUserPlatforms(uid, plats, userIdx) {
    log(`[${userIdx}/${userIds.length}] User ${uid.slice(0, 8)} (${Object.keys(plats).join(', ')})`);

    const platformOrder = ['stripe', 'ga4', 'meta', 'paypal', 'paddle', 'lemon-squeezy', 'gumroad', 'plausible', 'mixpanel', 'amplitude', 'posthog', 'fathom', 'google-ads', 'tiktok-ads', 'twitter-ads', 'linkedin-ads', 'snapchat-ads', 'pinterest-ads', 'mailchimp', 'klaviyo', 'convertkit', 'activecampaign', 'brevo', 'beehiiv', 'shopify', 'woocommerce', 'bigcommerce', 'amazon-seller', 'etsy', 'hubspot', 'salesforce', 'pipedrive', 'notion', 'intercom', 'zendesk', 'freshdesk', 'segment', 'heap', 'fullstory', 'hotjar', 'instagram', 'youtube', 'twitter-organic'];
    const activePlatforms = platformOrder.filter(p => plats[p]);

    const results = await Promise.allSettled(activePlatforms.map(async (platform) => {
      if (platform === 'stripe') {
        await healStripeCurrency(uid, plats.stripe.access_token);
        const r = await syncStripe(uid, plats.stripe.access_token);
        logOk(`stripe — ${r.date} | $${(r.revenue / 100).toFixed(2)} revenue | ${r.txCount} tx | ${r.newCustomers} new customers`);
      } else if (platform === 'ga4') {
        const r = await syncGA4(uid, plats.ga4);
        logOk(`ga4    — ${r.date} | ${r.sessions} sessions | ${r.totalUsers} users | ${(r.bounceRate * 100).toFixed(1)}% bounce`);
      } else if (platform === 'meta') {
        const r = await syncMeta(uid, plats.meta);
        logOk(`meta   — ${r.date} | $${r.spend} spend | ${r.reach} reach | ${r.clicks} clicks`);
      } else if (platform === 'paypal') {
        const r = await syncPayPal(uid, plats.paypal);
        logOk(`paypal — ${r.date} | $${r.revenue.toFixed(2)} revenue | ${r.txCount} tx`);
      } else if (platform === 'paddle') {
        const r = await syncPaddle(uid, plats.paddle);
        logOk(`paddle — ${r.date} | $${r.revenue.toFixed(2)} revenue | ${r.txCount} tx`);
      } else if (platform === 'lemon-squeezy') {
        const r = await syncLemonSqueezy(uid, plats['lemon-squeezy']);
        logOk(`lemonsqueezy — ${r.date} | $${r.revenue.toFixed(2)} revenue | ${r.txCount} tx`);
      } else if (platform === 'gumroad') {
        const r = await syncGumroad(uid, plats.gumroad);
        logOk(`gumroad — ${r.date} | $${r.revenue.toFixed(2)} revenue | ${r.txCount} tx`);
      } else if (platform === 'plausible') {
        const r = await syncPlausible(uid, plats.plausible);
        logOk(`plausible — ${r.date} | ${r.visitors} visitors | ${r.pageviews} pageviews`);
      } else if (platform === 'mixpanel') {
        const r = await syncMixpanel(uid, plats.mixpanel);
        logOk(`mixpanel — ${r.date} | ${r.events} events | ${r.uniqueUsers} unique users`);
      } else if (platform === 'amplitude') {
        const r = await syncAmplitude(uid, plats.amplitude);
        logOk(`amplitude — ${r.date} | ${r.activeUsers} active users | ${r.totalEvents} events`);
      } else if (platform === 'posthog') {
        const r = await syncPostHog(uid, plats.posthog);
        logOk(`posthog — ${r.date} | ${r.pageviews} pageviews | ${r.uniqueUsers} unique users`);
      } else if (platform === 'fathom') {
        const r = await syncFathom(uid, plats.fathom);
        logOk(`fathom — ${r.date} | ${r.pageviews} pageviews | ${r.uniques} unique visitors`);
      } else if (platform === 'google-ads') {
        const r = await syncGoogleAds(uid, plats['google-ads']);
        logOk(`google-ads — ${r.date} | $${r.spend?.toFixed(2)} spend | ${r.clicks} clicks | ${r.impressions} impressions`);
      } else if (platform === 'tiktok-ads') {
        const r = await syncTikTokAds(uid, plats['tiktok-ads']);
        logOk(`tiktok-ads — ${r.date} | $${r.spend?.toFixed(2)} spend | ${r.clicks} clicks`);
      } else if (platform === 'twitter-ads') {
        const r = await syncTwitterAds(uid, plats['twitter-ads']);
        logOk(`twitter-ads — ${r.date} | $${r.spend?.toFixed(2)} spend | ${r.impressions} impressions`);
      } else if (platform === 'linkedin-ads') {
        const r = await syncLinkedInAds(uid, plats['linkedin-ads']);
        logOk(`linkedin-ads — ${r.date} | $${r.spend?.toFixed(2)} spend | ${r.clicks} clicks`);
      } else if (platform === 'snapchat-ads') {
        const r = await syncSnapchatAds(uid, plats['snapchat-ads']);
        logOk(`snapchat-ads — ${r.date} | $${r.spend?.toFixed(2)} spend | ${r.swipes} swipes`);
      } else if (platform === 'pinterest-ads') {
        const r = await syncPinterestAds(uid, plats['pinterest-ads']);
        logOk(`pinterest-ads — ${r.date} | $${r.spend?.toFixed(2)} spend | ${r.clicks} clicks`);
      } else if (platform === 'mailchimp') {
        const r = await syncMailchimp(uid, plats.mailchimp);
        logOk(`mailchimp — ${r.date} | ${r.emailsSent} sent | ${r.opens} opens | ${r.clicks} clicks`);
      } else if (platform === 'klaviyo') {
        const r = await syncKlaviyo(uid, plats.klaviyo);
        logOk(`klaviyo — ${r.date} | ${r.emailsSent} sent | ${r.opens} opens | $${r.revenue?.toFixed(2)} revenue`);
      } else if (platform === 'convertkit') {
        const r = await syncConvertKit(uid, plats.convertkit);
        logOk(`convertkit — ${r.date} | ${r.totalSubscribers} subscribers | ${r.newSubscribers} new | ${r.broadcastsSent} broadcasts`);
      } else if (platform === 'activecampaign') {
        const r = await syncActiveCampaign(uid, plats.activecampaign);
        logOk(`activecampaign — ${r.date} | ${r.emailsSent} sent | ${r.opens} opens | ${r.newContacts} new contacts`);
      } else if (platform === 'brevo') {
        const r = await syncBrevo(uid, plats.brevo);
        logOk(`brevo — ${r.date} | ${r.emailsSent} sent | ${r.opens} opens | ${r.newContacts} new contacts`);
      } else if (platform === 'beehiiv') {
        const r = await syncBeehiiv(uid, plats.beehiiv);
        logOk(`beehiiv — ${r.date} | ${r.totalSubscribers} subscribers | ${r.newSubscribers} new | ${r.postsPublished} posts`);
      } else if (platform === 'shopify') {
        const r = await syncShopify(uid, plats.shopify);
        logOk(`shopify — ${r.date} | $${r.revenue?.toFixed(2)} revenue | ${r.orders} orders | ${r.newCustomers} new customers`);
      } else if (platform === 'woocommerce') {
        const r = await syncWooCommerce(uid, plats.woocommerce);
        logOk(`woocommerce — ${r.date} | $${r.revenue?.toFixed(2)} revenue | ${r.orders} orders | ${r.newCustomers} new customers`);
      } else if (platform === 'bigcommerce') {
        const r = await syncBigCommerce(uid, plats.bigcommerce);
        logOk(`bigcommerce — ${r.date} | $${r.revenue?.toFixed(2)} revenue | ${r.orders} orders | ${r.newCustomers} new customers`);
      } else if (platform === 'amazon-seller') {
        const r = await syncAmazonSeller(uid, plats['amazon-seller']);
        logOk(`amazon-seller — ${r.date} | $${r.revenue?.toFixed(2)} revenue | ${r.orders} orders | ${r.units} units`);
      } else if (platform === 'etsy') {
        const r = await syncEtsy(uid, plats.etsy);
        logOk(`etsy — ${r.date} | $${r.revenue?.toFixed(2)} revenue | ${r.orders} orders | ${r.views} views`);
      } else if (platform === 'hubspot') {
        const r = await syncHubSpot(uid, plats.hubspot);
        logOk(`hubspot — ${r.date} | ${r.dealsWon} deals won | $${r.closedRevenue?.toFixed(2)} closed | ${r.newContacts} new contacts`);
      } else if (platform === 'salesforce') {
        const r = await syncSalesforce(uid, plats.salesforce);
        logOk(`salesforce — ${r.date} | ${r.dealsWon} deals won | $${r.closedRevenue?.toFixed(2)} closed | ${r.newLeads} new leads`);
      } else if (platform === 'pipedrive') {
        const r = await syncPipedrive(uid, plats.pipedrive);
        logOk(`pipedrive — ${r.date} | ${r.dealsWon} deals won | $${r.closedRevenue?.toFixed(2)} closed | ${r.newContacts} new contacts`);
      } else if (platform === 'notion') {
        const r = await syncNotion(uid, plats.notion);
        logOk(`notion — ${r.date} | ${r.newRows} new rows | ${r.updatedRows} updated | ${r.totalRows} total`);
      } else if (platform === 'intercom') {
        const r = await syncIntercom(uid, plats.intercom);
        logOk(`intercom — ${r.date} | ${r.newConversations} new convos | ${r.resolvedConversations} resolved | ${r.newContacts} new contacts`);
      } else if (platform === 'zendesk') {
        const r = await syncZendesk(uid, plats.zendesk);
        logOk(`zendesk — ${r.date} | ${r.newTickets} new tickets | ${r.solvedTickets} solved | ${r.csatScore?.toFixed(1)}% CSAT`);
      } else if (platform === 'freshdesk') {
        const r = await syncFreshdesk(uid, plats.freshdesk);
        logOk(`freshdesk — ${r.date} | ${r.newTickets} new | ${r.resolvedTickets} resolved | ${r.openTickets} open`);
      } else if (platform === 'segment') {
        await syncSegment(uid, plats.segment);
        logOk(`segment — ${yesterday()} synced`);
      } else if (platform === 'heap') {
        await syncHeap(uid, plats.heap);
        logOk(`heap — ${yesterday()} synced`);
      } else if (platform === 'fullstory') {
        await syncFullStory(uid, plats.fullstory);
        logOk(`fullstory — ${yesterday()} synced`);
      } else if (platform === 'hotjar') {
        await syncHotjar(uid, plats.hotjar);
        logOk(`hotjar — ${yesterday()} synced`);
      } else if (platform === 'instagram') {
        const r = await syncInstagram(uid, plats.instagram);
        logOk(`instagram — ${r.date} | ${r.followers} followers | ${r.reach} reach | ${r.impressions} impressions`);
      } else if (platform === 'youtube') {
        await syncYouTube(uid, plats.youtube);
        logOk(`youtube — ${yesterday()} synced`);
      } else if (platform === 'twitter-organic') {
        await syncTwitterOrganic(uid, plats['twitter-organic']);
        logOk(`twitter-organic — ${yesterday()} synced`);
      }
    }));

    for (const result of results) {
      if (result.status === 'fulfilled') ok++;
      else { logFail(`${uid.slice(0, 8)} — ${result.reason?.message ?? result.reason}`); fail++; }
    }
  }

  // ── process users in parallel batches of USER_CONCURRENCY ────────────────
  for (let i = 0; i < userIds.length; i += USER_CONCURRENCY) {
    const batch = userIds.slice(i, i + USER_CONCURRENCY);
    await Promise.allSettled(
      batch.map((uid, batchIdx) => syncUserPlatforms(uid, byUser[uid], i + batchIdx + 1))
    );
    if (i + USER_CONCURRENCY < userIds.length) await sleep(USER_DELAY_MS);
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
    rows = await SB.select('integrations', 'user_id,platform,access_token,refresh_token,account_id,currency');
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
      const existing = await SB.selectWhere(
        'daily_snapshots',
        'id',
        { user_id: `eq.${row.user_id}`, provider: `eq.${row.platform}`, limit: '1' }
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
      await sleep(2_000);
    }
    if (plats.paypal) {
      try {
        await backfillPayPal(uid, plats.paypal);
        backfilledKeys.add(`${uid}:paypal`);
      } catch (err) { logFail(`[auto-backfill] paypal: ${err.message}`); }
      await sleep(2_000);
    }
    if (plats.paddle) {
      try {
        await backfillPaddle(uid, plats.paddle);
        backfilledKeys.add(`${uid}:paddle`);
      } catch (err) { logFail(`[auto-backfill] paddle: ${err.message}`); }
    }
    if (plats['lemon-squeezy']) {
      try {
        await backfillLemonSqueezy(uid, plats['lemon-squeezy']);
        backfilledKeys.add(`${uid}:lemon-squeezy`);
      } catch (err) { logFail(`[auto-backfill] lemonsqueezy: ${err.message}`); }
    }
    if (plats.gumroad) {
      try {
        await backfillGumroad(uid, plats.gumroad);
        backfilledKeys.add(`${uid}:gumroad`);
      } catch (err) { logFail(`[auto-backfill] gumroad: ${err.message}`); }
    }
    if (plats.plausible) {
      try {
        await backfillPlausible(uid, plats.plausible);
        backfilledKeys.add(`${uid}:plausible`);
      } catch (err) { logFail(`[auto-backfill] plausible: ${err.message}`); }
    }
    if (plats.mixpanel) {
      try {
        await backfillMixpanel(uid, plats.mixpanel);
        backfilledKeys.add(`${uid}:mixpanel`);
      } catch (err) { logFail(`[auto-backfill] mixpanel: ${err.message}`); }
    }
    if (plats.amplitude) {
      try {
        await backfillAmplitude(uid, plats.amplitude);
        backfilledKeys.add(`${uid}:amplitude`);
      } catch (err) { logFail(`[auto-backfill] amplitude: ${err.message}`); }
    }
    if (plats.posthog) {
      try {
        await backfillPostHog(uid, plats.posthog);
        backfilledKeys.add(`${uid}:posthog`);
      } catch (err) { logFail(`[auto-backfill] posthog: ${err.message}`); }
    }
    if (plats.fathom) {
      try {
        await backfillFathom(uid, plats.fathom);
        backfilledKeys.add(`${uid}:fathom`);
      } catch (err) { logFail(`[auto-backfill] fathom: ${err.message}`); }
    }
    if (plats['google-ads']) {
      try {
        await backfillGoogleAds(uid, plats['google-ads']);
        backfilledKeys.add(`${uid}:google-ads`);
      } catch (err) { logFail(`[auto-backfill] google-ads: ${err.message}`); }
    }
    if (plats['tiktok-ads']) {
      try {
        await backfillTikTokAds(uid, plats['tiktok-ads']);
        backfilledKeys.add(`${uid}:tiktok-ads`);
      } catch (err) { logFail(`[auto-backfill] tiktok-ads: ${err.message}`); }
    }
    if (plats['twitter-ads']) {
      try {
        await backfillTwitterAds(uid, plats['twitter-ads']);
        backfilledKeys.add(`${uid}:twitter-ads`);
      } catch (err) { logFail(`[auto-backfill] twitter-ads: ${err.message}`); }
    }
    if (plats['linkedin-ads']) {
      try {
        await backfillLinkedInAds(uid, plats['linkedin-ads']);
        backfilledKeys.add(`${uid}:linkedin-ads`);
      } catch (err) { logFail(`[auto-backfill] linkedin-ads: ${err.message}`); }
    }
    if (plats['snapchat-ads']) {
      try {
        await backfillSnapchatAds(uid, plats['snapchat-ads']);
        backfilledKeys.add(`${uid}:snapchat-ads`);
      } catch (err) { logFail(`[auto-backfill] snapchat-ads: ${err.message}`); }
    }
    if (plats['pinterest-ads']) {
      try {
        await backfillPinterestAds(uid, plats['pinterest-ads']);
        backfilledKeys.add(`${uid}:pinterest-ads`);
      } catch (err) { logFail(`[auto-backfill] pinterest-ads: ${err.message}`); }
    }
    if (plats.mailchimp) {
      try {
        await backfillMailchimp(uid, plats.mailchimp);
        backfilledKeys.add(`${uid}:mailchimp`);
      } catch (err) { logFail(`[auto-backfill] mailchimp: ${err.message}`); }
    }
    if (plats.klaviyo) {
      try {
        await backfillKlaviyo(uid, plats.klaviyo);
        backfilledKeys.add(`${uid}:klaviyo`);
      } catch (err) { logFail(`[auto-backfill] klaviyo: ${err.message}`); }
    }
    if (plats.convertkit) {
      try {
        await backfillConvertKit(uid, plats.convertkit);
        backfilledKeys.add(`${uid}:convertkit`);
      } catch (err) { logFail(`[auto-backfill] convertkit: ${err.message}`); }
    }
    if (plats.activecampaign) {
      try {
        await backfillActiveCampaign(uid, plats.activecampaign);
        backfilledKeys.add(`${uid}:activecampaign`);
      } catch (err) { logFail(`[auto-backfill] activecampaign: ${err.message}`); }
    }
    if (plats.brevo) {
      try {
        await backfillBrevo(uid, plats.brevo);
        backfilledKeys.add(`${uid}:brevo`);
      } catch (err) { logFail(`[auto-backfill] brevo: ${err.message}`); }
    }
    if (plats.beehiiv) {
      try {
        await backfillBeehiiv(uid, plats.beehiiv);
        backfilledKeys.add(`${uid}:beehiiv`);
      } catch (err) { logFail(`[auto-backfill] beehiiv: ${err.message}`); }
    }
    if (plats.shopify) {
      try {
        await backfillShopify(uid, plats.shopify);
        backfilledKeys.add(`${uid}:shopify`);
      } catch (err) { logFail(`[auto-backfill] shopify: ${err.message}`); }
    }
    if (plats.woocommerce) {
      try {
        await backfillWooCommerce(uid, plats.woocommerce);
        backfilledKeys.add(`${uid}:woocommerce`);
      } catch (err) { logFail(`[auto-backfill] woocommerce: ${err.message}`); }
    }
    if (plats.bigcommerce) {
      try {
        await backfillBigCommerce(uid, plats.bigcommerce);
        backfilledKeys.add(`${uid}:bigcommerce`);
      } catch (err) { logFail(`[auto-backfill] bigcommerce: ${err.message}`); }
    }
    if (plats['amazon-seller']) {
      try {
        await backfillAmazonSeller(uid, plats['amazon-seller']);
        backfilledKeys.add(`${uid}:amazon-seller`);
      } catch (err) { logFail(`[auto-backfill] amazon-seller: ${err.message}`); }
    }
    if (plats.etsy) {
      try {
        await backfillEtsy(uid, plats.etsy);
        backfilledKeys.add(`${uid}:etsy`);
      } catch (err) { logFail(`[auto-backfill] etsy: ${err.message}`); }
    }
    if (plats.hubspot) {
      try {
        await backfillHubSpot(uid, plats.hubspot);
        backfilledKeys.add(`${uid}:hubspot`);
      } catch (err) { logFail(`[auto-backfill] hubspot: ${err.message}`); }
    }
    if (plats.salesforce) {
      try {
        await backfillSalesforce(uid, plats.salesforce);
        backfilledKeys.add(`${uid}:salesforce`);
      } catch (err) { logFail(`[auto-backfill] salesforce: ${err.message}`); }
    }
    if (plats.pipedrive) {
      try {
        await backfillPipedrive(uid, plats.pipedrive);
        backfilledKeys.add(`${uid}:pipedrive`);
      } catch (err) { logFail(`[auto-backfill] pipedrive: ${err.message}`); }
    }
    if (plats.notion) {
      try {
        await backfillNotion(uid, plats.notion);
        backfilledKeys.add(`${uid}:notion`);
      } catch (err) { logFail(`[auto-backfill] notion: ${err.message}`); }
    }
    if (plats.intercom) {
      try {
        await backfillIntercom(uid, plats.intercom);
        backfilledKeys.add(`${uid}:intercom`);
      } catch (err) { logFail(`[auto-backfill] intercom: ${err.message}`); }
    }
    if (plats.zendesk) {
      try {
        await backfillZendesk(uid, plats.zendesk);
        backfilledKeys.add(`${uid}:zendesk`);
      } catch (err) { logFail(`[auto-backfill] zendesk: ${err.message}`); }
    }
    if (plats.freshdesk) {
      try {
        await backfillFreshdesk(uid, plats.freshdesk);
        backfilledKeys.add(`${uid}:freshdesk`);
      } catch (err) { logFail(`[auto-backfill] freshdesk: ${err.message}`); }
    }
    if (plats.segment) {
      try {
        await backfillSegment(uid, plats.segment);
        backfilledKeys.add(`${uid}:segment`);
      } catch (err) { logFail(`[auto-backfill] segment: ${err.message}`); }
    }
    if (plats.heap) {
      try {
        await backfillHeap(uid, plats.heap);
        backfilledKeys.add(`${uid}:heap`);
      } catch (err) { logFail(`[auto-backfill] heap: ${err.message}`); }
    }
    if (plats.fullstory) {
      try {
        await backfillFullStory(uid, plats.fullstory);
        backfilledKeys.add(`${uid}:fullstory`);
      } catch (err) { logFail(`[auto-backfill] fullstory: ${err.message}`); }
    }
    if (plats.hotjar) {
      try {
        await backfillHotjar(uid, plats.hotjar);
        backfilledKeys.add(`${uid}:hotjar`);
      } catch (err) { logFail(`[auto-backfill] hotjar: ${err.message}`); }
    }
    if (plats.instagram) {
      try {
        await backfillInstagram(uid, plats.instagram);
        backfilledKeys.add(`${uid}:instagram`);
      } catch (err) { logFail(`[auto-backfill] instagram: ${err.message}`); }
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

    // ── Persist to notifications table so the in-app bell shows them ──────────
    try {
      const colorMap = { '🚨': '#f87171', '⚠': '#f59e0b', '💸': '#fb923c' };
      const records = triggered.map(t => ({
        user_id:    user.id,
        message:    `${t.icon} ${t.title}`,
        detail:     t.detail ?? null,
        color:      colorMap[t.icon] ?? '#f59e0b',
        icon:       t.icon,
        read:       false,
      }));
      await SB.insert('notifications', records);
    } catch (err) {
      logWarn(`[alerts] Could not persist notifications to DB: ${err.message}`);
    }

    notified++;
  }

  log(`[alerts] Done — ${notified} user(s) notified`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY DIGEST SENDER
// Runs once per day.  For each premium user where digest_subscribed=true and
// today is their digest_day (0=Sun…6=Sat), this function:
//   1. Fetches the last 14 days of daily_snapshots
//   2. Builds a metrics context string
//   3. Calls the Anthropic API (claude-opus-4-5) to generate a structured digest
//   4. Upserts the result into the `digests` table
//   5. Sends the HTML email via Resend
//
// DB columns used (see migration 009_goals_and_alert_rules.sql):
//   users.digest_subscribed  boolean  — opt-in flag
//   users.digest_day         smallint — 0=Sun … 6=Sat
//
// Required .env vars:
//   ANTHROPIC_API_KEY
//   RESEND_API_KEY
// ─────────────────────────────────────────────────────────────────────────────

function buildDigestEmailHtml(digest, appUrl) {
  const highlights = digest.highlights ?? [];
  const anomalies  = digest.anomalies  ?? [];
  const action     = digest.action     ?? null;

  const trendEmoji = (t) => t === 'up' ? '📈' : t === 'down' ? '📉' : '➡️';
  const sevEmoji   = (s) => s === 'high' ? '🔴' : s === 'medium' ? '🟡' : '🟢';
  const sevColor   = (s) => s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : '#22c55e';

  const highlightsHtml = highlights.map(h => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2030;">${trendEmoji(h.trend)} <strong>${h.metric}</strong></td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2030;color:#00d4aa;">${h.value}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2030;color:#888;">${h.change}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2030;color:#ccc;">${h.context}</td>
    </tr>`).join('');

  const anomaliesHtml = anomalies.map(a => `
    <div style="margin-bottom:16px;padding:12px 16px;background:#13141f;border-left:3px solid ${sevColor(a.severity)};border-radius:4px;">
      <strong>${sevEmoji(a.severity)} ${a.title}</strong>
      <p style="margin:6px 0 0;color:#aaa;">${a.description}</p>
      <p style="margin:4px 0 0;color:#666;font-size:13px;">Source: ${a.dataSource}</p>
    </div>`).join('');

  const actionHtml = action ? `
    <div style="background:#0d2e2a;border:1px solid #00d4aa33;border-radius:8px;padding:16px 20px;">
      <strong style="color:#00d4aa;">⚡ ${action.title}</strong>
      <p style="margin:8px 0 0;color:#ccc;">${action.description}</p>
      <p style="margin:6px 0 0;color:#666;font-size:13px;">Priority: ${action.priority} · Effort: ${action.effort}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e5e5;">
  <div style="max-width:680px;margin:0 auto;padding:40px 24px;">
    <div style="margin-bottom:32px;">
      <h1 style="margin:0;font-size:22px;color:#fff;"><span style="color:#00d4aa;">Fold</span> Daily Digest</h1>
      <p style="margin:6px 0 0;color:#666;font-size:14px;">${digest.date}</p>
    </div>
    <div style="background:#13141f;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
      <h2 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#666;">Summary</h2>
      <p style="margin:0;line-height:1.6;color:#ddd;">${digest.summary}</p>
    </div>
    ${highlights.length > 0 ? `
    <div style="margin-bottom:28px;">
      <h2 style="margin:0 0 14px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#666;">Highlights</h2>
      <table style="width:100%;border-collapse:collapse;background:#13141f;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#1a1b2e;">
          <th style="padding:8px 12px;text-align:left;color:#666;font-size:12px;">Metric</th>
          <th style="padding:8px 12px;text-align:left;color:#666;font-size:12px;">Value</th>
          <th style="padding:8px 12px;text-align:left;color:#666;font-size:12px;">vs last week</th>
          <th style="padding:8px 12px;text-align:left;color:#666;font-size:12px;">Context</th>
        </tr></thead>
        <tbody>${highlightsHtml}</tbody>
      </table>
    </div>` : ''}
    ${anomalies.length > 0 ? `
    <div style="margin-bottom:28px;">
      <h2 style="margin:0 0 14px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#666;">Anomalies</h2>
      ${anomaliesHtml}
    </div>` : ''}
    ${digest.cross_insight ? `
    <div style="background:#13141f;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
      <h2 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#666;">Cross-Platform Insight</h2>
      <p style="margin:0;line-height:1.6;color:#ddd;">${digest.cross_insight}</p>
    </div>` : ''}
    ${actionHtml}
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #1e2030;text-align:center;color:#444;font-size:12px;">
      <p style="margin:0;">You're receiving this because you opted into Fold digest emails.</p>
      <p style="margin:6px 0 0;"><a href="${appUrl}/dashboard" style="color:#00d4aa;text-decoration:none;">Open Dashboard</a></p>
    </div>
  </div>
</body></html>`;
}

async function sendDailyDigests() {
  if (!ANTHROPIC_KEY) {
    logWarn('[digest] ANTHROPIC_API_KEY not set — skipping digest send');
    return;
  }
  if (!RESEND_KEY) {
    logWarn('[digest] RESEND_API_KEY not set — skipping digest send');
    return;
  }

  const today    = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD
  const todayDow = new Date().getUTCDay();                   // 0=Sun…6=Sat
  const appUrl   = g('NEXT_PUBLIC_APP_URL') || 'https://usefold.io';

  log(`[digest] Running digest send — today=${today} dow=${todayDow}`);

  // ── 1. Fetch all eligible users: premium OR active trial, opted in,
  //       and today matches their chosen digest_day (NULL → treated as Monday=1)
  // ─────────────────────────────────────────────────────────────────────────────
  let allUsers;
  try {
    // Premium users
    const premiumUsers = await SB.selectWhere(
      'users', 'id,email,digest_subscribed,digest_day,is_premium,trial_ends_at',
      { is_premium: 'eq.true', digest_subscribed: 'eq.true' },
    );
    // Trial users (trial_ends_at >= today, not already premium)
    const trialUsers = await SB.selectWhere(
      'users', 'id,email,digest_subscribed,digest_day,is_premium,trial_ends_at',
      { trial_ends_at: `gte.${today}`, digest_subscribed: 'eq.true' },
    ).catch(() => []);

    // Merge, dedup by id
    const seen = new Set((premiumUsers ?? []).map(u => u.id));
    const merged = [...(premiumUsers ?? [])];
    for (const u of (trialUsers ?? [])) {
      if (!seen.has(u.id)) { merged.push(u); seen.add(u.id); }
    }

    // Filter to users whose digest_day matches today
    // If digest_day is null/undefined, default to Monday (1)
    allUsers = merged.filter(u => (u.digest_day ?? 1) === todayDow);
  } catch (err) {
    logFail(`[digest] Cannot fetch users: ${err.message}`);
    return;
  }

  if (!allUsers.length) {
    log(`[digest] No users scheduled for digest today (dow=${todayDow}).`);
    return;
  }

  log(`[digest] ${allUsers.length} user(s) due for digest today (dow=${todayDow}).`);
  let sent = 0;

  for (const user of allUsers) {
    const uid   = user.id;
    const email = user.email;
    log(`[digest] Processing user ${uid.slice(0, 8)}…`);

    // ── 2. Idempotency check: skip if digest already sent/saved today ─────────
    try {
      const existing = await SB.selectWhere('digests', 'id', {
        user_id: `eq.${uid}`,
        date:    `eq.${today}`,
      });
      if (existing?.length) {
        logOk(`[digest] Already sent for ${uid.slice(0, 8)} on ${today} — skipping`);
        sent++; // count as done (not a failure)
        continue;
      }
    } catch (_) { /* non-fatal — proceed anyway */ }

    // ── 3. Fetch last 14 days of snapshots (ALL platforms) ───────────────────
    let snaps;
    try {
      const cutoff14 = daysAgo(14);
      const p = new URLSearchParams({
        select:  'provider,date,data',
        user_id: `eq.${uid}`,
        date:    `gte.${cutoff14}`,
        order:   'date.desc',
      });
      const getHeaders = { apikey: SB.headers.apikey, Authorization: SB.headers.Authorization };
      const r = await fetchRetry(
        `SB SELECT daily_snapshots[digest:${uid.slice(0, 8)}]`,
        `${SUPABASE_URL}/rest/v1/daily_snapshots?${p}`,
        { headers: getHeaders },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      snaps = await r.json();
    } catch (err) {
      logWarn(`[digest] Cannot fetch snapshots for ${uid.slice(0, 8)}: ${err.message}`);
      continue;
    }

    if (!snaps?.length) {
      logWarn(`[digest] No snapshots found for ${uid.slice(0, 8)} — skipping`);
      continue;
    }

    // ── 4. Compute 7d vs prev-7d metrics across ALL connected platforms ───────
    const cutoff7Str = daysAgo(7);
    const snaps7     = snaps.filter(s => s.date >= cutoff7Str);
    const snapsPrev7 = snaps.filter(s => s.date <  cutoff7Str);

    const sumField = (arr, provider, field) =>
      arr.filter(s => s.provider === provider)
         .reduce((acc, s) => acc + ((s.data?.[field]) ?? 0), 0);
    const avgField = (arr, provider, field) => {
      const rows = arr.filter(s => s.provider === provider);
      return rows.length ? rows.reduce((acc, s) => acc + ((s.data?.[field]) ?? 0), 0) / rows.length : 0;
    };
    const maxField = (arr, provider, field) => {
      const vals = arr.filter(s => s.provider === provider).map(s => s.data?.[field] ?? 0).filter(v => v > 0);
      return vals.length ? Math.max(...vals) : 0;
    };

    // Revenue platforms
    const REVENUE_PLATFORMS = ['stripe', 'shopify', 'woocommerce', 'gumroad', 'lemon-squeezy', 'paddle', 'paypal', 'amazon-seller', 'etsy', 'bigcommerce'];
    const ALL_ADS_PLATFORMS = ['meta', 'google-ads', 'tiktok-ads', 'twitter-ads', 'linkedin-ads', 'snapchat-ads', 'pinterest-ads'];
    const ALL_ANALYTICS_P   = ['ga4', 'plausible', 'posthog', 'fathom', 'mixpanel', 'amplitude'];
    const connectedProviders = [...new Set(snaps.map(s => s.provider))];

    const revenue7    = REVENUE_PLATFORMS.reduce((a, p) => a + sumField(snaps7, p, 'revenue'), 0);
    const revenuePrev = REVENUE_PLATFORMS.reduce((a, p) => a + sumField(snapsPrev7, p, 'revenue'), 0);

    // Traffic: use whichever analytics platform has the most data
    const anCounts7 = {};
    for (const s of snaps7) {
      if (!ALL_ANALYTICS_P.includes(s.provider)) continue;
      if (Object.values(s.data ?? {}).some(v => v > 0)) anCounts7[s.provider] = (anCounts7[s.provider] ?? 0) + 1;
    }
    const primaryAn = Object.keys(anCounts7).sort((a, b) => (anCounts7[b] ?? 0) - (anCounts7[a] ?? 0))[0] ?? null;
    const sessions7Field = primaryAn === 'plausible' || primaryAn === 'fathom' ? 'visitors' : 'sessions';
    const sessions7    = primaryAn ? sumField(snaps7,    primaryAn, sessions7Field) : 0;
    const sessionsPrev = primaryAn ? sumField(snapsPrev7, primaryAn, sessions7Field) : 0;
    const bounceRate7  = primaryAn ? avgField(snaps7,    primaryAn, 'bounceRate') : 0;
    const conversions7 = primaryAn ? sumField(snaps7,    primaryAn, 'conversions') : 0;

    // All ad platforms combined
    const spend7    = ALL_ADS_PLATFORMS.reduce((a, p) => a + sumField(snaps7,    p, 'spend'), 0);
    const spendPrev = ALL_ADS_PLATFORMS.reduce((a, p) => a + sumField(snapsPrev7, p, 'spend'), 0);

    // New customers (all revenue platforms)
    const newCustomers7 = REVENUE_PLATFORMS.reduce((a, p) => a + sumField(snaps7, p, 'newCustomers'), 0);

    // Subscription metrics — look across ALL snapshots not just 7d to handle annual plans
    const latestSnap   = snaps.find(s => s.provider === 'stripe');
    const currentMRR   = latestSnap?.data?.mrr   ?? maxField(snaps7, 'stripe', 'mrr') ?? 0;
    const activeSubs   = latestSnap?.data?.activeSubscriptions ?? maxField(snaps7, 'stripe', 'activeSubscriptions') ?? 0;
    const trialingSubs = latestSnap?.data?.trialingSubscriptions ?? 0;
    const churnedTotal = sumField(snaps7, 'stripe', 'churnedToday');

    // Per-platform revenue breakdown
    const revByPlatform = REVENUE_PLATFORMS
      .filter(p => connectedProviders.includes(p))
      .map(p => {
        const r7 = sumField(snaps7, p, 'revenue');
        const rPrev = sumField(snapsPrev7, p, 'revenue');
        const pct = rPrev > 0 ? ((r7 - rPrev) / rPrev * 100).toFixed(1) : null;
        return r7 > 0 ? `  ${p}: $${(r7/100).toFixed(2)}${pct !== null ? ` (${pct}%)` : ''}` : null;
      }).filter(Boolean);

    // Email / newsletter platforms
    const emailPlatforms = ['mailchimp', 'klaviyo', 'beehiiv', 'convertkit', 'brevo', 'activecampaign'];
    const emailLines = emailPlatforms
      .filter(p => connectedProviders.includes(p))
      .map(p => {
        const subs    = maxField(snaps7, p, 'subscribers');
        const subsPrev = maxField(snapsPrev7, p, 'subscribers');
        const openRate = avgField(snaps7, p, 'openRate');
        const subChange = subsPrev > 0 ? ((subs - subsPrev) / subsPrev * 100).toFixed(1) : '—';
        return `${p} Subscribers: ${subs} (${subChange}% vs prev week)${openRate > 0 ? `, Open Rate: ${(openRate*100).toFixed(1)}%` : ''}`;
      });

    // Additional ad platforms breakdown
    const adLines = ALL_ADS_PLATFORMS
      .filter(p => connectedProviders.includes(p))
      .map(p => {
        const adSpend = sumField(snaps7, p, 'spend');
        const clicks  = sumField(snaps7, p, 'clicks');
        const conv    = sumField(snaps7, p, 'conversions');
        return adSpend > 0 ? `  ${p}: $${adSpend.toFixed(2)}${clicks > 0 ? ` — ${clicks} clicks` : ''}${conv > 0 ? ` — ${conv} conversions` : ''}` : null;
      }).filter(Boolean);

    // % changes
    const revChange   = revenuePrev  > 0 ? ((revenue7  - revenuePrev)  / revenuePrev  * 100) : null;
    const sessChange  = sessionsPrev > 0 ? ((sessions7 - sessionsPrev) / sessionsPrev * 100) : null;
    const spendChange = spendPrev    > 0 ? ((spend7    - spendPrev)    / spendPrev    * 100) : null;
    const cacLine     = newCustomers7 > 0 && spend7 > 0
      ? `CAC (total ad spend / new customers): $${(spend7 / newCustomers7).toFixed(2)}`
      : null;

    // ── 5. Fetch website profile for context ─────────────────────────────────
    let website = null;
    try {
      const wp = await SB.selectWhere('website_profiles', 'url,score', { user_id: `eq.${uid}` });
      website = wp?.[0] ?? null;
    } catch (_) { /* optional */ }

    // ── 6. Build context block for AI ────────────────────────────────────────
    const contextLines = [
      `DATE: ${today}`,
      `Connected platforms: ${connectedProviders.join(', ')}`,
      `Primary analytics platform: ${primaryAn ?? 'none'}`,
      '',
      `=== REVENUE ===`,
      `Total Revenue (7d): $${(revenue7 / 100).toFixed(2)}${revChange !== null ? ` (${revChange >= 0 ? '+' : ''}${revChange.toFixed(1)}% vs prev week)` : ' (no prior week data)'}`,
      revByPlatform.length ? `Breakdown:\n${revByPlatform.join('\n')}` : null,
      currentMRR > 0 ? `MRR: $${(currentMRR / 100).toFixed(2)}` : 'MRR: $0 (no active subscriptions or not tracked)',
      activeSubs > 0 ? `Active Subscriptions: ${activeSubs}${trialingSubs > 0 ? ` + ${trialingSubs} trialing` : ''}` : null,
      churnedTotal > 0 ? `Churned Subscribers (7d): ${churnedTotal}` : null,
      newCustomers7 > 0 ? `New Customers (7d): ${newCustomers7}` : null,
      '',
      `=== TRAFFIC (via ${primaryAn ?? 'no analytics connected'}) ===`,
      sessions7 > 0
        ? `Sessions (7d): ${sessions7}${sessChange !== null ? ` (${sessChange >= 0 ? '+' : ''}${sessChange.toFixed(1)}% vs prev week)` : ''}`
        : primaryAn
          ? `Sessions (7d): 0 — ${primaryAn} is connected but recorded no traffic this week`
          : 'Sessions: N/A — no analytics platform connected',
      bounceRate7 > 0 ? `Bounce Rate (7d avg): ${bounceRate7.toFixed(1)}%` : null,
      conversions7 > 0 ? `Conversions (7d): ${conversions7}` : null,
      '',
      `=== ADVERTISING ===`,
      spend7 > 0
        ? `Total Ad Spend (7d): $${spend7.toFixed(2)}${spendChange !== null ? ` (${spendChange >= 0 ? '+' : ''}${spendChange.toFixed(1)}% vs prev week)` : ''}`
        : 'Ad Spend: $0 — no paid campaigns running',
      ...adLines,
      cacLine,
      '',
      emailLines.length ? `=== EMAIL & NEWSLETTER ===` : null,
      ...emailLines,
      '',
      website ? `=== WEBSITE ===` : null,
      website ? `URL: ${website.url} — Health Score: ${website.score}/100` : null,
    ].filter(l => l !== null).join('\n');

    // ── 7. Call Anthropic to generate digest JSON ─────────────────────────────
    let digestContent;
    try {
      const aiRes = await fetchRetry(
        `Anthropic digest[${uid.slice(0, 8)}]`,
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'x-api-key':         ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          body: JSON.stringify({
            model:      'claude-opus-4-5',
            max_tokens: 900,
            system: `You are a precise business intelligence assistant generating a weekly digest for a founder. Use ONLY the data provided — never invent metrics or assume missing data is a problem.

CRITICAL RULES:
- If a metric shows 0 or N/A because the platform is not connected, do NOT flag this as an anomaly — state it as "not tracked" or skip it.
- If traffic shows 0 but the analytics platform is listed as connected, then flag it as a potential tracking issue.
- If revenue came in with 0 sessions, acknowledge the disconnect but do not assume it is broken — it may be direct/API traffic.
- Highlight actual changes vs prior week only when prior week data exists. If no prior week data, say "first week tracked" not "+0%".
- Be concise, factual, and founder-friendly. Reference actual numbers.
- MRR and active subscriptions reflect the current live state, not just this week's charges.

Return ONLY valid JSON, no markdown fences.

Schema:
{
  "summary": "2-3 sentence plain English overview referencing real numbers",
  "highlights": [
    { "metric": "Revenue", "value": "$X.XX", "trend": "up|down|flat", "change": "+X%", "context": "brief note" }
  ],
  "anomalies": [
    { "title": "short title", "description": "what happened and why it matters", "severity": "high|medium|low", "dataSource": "Stripe|GA4|Meta|etc" }
  ],
  "cross_insight": "One sentence connecting two data sources if a meaningful pattern exists, otherwise omit",
  "action": { "title": "Top action", "description": "specific actionable step", "priority": "High|Medium|Low", "effort": "Low|Medium|High" }
}`,
            messages: [
              { role: 'user', content: `Generate a daily business digest for this business:\n\n${contextLines}` },
            ],
          }),
        },
      );

      if (!aiRes.ok) {
        const errBody = await aiRes.text().catch(() => '');
        throw new Error(`Anthropic ${aiRes.status}: ${errBody.slice(0, 200)}`);
      }

      const aiJson = await aiRes.json();
      let raw = (aiJson.content?.[0]?.text ?? '').trim();
      // Strip markdown fences if present
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object in Anthropic response');
      digestContent = JSON.parse(jsonMatch[0]);
    } catch (err) {
      logFail(`[digest] Anthropic error for ${uid.slice(0, 8)}: ${err.message}`);
      continue;
    }

    // ── 8. Upsert digest into `digests` table ────────────────────────────────
    try {
      await SB.upsert(
        'digests',
        {
          user_id:       uid,
          date:          today,
          summary:       digestContent.summary        ?? '',
          highlights:    digestContent.highlights     ?? [],
          anomalies:     digestContent.anomalies      ?? [],
          cross_insight: digestContent.cross_insight  ?? '',
          action:        digestContent.action         ?? {},
          raw_context:   { contextLines },
        },
        'user_id,date',
      );
    } catch (err) {
      logWarn(`[digest] DB upsert failed for ${uid.slice(0, 8)}: ${err.message}`);
      // Still attempt email — don't hard-fail
    }

    // ── 9. Send email via Resend REST API ────────────────────────────────────
    try {
      const emailHtml = buildDigestEmailHtml({ ...digestContent, date: today }, appUrl);
      const res = await fetchRetry(
        `Resend digest[${uid.slice(0, 8)}]`,
        'https://api.resend.com/emails',
        {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:    FROM_DIGEST,
            to:      email,
            subject: `Your Fold Daily Digest — ${today}`,
            html:    emailHtml,
          }),
        },
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        logWarn(`[digest] Resend failed for ${uid.slice(0, 8)}: ${e?.message ?? res.status}`);
      } else {
        logOk(`[digest] Sent to ${email} (${user.is_premium ? 'premium' : 'trial'})`);
        sent++;
      }
    } catch (err) {
      logWarn(`[digest] Email error for ${uid.slice(0, 8)}: ${err.message}`);
    }

    await sleep(USER_DELAY_MS);
  }

  log(`[digest] Done — ${sent}/${allUsers.length} digest(s) sent`);
}
// Runs daily after sync. Compares today's snapshot for each monitored metric
// against the 7-day rolling average. Flags deviations ≥ 25% as warnings and
// ≥ 50% as critical. Writes every alert to the `notifications` table (shows up
// in the in-app bell) and sends an email for critical anomalies or ≥2 warnings.
//
// Monitored platforms / metrics:
//   stripe  → revenue, newCustomers, churnedToday
//   ga4     → sessions, conversions, bounceRate
//   meta    → spend, clicks, impressions
//   shopify → revenue, orders
//   mailchimp, klaviyo, beehiiv → subscribers, openRate
// ─────────────────────────────────────────────────────────────────────────────

const ANOMALY_MONITORED = {
  stripe:    [
    { key: 'revenue',      label: 'Daily Revenue',        unit: 'currency', lowerIsBad: true  },
    { key: 'newCustomers', label: 'New Customers',         unit: null,       lowerIsBad: true  },
    { key: 'churnedToday', label: 'Churned Subscribers',   unit: null,       lowerIsBad: false },
  ],
  ga4:       [
    { key: 'sessions',    label: 'Sessions',               unit: null,       lowerIsBad: true  },
    { key: 'conversions', label: 'Conversions',             unit: null,       lowerIsBad: true  },
    { key: 'bounceRate',  label: 'Bounce Rate',             unit: 'pct',      lowerIsBad: false },
  ],
  meta:      [
    { key: 'spend',       label: 'Ad Spend',               unit: 'currency', lowerIsBad: false },
    { key: 'clicks',      label: 'Ad Clicks',               unit: null,       lowerIsBad: true  },
    { key: 'impressions', label: 'Impressions',             unit: null,       lowerIsBad: true  },
  ],
  shopify:   [
    { key: 'revenue',     label: 'Shopify Revenue',         unit: 'currency', lowerIsBad: true  },
    { key: 'orders',      label: 'Orders',                  unit: null,       lowerIsBad: true  },
  ],
  mailchimp: [
    { key: 'subscribers', label: 'Subscribers',             unit: null,       lowerIsBad: true  },
    { key: 'openRate',    label: 'Email Open Rate',          unit: 'pct',      lowerIsBad: true  },
  ],
  klaviyo:   [
    { key: 'subscribers', label: 'Subscribers',             unit: null,       lowerIsBad: true  },
  ],
  beehiiv:   [
    { key: 'subscribers', label: 'Subscribers',             unit: null,       lowerIsBad: true  },
    { key: 'openRate',    label: 'Newsletter Open Rate',     unit: 'pct',      lowerIsBad: true  },
  ],
};

const ANOMALY_WARN_THRESHOLD = 0.25;  // 25% deviation → warning
const ANOMALY_CRIT_THRESHOLD = 0.50;  // 50% deviation → critical
const ANOMALY_MIN_HISTORY    = 3;     // minimum historical days required

function buildAnomalyAlertEmailHtml(alerts) {
  const rows = alerts.map(a => {
    const arrow      = a.direction === 'down' ? '▼' : '▲';
    const arrowColor = a.direction === 'down' ? '#f87171' : (a.lowerIsBad ? '#f87171' : '#f59e0b');
    const badgeColor = a.severity === 'critical' ? '#f87171' : '#f59e0b';
    const badgeLabel = a.severity === 'critical' ? 'CRITICAL' : 'WARNING';

    const fmtVal = (v) => {
      if (a.unit === 'currency') return `$${(v / 100).toFixed(2)}`;
      if (a.unit === 'pct')     return `${v.toFixed(1)}%`;
      return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    };

    return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #2a2a3e;">
        <div style="font-family:monospace;font-size:12px;font-weight:700;color:#f8f8fc;">${a.label}</div>
        <div style="font-family:monospace;font-size:10px;color:#8585aa;margin-top:2px;">${a.platform}</div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a2a3e;font-family:monospace;font-size:13px;font-weight:700;" align="right">
        <span style="color:${arrowColor}">${arrow} ${Math.abs(a.changePct).toFixed(0)}%</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a2a3e;font-family:monospace;font-size:11px;color:#bcbcd8;" align="right">
        ${fmtVal(a.current)} vs avg ${fmtVal(a.average)}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a2a3e;" align="right">
        <span style="background:${badgeColor};color:#13131f;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">${badgeLabel}</span>
      </td>
    </tr>`;
  }).join('');

  const critCount  = alerts.filter(a => a.severity === 'critical').length;
  const subject    = critCount > 0
    ? `🚨 ${critCount} critical metric alert${critCount > 1 ? 's' : ''} — Fold`
    : `⚠️ ${alerts.length} metric warning${alerts.length > 1 ? 's' : ''} — Fold`;
  const appUrl     = g('NEXT_PUBLIC_APP_URL') || 'https://usefold.io';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="font-family:monospace;font-size:18px;font-weight:700;color:#00d4aa;">fold</span>
        <span style="font-family:monospace;font-size:10px;color:#8585aa;letter-spacing:0.15em;text-transform:uppercase;">anomaly alert</span>
      </div>
      <div style="height:2px;background:linear-gradient(90deg,#f87171 0%,#f59e0b 60%,transparent 100%);border-radius:1px;"></div>
    </div>
    <div style="background:#1c1c2a;border:1px solid #363650;border-left:3px solid ${critCount > 0 ? '#f87171' : '#f59e0b'};border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="font-family:monospace;font-size:22px;font-weight:700;color:#f8f8fc;margin:0 0 6px;">
        ${alerts.length} metric ${alerts.length === 1 ? 'anomaly' : 'anomalies'} detected
      </p>
      <p style="font-family:monospace;font-size:12px;color:#8585aa;margin:0;">
        Today's data deviates significantly from your 7-day average. Review below.
      </p>
    </div>
    <div style="background:#1c1c2a;border:1px solid #363650;border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#222235;">
            <th style="padding:10px 16px;font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#8585aa;text-align:left;">Metric</th>
            <th style="padding:10px 16px;font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#8585aa;text-align:right;">Change</th>
            <th style="padding:10px 16px;font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#8585aa;text-align:right;">Today vs Avg</th>
            <th style="padding:10px 16px;font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#8585aa;text-align:right;">Severity</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${appUrl}/dashboard?tab=analytics" style="display:inline-block;background:#00d4aa;color:#13131f;font-family:monospace;font-size:13px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
        View Dashboard →
      </a>
    </div>
    <div style="border-top:1px solid #1c1c2a;padding-top:20px;text-align:center;">
      <p style="font-family:monospace;font-size:10px;color:#454560;margin:0 0 4px;">
        You're receiving anomaly alerts from Fold Analytics.
      </p>
      <p style="font-family:monospace;font-size:10px;color:#454560;margin:0;">
        <a href="${appUrl}/dashboard?tab=settings" style="color:#454560;">Manage notification settings</a>
      </p>
    </div>
  </div>
</body></html>`;

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI FIX-IT PLAYBOOKS
// ─────────────────────────────────────────────────────────────────────────────

const FROM_PLAYBOOKS = 'Fold Playbooks <info@usefold.io>';
const SEV_COLOR_MAP  = { critical: '#f87171', warning: '#f59e0b', opportunity: '#34d399' };

function buildPlaybooksEmailHtml(payload, appUrl) {
  const { playbooks = [], healthScore = 0, healthLabel = 'Needs Work', summary = '' } = payload;
  const scoreColor = healthScore >= 75 ? '#34d399' : healthScore >= 50 ? '#f59e0b' : '#f87171';

  const rows = playbooks.slice(0, 8).map(pb => {
    const color     = SEV_COLOR_MAP[pb.severity] ?? '#8888aa';
    const firstStep = pb.steps?.[0];
    return `
<tr><td style="padding:16px;border-bottom:1px solid #1e1e2e;">
  <span style="background:${color}18;color:${color};border-radius:5px;padding:2px 8px;font-size:11px;font-weight:600;text-transform:uppercase;">${pb.severity}</span>
  <span style="background:#1e1e2e;color:#8888aa;border-radius:5px;padding:2px 8px;font-size:11px;margin-left:6px;">${pb.category}</span>
  <p style="margin:8px 0 4px;font-size:15px;font-weight:600;color:#f0f0f5;">${pb.title}</p>
  <p style="margin:0 0 8px;font-size:13px;color:#8888aa;line-height:1.5;">${pb.problem}</p>
  ${firstStep ? `<p style="margin:0 0 6px;font-size:13px;color:#d4d4e8;"><strong style="color:${color};">Step 1:</strong> ${firstStep.action}</p>` : ''}
  <span style="font-size:12px;color:#34d399;background:#34d39910;border-radius:5px;padding:2px 8px;">${pb.expectedGain}</span>
</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="font-size:20px;font-weight:700;color:#00d4aa;font-family:'Courier New',monospace;">Fold</span></td>
      <td align="right"><span style="font-size:11px;color:#4a4a6a;font-family:'Courier New',monospace;">WEEKLY PLAYBOOKS</span></td>
    </tr></table>
  </td></tr>

  <tr><td style="background:#12121a;border:1px solid #1e1e2e;border-radius:12px;padding:24px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0 0 4px;font-size:11px;color:#4a4a6a;text-transform:uppercase;letter-spacing:1px;font-family:'Courier New',monospace;">Business Health</p>
        <p style="margin:0;font-size:13px;color:#c0c0d8;line-height:1.6;">${summary}</p>
      </td>
      <td align="right" style="padding-left:20px;white-space:nowrap;">
        <span style="font-size:36px;font-weight:700;color:${scoreColor};font-family:'Courier New',monospace;">${healthScore}</span>
        <p style="margin:0;font-size:11px;color:${scoreColor};text-align:right;font-family:'Courier New',monospace;">${healthLabel}</p>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="height:20px;"></td></tr>

  <tr><td>
    <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#4a4a6a;text-transform:uppercase;letter-spacing:1px;font-family:'Courier New',monospace;">${playbooks.length} action plan${playbooks.length !== 1 ? 's' : ''} this week</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#12121a;border:1px solid #1e1e2e;border-radius:12px;overflow:hidden;">${rows}</table>
  </td></tr>

  <tr><td style="height:24px;"></td></tr>

  <tr><td align="center">
    <a href="${appUrl}/dashboard?tab=playbooks" style="display:inline-block;background:#00d4aa;color:#0a0a0f;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">View Full Playbooks →</a>
  </td></tr>

  <tr><td style="height:28px;border-top:1px solid #1e1e2e;padding-top:16px;margin-top:28px;">
    <p style="margin:0;font-size:11px;color:#4a4a6a;text-align:center;">
      Fold AI · <a href="${appUrl}/dashboard?tab=settings" style="color:#4a4a6a;">Manage notifications</a>
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;
}

async function sendPlaybooksEmail(toEmail, payload) {
  if (!RESEND_KEY) { logWarn('[playbooks-email] RESEND_API_KEY not set — skipping'); return; }
  const appUrl = g('NEXT_PUBLIC_APP_URL') || 'https://usefold.io';
  const html   = buildPlaybooksEmailHtml(payload, appUrl);
  try {
    const res = await fetchRetry('Resend playbooks email', 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    FROM_PLAYBOOKS,
        to:      [toEmail],
        subject: `📋 Your ${payload.playbooks?.length ?? 0} weekly AI playbooks are ready`,
        html,
      }),
    });
    if (res.ok) {
      logOk(`[playbooks-email] Sent to ${toEmail}`);
    } else {
      const t = await res.text().catch(() => '');
      logFail(`[playbooks-email] Resend ${res.status}: ${t.slice(0, 120)}`);
    }
  } catch (err) {
    logFail(`[playbooks-email] ${err.message}`);
  }
}

// ─── Single-user generator (called by both batch and HTTP trigger) ────────────

async function generatePlaybooksForUser(uid) {
  const today    = new Date().toISOString().slice(0, 10);
  const cutoff30 = daysAgo(30);
  const cutoff7  = daysAgo(7);
  const getHeaders = { apikey: SB.headers.apikey, Authorization: SB.headers.Authorization };

  try {
    const snapRes = await fetchRetry(
      `[playbooks] snapshots ${uid.slice(0, 8)}`,
      `${SUPABASE_URL}/rest/v1/daily_snapshots?` +
        new URLSearchParams({ select: 'provider,date,data', user_id: `eq.${uid}`, date: `gte.${cutoff30}`, order: 'date.desc' }),
      { headers: getHeaders },
    );
    const snaps = snapRes.ok ? (await snapRes.json()) : [];

    if (snaps.length < 7) {
      logWarn(`[playbooks] Skipping ${uid.slice(0, 8)} — only ${snaps.length} days of data`);
      return null;
    }

    // Fetch the LATEST stripe snapshot ever (not limited to 30d) to get accurate MRR/subs
    // This handles cases where the last charge was >30 days ago (e.g. annual plans)
    const latestStripeRes = await fetchRetry(
      `[playbooks] latest stripe snap ${uid.slice(0, 8)}`,
      `${SUPABASE_URL}/rest/v1/daily_snapshots?` +
        new URLSearchParams({ select: 'data', user_id: `eq.${uid}`, provider: 'eq.stripe', order: 'date.desc', limit: '1' }),
      { headers: getHeaders },
    );
    const latestStripeSnap = latestStripeRes.ok ? (await latestStripeRes.json())[0] : null;

    const intRes = await fetchRetry(
      `[playbooks] integrations ${uid.slice(0, 8)}`,
      `${SUPABASE_URL}/rest/v1/integrations?` + new URLSearchParams({ select: 'platform,access_token', user_id: `eq.${uid}` }),
      { headers: getHeaders },
    );
    const integrations = intRes.ok ? (await intRes.json()) : [];
    const connectedPlatforms = integrations.map(i => i.platform);

    // If latestStripeSnap has 0 MRR but stripe is connected, fetch live from Stripe API
    let liveMRR = latestStripeSnap?.data?.mrr ?? 0;
    let liveActiveSubs = latestStripeSnap?.data?.activeSubscriptions ?? 0;
    if (connectedPlatforms.includes('stripe') && (liveMRR === 0 || liveActiveSubs === 0)) {
      try {
        const stripeInt = integrations.find(i => i.platform === 'stripe');
        if (stripeInt?.access_token) {
          const stripeHeaders = { Authorization: `Bearer ${stripeInt.access_token}` };
          let subsUrl = `https://api.stripe.com/v1/subscriptions?limit=100&status=active&expand[]=data.items.data.price`;
          let fetchedMRR = 0, fetchedSubs = 0;
          while (subsUrl) {
            const res = await fetchRetry('Stripe live subs (playbooks)', subsUrl, { headers: stripeHeaders });
            if (!res.ok) break;
            const body = await res.json();
            for (const s of (body.data ?? [])) {
              fetchedSubs++;
              for (const item of (s.items?.data ?? [])) {
                const price = item.price ?? {};
                const unitAmount = price.unit_amount ?? item.plan?.amount ?? 0;
                const qty = item.quantity ?? 1;
                const interval = price.recurring?.interval ?? item.plan?.interval ?? 'month';
                const intervalCount = price.recurring?.interval_count ?? item.plan?.interval_count ?? 1;
                let monthlyAmount = 0;
                if (interval === 'month')  monthlyAmount = (unitAmount * qty) / intervalCount;
                else if (interval === 'year')  monthlyAmount = (unitAmount * qty) / (intervalCount * 12);
                else if (interval === 'week')  monthlyAmount = (unitAmount * qty * 52) / (intervalCount * 12);
                else if (interval === 'day')   monthlyAmount = (unitAmount * qty * 365) / (intervalCount * 12);
                fetchedMRR += Math.round(monthlyAmount);
              }
            }
            subsUrl = body.has_more
              ? `https://api.stripe.com/v1/subscriptions?limit=100&status=active&expand[]=data.items.data.price&starting_after=${body.data.at(-1).id}`
              : null;
          }
          if (fetchedSubs > 0) {
            liveMRR = fetchedMRR;
            liveActiveSubs = fetchedSubs;
            logOk(`[playbooks] Live Stripe fetch: ${fetchedSubs} subs, MRR=${fetchedMRR} cents`);
          }
        }
      } catch (e) { logWarn(`[playbooks] Live Stripe fetch failed: ${e.message}`); }
    }

    const REVENUE_P   = ['stripe','shopify','woocommerce','gumroad','lemon-squeezy','paddle','paypal'];
    const ANALYTICS_P = ['ga4','plausible','posthog','fathom','amplitude','heap'];
    const ADS_P       = ['meta','google-ads','tiktok-ads','twitter-ads','linkedin-ads'];

    const snaps7  = snaps.filter(s => s.date >= cutoff7);
    const snaps30 = snaps;
    const sumP = (arr, providers, field) =>
      arr.filter(s => providers.includes(s.provider)).reduce((a, s) => a + (s.data?.[field] ?? 0), 0);
    const sumS = (arr, provider, field) =>
      arr.filter(s => s.provider === provider).reduce((a, s) => a + (s.data?.[field] ?? 0), 0);
    const avgS = (arr, provider, field) => {
      const rows = arr.filter(s => s.provider === provider && (s.data?.[field] ?? 0) > 0);
      return rows.length ? rows.reduce((a, s) => a + s.data[field], 0) / rows.length : 0;
    };
    const latestS = (arr, provider, field) => {
      const rows = arr.filter(s => s.provider === provider && (s.data?.[field] ?? 0) != null);
      return rows.length ? (rows[0].data?.[field] ?? 0) : 0;
    };

    const anCounts = {};
    for (const s of snaps) {
      if (!ANALYTICS_P.includes(s.provider)) continue;
      if (Object.values(s.data ?? {}).some(v => v > 0)) anCounts[s.provider] = (anCounts[s.provider] ?? 0) + 1;
    }
    const primaryAn = Object.keys(anCounts).sort((a, b) => (anCounts[b] ?? 0) - (anCounts[a] ?? 0))[0] ?? null;

    const rev7    = sumP(snaps7, REVENUE_P, 'revenue');
    const rev30   = sumP(snaps30, REVENUE_P, 'revenue');
    const spend7  = sumP(snaps7, ADS_P, 'spend');
    const spend30 = sumP(snaps30, ADS_P, 'spend');
    const newCx7  = sumP(snaps7, REVENUE_P, 'newCustomers');
    const newCx30 = sumP(snaps30, REVENUE_P, 'newCustomers');
    const churned30 = sumP(snaps30, REVENUE_P, 'churnedToday');
    const refunds30 = sumP(snaps30, REVENUE_P, 'refunds');
    const sess7   = primaryAn ? sumS(snaps7, primaryAn, 'sessions') : 0;
    const sess30  = primaryAn ? sumS(snaps30, primaryAn, 'sessions') : 0;
    // Use live-fetched values (most accurate) with fallback to latest snapshot
    const currentMRR = liveMRR || latestS(snaps, 'stripe', 'mrr');
    const activeSubs = liveActiveSubs || latestS(snaps, 'stripe', 'activeSubscriptions');
    const arpu       = activeSubs > 0 ? Math.round(currentMRR / activeSubs) : latestS(snaps, 'stripe', 'arpu');
    const bounce30   = primaryAn ? avgS(snaps30, primaryAn, 'bounceRate') : 0;
    const metaClicks30 = sumS(snaps30, 'meta', 'clicks');
    const metaImpr30   = sumS(snaps30, 'meta', 'impressions');
    const cpc30  = metaClicks30 > 0 ? sumS(snaps30, 'meta', 'spend') / metaClicks30 : 0;
    const ctr30  = metaImpr30   > 0 ? metaClicks30 / metaImpr30 : 0;
    const churnRate = activeSubs > 0 ? churned30 / activeSubs : 0;
    const cac30     = newCx30 > 0 && spend30 > 0 ? spend30 / newCx30 : 0;
    const convRate  = sess30  > 0 && newCx30 > 0  ? newCx30 / sess30  : 0;
    const fmtUSD = (cents) => `$${(cents / 100).toFixed(2)}`;

    let website = null;
    try {
      const wRes = await fetch(
        `${SUPABASE_URL}/rest/v1/website_profiles?` + new URLSearchParams({ select: 'url,score,description', user_id: `eq.${uid}` }),
        { headers: getHeaders },
      );
      const wRows = wRes.ok ? (await wRes.json()) : [];
      website = wRows[0] ?? null;
    } catch (_) { /* optional */ }

    // ── Fetch previous playbook feedback so the AI can learn ─────────────────
    let feedbackContext = '';
    try {
      const fbRes = await fetch(
        `${SUPABASE_URL}/rest/v1/playbook_feedback?` +
          new URLSearchParams({ select: 'playbook_id,playbook_title,rating,completed_steps', user_id: `eq.${uid}` }),
        { headers: getHeaders },
      );
      const fbRows = fbRes.ok ? (await fbRes.json()) : [];
      if (fbRows.length > 0) {
        const helpful     = fbRows.filter(r => r.rating ===  1);
        const notHelpful  = fbRows.filter(r => r.rating === -1);
        const inProgress  = fbRows.filter(r => (r.completed_steps ?? []).length > 0 && (r.completed_steps ?? []).length < 5);
        const completed   = fbRows.filter(r => (r.completed_steps ?? []).length >= 5);

        const lines = ['', '=== PREVIOUS PLAYBOOK FEEDBACK (use this to learn) ==='];
        if (helpful.length)
          lines.push(`MARKED HELPFUL (keep generating similar insights): ${helpful.map(r => `"${r.playbook_title}"`).join(', ')}`);
        if (notHelpful.length)
          lines.push(`MARKED NOT USEFUL / INACCURATE (do not repeat these exact recommendations, try a different angle or skip if data does not support): ${notHelpful.map(r => `"${r.playbook_title}"`).join(', ')}`);
        if (inProgress.length)
          lines.push(`IN PROGRESS (user has started some steps — acknowledge progress, focus remaining steps on what's left): ${inProgress.map(r => `"${r.playbook_title}" (${(r.completed_steps ?? []).length} steps done)`).join(', ')}`);
        if (completed.length)
          lines.push(`FULLY COMPLETED (user has done all steps — either show measurable outcome if visible in data, or replace with a new playbook): ${completed.map(r => `"${r.playbook_title}"`).join(', ')}`);
        lines.push('Use this history to avoid repeating useless advice, build on what worked, and surface new priorities the user has not yet addressed.');
        feedbackContext = lines.join('\n');
      }
    } catch (_) { /* non-critical — continue without feedback */ }

    // ── Per-platform revenue breakdowns ──────────────────────────────────────
    const stripeRev30    = sumS(snaps30, 'stripe', 'revenue');
    const stripeRev7     = sumS(snaps7,  'stripe', 'revenue');
    const stripeTx30     = sumS(snaps30, 'stripe', 'txCount');
    const trialingSubs   = latestS(snaps, 'stripe', 'trialingSubscriptions');
    const shopifyRev30   = sumS(snaps30, 'shopify',      'revenue');
    const shopifyOrders30= sumS(snaps30, 'shopify',      'orders');
    const shopifyAov30   = shopifyOrders30 > 0 ? shopifyRev30 / shopifyOrders30 : 0;
    const wooRev30       = sumS(snaps30, 'woocommerce',  'revenue');
    const wooOrders30    = sumS(snaps30, 'woocommerce',  'orders');
    const gumRev30       = sumS(snaps30, 'gumroad',      'revenue');
    const lsRev30        = sumS(snaps30, 'lemon-squeezy','revenue');
    const paddleRev30    = sumS(snaps30, 'paddle',       'revenue');
    const paypalRev30    = sumS(snaps30, 'paypal',       'revenue');
    const paypalFees30   = sumS(snaps30, 'paypal',       'fees');
    const amazonRev30    = sumS(snaps30, 'amazon-seller','revenue');
    const etsyRev30      = sumS(snaps30, 'etsy',         'revenue');
    const bigcRev30      = sumS(snaps30, 'bigcommerce',  'revenue');

    // ── Traffic: all analytics platforms ─────────────────────────────────────
    const ga4Sess30      = sumS(snaps30, 'ga4',       'sessions');
    const ga4Users30     = sumS(snaps30, 'ga4',       'users');
    const ga4Conv30      = sumS(snaps30, 'ga4',       'conversions');
    const ga4Bounce30    = avgS(snaps30, 'ga4',       'bounceRate');
    const ga4NewUsers30  = sumS(snaps30, 'ga4',       'newUsers');
    const plausibleSess30= sumS(snaps30, 'plausible', 'visitors');
    const posthogSess30  = sumS(snaps30, 'posthog',   'sessions');
    const fathomSess30   = sumS(snaps30, 'fathom',    'visitors');
    const mixpanelEv30   = sumS(snaps30, 'mixpanel',  'events');
    const amplitudeEv30  = sumS(snaps30, 'amplitude', 'events');

    // ── Paid ads: all platforms ───────────────────────────────────────────────
    const metaSpend30    = sumS(snaps30, 'meta',          'spend');
    const metaReach30    = sumS(snaps30, 'meta',          'reach');
    const metaConv30     = sumS(snaps30, 'meta',          'conversions');
    const gadsSpend30    = sumS(snaps30, 'google-ads',    'spend');
    const gadsClicks30   = sumS(snaps30, 'google-ads',    'clicks');
    const gadsConv30     = sumS(snaps30, 'google-ads',    'conversions');
    const gadsCpc30      = gadsClicks30 > 0 ? gadsSpend30 / gadsClicks30 : 0;
    const tiktokSpend30  = sumS(snaps30, 'tiktok-ads',   'spend');
    const tiktokClicks30 = sumS(snaps30, 'tiktok-ads',   'clicks');
    const linkedinSpend30= sumS(snaps30, 'linkedin-ads', 'spend');
    const twitterSpend30 = sumS(snaps30, 'twitter-ads',  'spend');
    const snapSpend30    = sumS(snaps30, 'snapchat-ads', 'spend');
    const pinSpend30     = sumS(snaps30, 'pinterest-ads','spend');
    const totalAdSpend30 = metaSpend30 + gadsSpend30 + tiktokSpend30 + linkedinSpend30 + twitterSpend30 + snapSpend30 + pinSpend30;
    const totalAdSpend7  = sumP(snaps7, ADS_P, 'spend');

    // ── Email marketing ───────────────────────────────────────────────────────
    const mcSubs30       = sumS(snaps30, 'mailchimp', 'subscribers');
    const mcOpen30       = avgS(snaps30, 'mailchimp', 'openRate');
    const mcClick30      = avgS(snaps30, 'mailchimp', 'clickRate');
    const mcSent30       = sumS(snaps30, 'mailchimp', 'emailsSent');
    const klSubs30       = sumS(snaps30, 'klaviyo',   'subscribers');
    const klOpen30       = avgS(snaps30, 'klaviyo',   'openRate');
    const klRev30        = sumS(snaps30, 'klaviyo',   'revenue');
    const beeSubs30      = sumS(snaps30, 'beehiiv',   'subscribers');
    const beeOpen30      = avgS(snaps30, 'beehiiv',   'openRate');
    const ckSubs30       = sumS(snaps30, 'convertkit','subscribers');
    const acSubs30       = sumS(snaps30, 'activecampaign','subscribers');
    const brevoSubs30    = sumS(snaps30, 'brevo',     'subscribers');

    // ── CRM ───────────────────────────────────────────────────────────────────
    const hsDeals30      = sumS(snaps30, 'hubspot',   'deals');
    const hsRev30        = sumS(snaps30, 'hubspot',   'revenue');
    const sfOpps30       = sumS(snaps30, 'salesforce','opportunities');
    const sfRev30        = sumS(snaps30, 'salesforce','revenue');
    const pdDeals30      = sumS(snaps30, 'pipedrive', 'deals');
    const pdRev30        = sumS(snaps30, 'pipedrive', 'revenue');

    // ── Support ───────────────────────────────────────────────────────────────
    const zdTickets30    = sumS(snaps30, 'zendesk',   'tickets');
    const zdSat30        = avgS(snaps30, 'zendesk',   'satisfactionScore');
    const fdTickets30    = sumS(snaps30, 'freshdesk', 'tickets');

    // ── Social / Content ──────────────────────────────────────────────────────
    const igFollowers    = latestS(snaps, 'instagram', 'followers');
    const igReach30      = sumS(snaps30, 'instagram', 'reach');
    const igEngRate30    = avgS(snaps30, 'instagram', 'engagementRate');
    const ytViews30      = sumS(snaps30, 'youtube',   'views');
    const ytSubs         = latestS(snaps, 'youtube',  'subscribers');

    const dataContext = [
      `TODAY: ${today}`,
      `CONNECTED PLATFORMS: ${connectedPlatforms.join(', ') || 'none'}`,
      '',
      '=== STRIPE / SUBSCRIPTIONS ===',
      `MRR: ${fmtUSD(currentMRR)}/month | Active subscriptions: ${activeSubs} | Trialing: ${trialingSubs}`,
      `ARPU: ${fmtUSD(arpu)}/month`,
      `Stripe revenue 7d: ${fmtUSD(stripeRev7)} | 30d: ${fmtUSD(stripeRev30)} | Transactions 30d: ${stripeTx30}`,
      `New customers 7d: ${newCx7} | 30d: ${newCx30}`,
      `Churned (30d): ${churned30} | Churn rate: ${churnRate > 0 ? (churnRate * 100).toFixed(2) + '%' : 'N/A'}`,
      `Refunds (30d): ${fmtUSD(refunds30)}`,
      `CAC (30d): ${cac30 > 0 ? '$' + (cac30 / 100).toFixed(2) : 'N/A'}`,
      '',
      ...(shopifyRev30 > 0 ? [
        '=== SHOPIFY ===',
        `Revenue 30d: ${fmtUSD(shopifyRev30)} | Orders: ${shopifyOrders30} | AOV: ${fmtUSD(shopifyAov30)}`,
        '',
      ] : []),
      ...(wooRev30 > 0 ? [`=== WOOCOMMERCE ===`, `Revenue 30d: ${fmtUSD(wooRev30)} | Orders: ${wooOrders30}`, ''] : []),
      ...(gumRev30 > 0 ? [`=== GUMROAD ===`, `Revenue 30d: ${fmtUSD(gumRev30)}`, ''] : []),
      ...(lsRev30 > 0  ? [`=== LEMON SQUEEZY ===`, `Revenue 30d: ${fmtUSD(lsRev30)}`, ''] : []),
      ...(paddleRev30 > 0 ? [`=== PADDLE ===`, `Revenue 30d: ${fmtUSD(paddleRev30)}`, ''] : []),
      ...(paypalRev30 > 0 ? [`=== PAYPAL ===`, `Revenue 30d: ${fmtUSD(paypalRev30)} | Fees: ${fmtUSD(paypalFees30)} | Net: ${fmtUSD(paypalRev30 - paypalFees30)}`, ''] : []),
      ...(amazonRev30 > 0 ? [`=== AMAZON SELLER ===`, `Revenue 30d: ${fmtUSD(amazonRev30)}`, ''] : []),
      ...(etsyRev30 > 0   ? [`=== ETSY ===`, `Revenue 30d: ${fmtUSD(etsyRev30)}`, ''] : []),
      ...(bigcRev30 > 0   ? [`=== BIGCOMMERCE ===`, `Revenue 30d: ${fmtUSD(bigcRev30)}`, ''] : []),
      `=== TOTAL REVENUE (all platforms, 30d) ===`,
      `Total: ${fmtUSD(rev30)} | Last 7d: ${fmtUSD(rev7)}`,
      '',
      '=== TRAFFIC ===',
      ...(ga4Sess30 > 0 ? [
        `GA4: Sessions 30d: ${ga4Sess30} | 7d: ${sess7} | Users: ${ga4Users30} | New users: ${ga4NewUsers30}`,
        `GA4: Conversions 30d: ${ga4Conv30} | Bounce rate: ${ga4Bounce30 > 0 ? ga4Bounce30.toFixed(1) + '%' : 'N/A'}`,
        `Conversion rate (sessions→customers, 30d): ${convRate > 0 ? (convRate * 100).toFixed(2) + '%' : 'N/A'}`,
      ] : []),
      ...(plausibleSess30 > 0 ? [`Plausible: Visitors 30d: ${plausibleSess30}`] : []),
      ...(posthogSess30 > 0   ? [`PostHog: Sessions 30d: ${posthogSess30}`] : []),
      ...(fathomSess30 > 0    ? [`Fathom: Visitors 30d: ${fathomSess30}`] : []),
      ...(mixpanelEv30 > 0    ? [`Mixpanel: Events 30d: ${mixpanelEv30}`] : []),
      ...(amplitudeEv30 > 0   ? [`Amplitude: Events 30d: ${amplitudeEv30}`] : []),
      '',
      '=== PAID ADS ===',
      `Total ad spend 7d: $${totalAdSpend7.toFixed(2)} | 30d: $${totalAdSpend30.toFixed(2)}`,
      ...(metaSpend30 > 0 ? [
        `Meta: Spend 30d: $${metaSpend30.toFixed(2)} | Reach: ${metaReach30} | Clicks: ${metaClicks30} | Conversions: ${metaConv30}`,
        `Meta: CPC: ${cpc30 > 0 ? '$' + cpc30.toFixed(2) : 'N/A'} | CTR: ${ctr30 > 0 ? (ctr30 * 100).toFixed(2) + '%' : 'N/A'}`,
      ] : []),
      ...(gadsSpend30 > 0   ? [`Google Ads: Spend 30d: $${gadsSpend30.toFixed(2)} | Clicks: ${gadsClicks30} | CPC: ${gadsCpc30 > 0 ? '$' + gadsCpc30.toFixed(2) : 'N/A'} | Conversions: ${gadsConv30}`] : []),
      ...(tiktokSpend30 > 0 ? [`TikTok Ads: Spend 30d: $${tiktokSpend30.toFixed(2)} | Clicks: ${tiktokClicks30}`] : []),
      ...(linkedinSpend30 > 0 ? [`LinkedIn Ads: Spend 30d: $${linkedinSpend30.toFixed(2)}`] : []),
      ...(twitterSpend30 > 0  ? [`Twitter Ads: Spend 30d: $${twitterSpend30.toFixed(2)}`] : []),
      ...(snapSpend30 > 0     ? [`Snapchat Ads: Spend 30d: $${snapSpend30.toFixed(2)}`] : []),
      ...(pinSpend30 > 0      ? [`Pinterest Ads: Spend 30d: $${pinSpend30.toFixed(2)}`] : []),
      '',
      '=== EMAIL MARKETING ===',
      ...(mcSubs30 > 0   ? [`Mailchimp: Subscribers 30d: ${mcSubs30} | Sent: ${mcSent30} | Open rate: ${mcOpen30 > 0 ? (mcOpen30*100).toFixed(1)+'%' : 'N/A'} | Click rate: ${mcClick30 > 0 ? (mcClick30*100).toFixed(1)+'%' : 'N/A'}`] : []),
      ...(klSubs30 > 0   ? [`Klaviyo: Subscribers 30d: ${klSubs30} | Open rate: ${klOpen30 > 0 ? (klOpen30*100).toFixed(1)+'%' : 'N/A'} | Revenue attr: ${fmtUSD(klRev30)}`] : []),
      ...(beeSubs30 > 0  ? [`Beehiiv: Subscribers 30d: ${beeSubs30} | Open rate: ${beeOpen30 > 0 ? (beeOpen30*100).toFixed(1)+'%' : 'N/A'}`] : []),
      ...(ckSubs30 > 0   ? [`ConvertKit: Subscribers 30d: ${ckSubs30}`] : []),
      ...(acSubs30 > 0   ? [`ActiveCampaign: Subscribers 30d: ${acSubs30}`] : []),
      ...(brevoSubs30 > 0? [`Brevo: Subscribers 30d: ${brevoSubs30}`] : []),
      ...(!mcSubs30 && !klSubs30 && !beeSubs30 && !ckSubs30 && !acSubs30 && !brevoSubs30 ? ['No email platform connected.'] : []),
      '',
      '=== CRM / SALES PIPELINE ===',
      ...(hsDeals30 > 0  ? [`HubSpot: Deals 30d: ${hsDeals30} | Revenue: ${fmtUSD(hsRev30)}`] : []),
      ...(sfOpps30 > 0   ? [`Salesforce: Opportunities 30d: ${sfOpps30} | Revenue: ${fmtUSD(sfRev30)}`] : []),
      ...(pdDeals30 > 0  ? [`Pipedrive: Deals 30d: ${pdDeals30} | Revenue: ${fmtUSD(pdRev30)}`] : []),
      ...(!hsDeals30 && !sfOpps30 && !pdDeals30 ? ['No CRM connected.'] : []),
      '',
      '=== CUSTOMER SUPPORT ===',
      ...(zdTickets30 > 0 ? [`Zendesk: Tickets 30d: ${zdTickets30} | Satisfaction: ${zdSat30 > 0 ? (zdSat30*100).toFixed(0)+'%' : 'N/A'}`] : []),
      ...(fdTickets30 > 0 ? [`Freshdesk: Tickets 30d: ${fdTickets30}`] : []),
      ...(!zdTickets30 && !fdTickets30 ? ['No support platform connected.'] : []),
      '',
      '=== SOCIAL / CONTENT ===',
      ...(igFollowers > 0  ? [`Instagram: Followers: ${igFollowers} | Reach 30d: ${igReach30} | Engagement rate: ${igEngRate30 > 0 ? (igEngRate30*100).toFixed(2)+'%' : 'N/A'}`] : []),
      ...(ytSubs > 0       ? [`YouTube: Subscribers: ${ytSubs} | Views 30d: ${ytViews30}`] : []),
      ...(!igFollowers && !ytSubs ? ['No social platform connected.'] : []),
      '',
      '=== WEBSITE ===',
      `URL: ${website?.url ?? 'Not set'}`,
      `Health score: ${website?.score ?? 'N/A'}/100`,
      ...(website?.description ? [`Description: ${website.description}`] : []),
      feedbackContext,
    ].filter(l => l !== undefined).join('\n');

    const aiRes = await fetchRetry(
      `[playbooks] Anthropic ${uid.slice(0, 8)}`,
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-opus-4-5',
          max_tokens: 8000,
          system: `You are an elite growth advisor with deep expertise in SaaS, e-commerce, paid acquisition, and retention. Generate highly specific, data-driven Fix-It Playbooks from the founder's REAL metrics.

CORE RULES:
- Reference actual numbers from the data in every problem statement and step detail.
- Only flag problems that are clearly visible in the data — never invent issues.
- Be concrete: name exact platforms, settings, thresholds, and tools.
- Generate 5–8 playbooks ordered from most critical to biggest opportunity.

PROBLEM FIELD: 1–2 sentences. Quote the exact metric and how far it deviates from the benchmark. Explain what is happening mechanically (e.g. "Your Meta CPC is $4.20 vs the $1.50 industry benchmark — ad fatigue or broad targeting is draining budget without converting.").

IMPACT FIELD: 2–3 sentences. Explain the downstream business cost in concrete terms — lost revenue, wasted spend, compounding churn effect, missed growth. Include a rough monthly dollar or percentage estimate where possible.

STEPS: Each playbook must have 4–6 steps. Each step must include:
  - "action": a short imperative headline (what to do).
  - "detail": 3–5 sentences explaining exactly HOW to do it, WHY it works, what to watch out for, and what result to expect. Be specific — name menu paths, settings names, test durations, expected lift percentages. Do not be vague.
  - "link": a real, relevant resource (docs, tool, article) when applicable.

EXPECTED GAIN: Be specific — e.g. "Reduce CAC by ~30% within 3 weeks" or "Recover ~$800/month in churned MRR".

PROOF CHARTS (chartSpec) — use ONLY these exact keys:
  meta → spend (usd), cpc (usd), ctr (percent_decimal)
  ga4  → sessions (number), bounceRate (percent_decimal)
  stripe → revenue (usd_cents), newCustomers (number)
  mailchimp/klaviyo → openRate (percent_decimal), clickRate (percent_decimal)

OUTPUT: valid JSON only, no markdown fences.
{"healthScore":<0-100>,"healthLabel":"<Healthy|Needs Work|At Risk>","summary":"<3-4 sentences covering overall business health, biggest risk, and top opportunity>","playbooks":[{"id":"<slug>","title":"<title>","problem":"<1-2 sentences with exact numbers and deviation from benchmark>","impact":"<2-3 sentences on business cost with dollar/percentage estimate>","category":"<paid-ads|revenue|retention|conversion|email|seo|ecommerce>","severity":"<critical|warning|opportunity>","expectedGain":"<specific measurable gain>","triggeredBy":[{"label":"<metric>","value":"<actual>","benchmark":"<target>"}],"chartSpec":{"provider":"<p>","metric":"<key>","unit":"<unit>","title":"<title>","benchmark":<n>,"benchmarkLabel":"<label>"},"steps":[{"action":"<imperative headline>","detail":"<3-5 sentences: how to do it, why it works, what to watch, expected result>","link":{"label":"<label>","url":"<url>"}}]}]}`,
          messages: [{ role: 'user', content: `Generate Fix-It Playbooks (critical first):\n\n${dataContext}` }],
        }),
      },
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '');
      throw new Error(`Anthropic ${aiRes.status}: ${errText.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    let raw = (aiJson.content?.[0]?.text ?? '').trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Anthropic response');
    const parsed = JSON.parse(jsonMatch[0]);

    // Hydrate chartSpec → chart
    const derived = [...snaps].sort((a, b) => a.date.localeCompare(b.date)).map(s => {
      const d = { ...(s.data ?? {}) };
      if (s.provider === 'meta') {
        if (d.clicks > 0)      d.cpc = d.spend / d.clicks;
        if (d.impressions > 0) d.ctr = d.clicks / d.impressions;
      }
      if (s.provider === 'mailchimp' || s.provider === 'klaviyo') {
        if (d.emailsSent > 0) { d.openRate = d.opens / d.emailsSent; d.clickRate = d.clicks / d.emailsSent; }
      }
      return { provider: s.provider, date: s.date, data: d };
    });

    for (const pb of parsed.playbooks ?? []) {
      const spec = pb.chartSpec;
      if (!spec?.provider || !spec?.metric) { delete pb.chartSpec; continue; }
      const points = derived
        .filter(s => s.provider === spec.provider)
        .map(s => ({ date: s.date, value: s.data[spec.metric] ?? 0 }))
        .filter(p => p.value > 0);
      if (points.length >= 3) {
        pb.chart = { title: spec.title, unit: spec.unit, benchmark: spec.benchmark, benchmarkLabel: spec.benchmarkLabel, points };
      }
      delete pb.chartSpec;
    }

    const payload = {
      playbooks:   parsed.playbooks ?? [],
      healthScore: parsed.healthScore ?? 50,
      healthLabel: parsed.healthLabel ?? 'Needs Work',
      summary:     parsed.summary ?? '',
      generatedAt: new Date().toISOString(),
    };

    await SB.upsert('ai_playbooks_cache', { user_id: uid, payload, generated_at: payload.generatedAt }, 'user_id');
    logOk(`[playbooks] Done for ${uid.slice(0, 8)} — ${payload.playbooks.length} playbooks, score=${payload.healthScore}`);
    return payload;

  } catch (err) {
    logFail(`[playbooks] Failed for ${uid.slice(0, 8)}: ${err.message}`);
    return null;
  }
}

// ─── Nightly batch (no email) ─────────────────────────────────────────────────

async function generateAllPlaybooks() {
  if (!ANTHROPIC_KEY) { logWarn('[playbooks] ANTHROPIC_API_KEY not set — skipping'); return; }
  const today = new Date().toISOString().slice(0, 10);
  log(`[playbooks] Starting nightly generation — ${today}`);

  const getHeaders = { apikey: SB.headers.apikey, Authorization: SB.headers.Authorization };
  let users;
  try {
    const [premRes, trialRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/users?select=id&subscription_status=eq.active`, { headers: getHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/users?select=id&trial_ends_at=gte.${today}`, { headers: getHeaders }),
    ]);
    const prem  = premRes.ok  ? (await premRes.json()) : [];
    const trial = trialRes.ok ? (await trialRes.json()) : [];
    const seen  = new Set();
    users = [...prem, ...trial].filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
  } catch (err) { logFail(`[playbooks] Cannot fetch users: ${err.message}`); return; }

  if (!users.length) { log('[playbooks] No premium users — skipping'); return; }
  log(`[playbooks] Generating for ${users.length} user(s)…`);

  let ok = 0, skipped = 0;
  for (const { id: uid } of users) {
    const r = await generatePlaybooksForUser(uid);
    r ? ok++ : skipped++;
    await sleep(USER_DELAY_MS);
  }
  log(`[playbooks] Complete — ${ok} generated, ${skipped} skipped/failed`);
}

// ─── Weekly batch with email ──────────────────────────────────────────────────

async function sendWeeklyPlaybooksEmails() {
  if (!ANTHROPIC_KEY) { logWarn('[playbooks-weekly] ANTHROPIC_API_KEY not set — skipping'); return; }
  const today = new Date().toISOString().slice(0, 10);
  log(`[playbooks-weekly] Starting weekly playbooks + email — ${today}`);

  const getHeaders = { apikey: SB.headers.apikey, Authorization: SB.headers.Authorization };
  let users;
  try {
    const [premRes, trialRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email&subscription_status=eq.active`, { headers: getHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email&trial_ends_at=gte.${today}`, { headers: getHeaders }),
    ]);
    const prem  = premRes.ok  ? (await premRes.json()) : [];
    const trial = trialRes.ok ? (await trialRes.json()) : [];
    const seen  = new Set();
    users = [...prem, ...trial].filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
  } catch (err) { logFail(`[playbooks-weekly] Cannot fetch users: ${err.message}`); return; }

  if (!users.length) { log('[playbooks-weekly] No eligible users — skipping'); return; }
  log(`[playbooks-weekly] Processing ${users.length} user(s)…`);

  let ok = 0, failed = 0;
  for (const { id: uid, email } of users) {
    const payload = await generatePlaybooksForUser(uid);
    if (payload && email && RESEND_KEY) {
      await sendPlaybooksEmail(email, payload);
      ok++;
    } else if (!payload) {
      failed++;
    }
    await sleep(USER_DELAY_MS);
  }
  log(`[playbooks-weekly] Complete — ${ok} emailed, ${failed} failed/skipped`);
}


async function runAnomalyAlerts() {
  if (!RESEND_KEY) {
    logWarn('[anomaly] RESEND_API_KEY not set — skipping anomaly alert emails');
  }
  if (!RESEND_KEY) {
    logWarn('[anomaly] RESEND_API_KEY not set — skipping anomaly alert emails');
  }

  const today        = new Date().toISOString().slice(0, 10);
  const lookback     = daysAgo(14);
  const monitoredPlatforms = Object.keys(ANOMALY_MONITORED);

  log('[anomaly] Running anomaly detection for all active users…');

  // 1. Fetch all premium + active-trial users
  let users;
  try {
    users = await SB.selectWhere('users', 'id,email,is_premium,trial_ends_at', {
      is_premium: 'eq.true',
    });
    // Also fetch trial users
    const trialUsers = await SB.selectWhere('users', 'id,email,is_premium,trial_ends_at', {
      trial_ends_at: `gte.${today}`,
    }).catch(() => []);
    // Merge, deduplicate by id
    const seen = new Set(users.map(u => u.id));
    for (const u of (trialUsers ?? [])) {
      if (!seen.has(u.id)) { users.push(u); seen.add(u.id); }
    }
  } catch (err) {
    logFail(`[anomaly] Cannot fetch users: ${err.message}`);
    return;
  }

  if (!users?.length) { log('[anomaly] No eligible users.'); return; }

  // 2. Filter to users who have at least one monitored integration
  let integrations;
  try {
    integrations = await SB.selectWhere('integrations', 'user_id,platform', {
      platform: `in.(${monitoredPlatforms.join(',')})`,
    });
  } catch (err) {
    logFail(`[anomaly] Cannot fetch integrations: ${err.message}`);
    return;
  }

  const usersWithIntegrations = new Set((integrations ?? []).map(i => i.user_id));
  const eligibleUsers = users.filter(u => usersWithIntegrations.has(u.id));

  log(`[anomaly] ${eligibleUsers.length} user(s) with monitored integrations`);
  let notified = 0;

  for (const user of eligibleUsers) {
    const uid = user.id;

    // 3. Fetch last 14 days of snapshots for monitored platforms
    let snaps;
    try {
      const p = new URLSearchParams({
        select:   'provider,date,data',
        user_id:  `eq.${uid}`,
        date:     `gte.${lookback}`,
        provider: `in.(${monitoredPlatforms.join(',')})`,
        order:    'date.asc',
      });
      const getHeaders = { apikey: SB.headers.apikey, Authorization: SB.headers.Authorization };
      const r = await fetchRetry(
        `SB SELECT daily_snapshots[anomaly:${uid.slice(0, 8)}]`,
        `${SUPABASE_URL}/rest/v1/daily_snapshots?${p}`,
        { headers: getHeaders },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      snaps = await r.json();
    } catch (err) {
      logWarn(`[anomaly] Cannot fetch snapshots for ${uid.slice(0, 8)}: ${err.message}`);
      continue;
    }

    if (!snaps?.length) continue;

    // 4. Detect anomalies
    const alerts = [];

    for (const [platform, metrics] of Object.entries(ANOMALY_MONITORED)) {
      const platformSnaps = snaps.filter(s => s.provider === platform);
      const historical    = platformSnaps.filter(s => s.date < today);
      const todaySnap     = platformSnaps.find(s => s.date === today);

      if (!todaySnap || historical.length < ANOMALY_MIN_HISTORY) continue;

      for (const { key, label, unit, lowerIsBad } of metrics) {
        const historicalVals = historical
          .map(s => s.data?.[key] ?? 0)
          .filter(v => v > 0);

        if (historicalVals.length < ANOMALY_MIN_HISTORY) continue;

        const average  = historicalVals.reduce((a, b) => a + b, 0) / historicalVals.length;
        if (average === 0) continue;

        const current   = todaySnap.data?.[key] ?? 0;
        const changePct = ((current - average) / average) * 100;
        const absPct    = Math.abs(changePct);

        // Only alert when the change is in the "bad" direction
        const isBadDrop  = lowerIsBad  && changePct < 0 && absPct >= ANOMALY_WARN_THRESHOLD * 100;
        const isBadSpike = !lowerIsBad && changePct > 0 && absPct >= ANOMALY_WARN_THRESHOLD * 100;
        if (!isBadDrop && !isBadSpike) continue;

        const severity = absPct >= ANOMALY_CRIT_THRESHOLD * 100 ? 'critical' : 'warning';
        alerts.push({
          label,
          platform: platform.charAt(0).toUpperCase() + platform.slice(1),
          current,
          average,
          changePct,
          direction: current < average ? 'down' : 'up',
          severity,
          unit,
          lowerIsBad,
        });
      }
    }

    if (!alerts.length) {
      logOk(`[anomaly] User ${uid.slice(0, 8)} — no anomalies`);
      continue;
    }

    log(`[anomaly] User ${uid.slice(0, 8)} — ${alerts.length} anomal${alerts.length === 1 ? 'y' : 'ies'} detected`);
    alerts.forEach(a =>
      log(`  → ${a.severity === 'critical' ? '🚨' : '⚠️'} ${a.label} ${a.direction === 'down' ? '▼' : '▲'} ${Math.abs(a.changePct).toFixed(0)}% (${a.platform})`)
    );

    // 5. Write to notifications table
    try {
      const records = alerts.map(a => ({
        user_id: uid,
        message: `${a.severity === 'critical' ? '🚨' : '⚠️'} ${a.label} ${a.direction === 'down' ? 'dropped' : 'spiked'} ${Math.abs(a.changePct).toFixed(0)}%`,
        detail:  `${a.platform}: today ${a.current.toLocaleString('en-US', { maximumFractionDigits: 0 })} vs 7d avg ${a.average.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        color:   a.severity === 'critical' ? '#f87171' : '#f59e0b',
        icon:    a.severity === 'critical' ? '🚨' : '⚠️',
        read:    false,
      }));
      await SB.insert('notifications', records);
    } catch (err) {
      logWarn(`[anomaly] Could not persist notifications for ${uid.slice(0, 8)}: ${err.message}`);
    }

    // 6. Send email for critical alerts or ≥2 warnings
    const hasCritical = alerts.some(a => a.severity === 'critical');
    const shouldEmail = RESEND_KEY && (hasCritical || alerts.length >= 2) && user.email;

    if (shouldEmail) {
      try {
        const { subject, html } = buildAnomalyAlertEmailHtml(alerts);
        const res = await fetchRetry(
          `Resend anomaly[${uid.slice(0, 8)}]`,
          'https://api.resend.com/emails',
          {
            method: 'POST',
            headers: {
              Authorization:  `Bearer ${RESEND_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from:    FROM_EMAIL,
              to:      user.email,
              subject,
              html,
            }),
          },
        );
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          logWarn(`[anomaly] Resend failed for ${uid.slice(0, 8)}: ${e?.message ?? res.status}`);
        } else {
          logOk(`[anomaly] Alert email sent to ${user.email}`);
        }
      } catch (err) {
        logWarn(`[anomaly] Email error for ${uid.slice(0, 8)}: ${err.message}`);
      }
    }

    notified++;
    await sleep(PLATFORM_DELAY_MS);
  }

  log(`[anomaly] Done — ${notified}/${eligibleUsers.length} user(s) had anomalies`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GOALS & KPIs CHECK
// Run after every daily sync (same cadence as checkAlerts).
// Reads the `goals` JSONB column on `users` (set by the user in Settings),
// aggregates month-to-date snapshots, and sends a one-time congratulatory email
// when a monthly target is first reached.
//
// DB columns used (all on public.users — see migration 009_goals_and_alert_rules.sql):
//   goals                 – { revenueTarget (cents), sessionsTarget, subscribersTarget, adSpendBudget (cents) }
//   goals_notified_month  – { revenueTarget: "YYYY-MM", ... } — dedup tracker, written here only
//
// goals shape (matches SettingsTab GoalsSection):
//   revenueTarget      – cents (Stripe MtD revenue goal)
//   sessionsTarget     – integer (GA4 MtD sessions goal)
//   subscribersTarget  – integer (Mailchimp/Beehiiv/Klaviyo MtD new-subscribers goal)
//   adSpendBudget      – cents (Meta MtD ad-spend budget cap — fires when OVER budget)
// ─────────────────────────────────────────────────────────────────────────────

function buildGoalsEmailHtml(hits, email) {
  const rows = hits.map(h => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #1e1e2e;">
        <span style="font-size:18px;margin-right:8px;">${h.icon}</span>
        <strong style="color:#f0f0f5;">${h.title}</strong><br>
        <span style="color:#8888aa;font-size:13px;">${h.detail}</span>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0d0d16;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#00d4aa,#635bff);padding:24px 28px;">
      <p style="margin:0;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.7);">Fold — Goals & KPIs</p>
      <h1 style="margin:6px 0 0;font-size:22px;color:#fff;">🎯 You hit your goal!</h1>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 16px;color:#8888aa;font-size:14px;">The following KPI targets were reached this month:</p>
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
      You're receiving this because you have Goals & KPIs set in Fold.<br>
      Manage goals in <a href="${g('NEXT_PUBLIC_APP_URL') || 'https://usefold.io'}/dashboard" style="color:#00d4aa;text-decoration:none;">Settings → Goals & KPIs</a>.
    </div>
  </div>
</body></html>`;
}

async function checkGoals() {
  log('[goals] Checking Goals & KPIs for all users…');

  // Current month string e.g. "2026-04"
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthStart   = `${currentMonth}-01`; // first day of this month (ISO date)

  // 1. Fetch all users that have goals configured
  //    Also pull goals_notified_month so we can skip already-notified goals
  let users;
  try {
    users = await SB.selectWhere('users', 'id,email,goals,goals_notified_month', {
      goals: 'not.is.null',
    });
  } catch (err) {
    logFail(`[goals] Cannot fetch users: ${err.message}`);
    return;
  }

  if (!users?.length) { log('[goals] No users with goals found.'); return; }

  let notified = 0;

  for (const user of users) {
    const goals = user.goals;
    if (!goals) continue;

    // Check if any non-zero target exists
    const hasRevenue     = (goals.revenueTarget     ?? 0) > 0;
    const hasSessions    = (goals.sessionsTarget     ?? 0) > 0;
    const hasSubscribers = (goals.subscribersTarget  ?? 0) > 0;
    const hasAdBudget    = (goals.adSpendBudget      ?? 0) > 0;

    if (!hasRevenue && !hasSessions && !hasSubscribers && !hasAdBudget) continue;

    // goals_notified_month is a separate DB column — never touches the user's goals JSON
    const notifiedMap = user.goals_notified_month ?? {};

    // 2. Fetch month-to-date snapshots for this user
    let snaps;
    try {
      const p = new URLSearchParams({
        select:  'provider,date,data',
        user_id: `eq.${user.id}`,
        date:    `gte.${monthStart}`,
      });
      const getHeaders = { apikey: SB.headers.apikey, Authorization: SB.headers.Authorization };
      const r = await fetchRetry(
        `SB SELECT daily_snapshots[goals/${user.id.slice(0, 8)}]`,
        `${SUPABASE_URL}/rest/v1/daily_snapshots?${p}`,
        { headers: getHeaders },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      snaps = await r.json();
    } catch (err) {
      logWarn(`[goals] Cannot fetch snapshots for ${user.id.slice(0, 8)}: ${err.message}`);
      continue;
    }

    if (!snaps?.length) continue;

    // 3. Aggregate month-to-date values from snapshots
    const sumField = (provider, field) =>
      snaps.filter(s => s.provider === provider)
           .reduce((acc, s) => acc + ((s.data?.[field]) ?? 0), 0);

    const mtdRevenue      = sumField('stripe', 'revenue');          // cents
    const mtdSessions     = sumField('ga4',    'sessions');         // integer
    // new subscribers: aggregate across all connected email platforms
    const mtdSubscribers  = sumField('mailchimp', 'newSubscribers')
                          + sumField('klaviyo',   'newSubscribers')
                          + sumField('beehiiv',   'newSubscribers');
    // Meta ad spend is stored in dollars → convert to cents for comparison
    const mtdAdSpendCents = Math.round(sumField('meta', 'spend') * 100);

    // 4. Determine which goals were hit and not yet notified this month
    const hits = [];

    if (hasRevenue && mtdRevenue >= goals.revenueTarget && notifiedMap.revenueTarget !== currentMonth) {
      hits.push({
        key:    'revenueTarget',
        icon:   '💰',
        title:  `Revenue target hit: $${(mtdRevenue / 100).toFixed(2)}`,
        detail: `You hit your $${(goals.revenueTarget / 100).toFixed(2)} monthly revenue target. Keep going!`,
      });
    }

    if (hasSessions && mtdSessions >= goals.sessionsTarget && notifiedMap.sessionsTarget !== currentMonth) {
      hits.push({
        key:    'sessionsTarget',
        icon:   '📈',
        title:  `Sessions target hit: ${mtdSessions.toLocaleString('en-US')}`,
        detail: `You reached your ${goals.sessionsTarget.toLocaleString('en-US')} monthly sessions target.`,
      });
    }

    if (hasSubscribers && mtdSubscribers >= goals.subscribersTarget && notifiedMap.subscribersTarget !== currentMonth) {
      hits.push({
        key:    'subscribersTarget',
        icon:   '📬',
        title:  `Subscribers target hit: ${mtdSubscribers.toLocaleString('en-US')} new`,
        detail: `You gained ${mtdSubscribers.toLocaleString('en-US')} new subscribers this month, hitting your target of ${goals.subscribersTarget.toLocaleString('en-US')}.`,
      });
    }

    // adSpendBudget is a monthly budget CAP — notify when crossed
    if (hasAdBudget && mtdAdSpendCents >= goals.adSpendBudget && notifiedMap.adSpendBudget !== currentMonth) {
      hits.push({
        key:    'adSpendBudget',
        icon:   '💸',
        title:  `Ad spend budget reached: $${(mtdAdSpendCents / 100).toFixed(2)}`,
        detail: `Your Meta Ads spend this month has reached your $${(goals.adSpendBudget / 100).toFixed(2)} monthly budget cap.`,
      });
    }

    if (!hits.length) {
      logOk(`[goals] User ${user.id.slice(0, 8)} — no new goals hit`);
      continue;
    }

    log(`[goals] User ${user.id.slice(0, 8)} — ${hits.length} goal(s) reached`);
    hits.forEach(h => log(`  → ${h.icon} ${h.title}`));

    // 5. Send congratulatory email
    const subject = hits.length === 1
      ? `Fold: ${hits[0].title}`
      : `Fold: You hit ${hits.length} KPI targets this month!`;

    await sendAlertEmail(user.email, subject, buildGoalsEmailHtml(hits, user.email));
    notified++;

    // 6. Persist updated goals_notified_month to the SEPARATE column
    //    (never mutates the user's goals JSON — clean separation of concerns)
    const updatedNotifiedMap = { ...notifiedMap };
    for (const h of hits) updatedNotifiedMap[h.key] = currentMonth;

    try {
      await SB.patch(
        'users',
        { goals_notified_month: updatedNotifiedMap },
        { id: user.id },
      );
    } catch (err) {
      logWarn(`[goals] Could not persist goals_notified_month for ${user.id.slice(0, 8)}: ${err.message}`);
    }
  }

  log(`[goals] Done — ${notified} user(s) notified`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STALE DATA CLEANUP
// Called when a user reconnects a platform with a DIFFERENT account.
// Deletes snapshots for that provider + all digests + all share_tokens.
// ─────────────────────────────────────────────────────────────────────────────
async function clearStaleData(userId, provider) {
  log(`[clear] Clearing stale data for user=${userId.slice(0, 8)} provider=${provider}`);

  // 1. Delete snapshots for this provider
  const snapUrl = `${SUPABASE_URL}/rest/v1/daily_snapshots?` +
    new URLSearchParams({ user_id: `eq.${userId}`, provider: `eq.${provider}` });
  const snapRes = await fetchRetry(`SB DELETE daily_snapshots[${provider}]`, snapUrl, {
    method: 'DELETE', headers: SB.headers,
  });
  if (!snapRes.ok) logWarn(`[clear] Could not delete ${provider} snapshots: ${snapRes.status}`);
  else logOk(`[clear] Deleted ${provider} snapshots`);

  // 2. Delete all digests (cross-platform — now stale)
  const digestUrl = `${SUPABASE_URL}/rest/v1/digests?user_id=eq.${userId}`;
  const digestRes = await fetchRetry('SB DELETE digests', digestUrl, {
    method: 'DELETE', headers: SB.headers,
  });
  if (!digestRes.ok) logWarn(`[clear] Could not delete digests: ${digestRes.status}`);
  else logOk(`[clear] Deleted digests`);

  // 3. Delete all share_tokens (embedded payloads are now stale)
  const tokenUrl = `${SUPABASE_URL}/rest/v1/share_tokens?user_id=eq.${userId}`;
  const tokenRes = await fetchRetry('SB DELETE share_tokens', tokenUrl, {
    method: 'DELETE', headers: SB.headers,
  });
  if (!tokenRes.ok) logWarn(`[clear] Could not delete share_tokens: ${tokenRes.status}`);
  else logOk(`[clear] Deleted share_tokens`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TARGETED BACKFILL — single user + single platform
// Called by the HTTP trigger server when a user connects a platform via OAuth.
// If newAccountId is provided AND differs from stored account_id → clear stale
// data first, then backfill.
// ─────────────────────────────────────────────────────────────────────────────
async function runBackfillForUser(userId, platform, newAccountId = null) {
  log(`[trigger] Backfill start — user=${userId.slice(0, 8)} platform=${platform}`);

  let rows;
  try {
    rows = await SB.select('integrations', 'user_id,platform,access_token,refresh_token,account_id,currency', {
      user_id:  userId,
      platform: platform,
    });
  } catch (err) {
    logFail(`[trigger] Cannot fetch integration: ${err.message}`);
    return;
  }

  const integration = rows?.[0];
  if (!integration) {
    logWarn(`[trigger] No integration found for user=${userId.slice(0, 8)} platform=${platform}`);
    return;
  }

  // If the account changed, clear stale data before backfilling
  if (newAccountId && integration.account_id &&
      integration.account_id !== newAccountId) {
    await clearStaleData(userId, platform);
  }

  try {
    if (platform === 'stripe') {
      await backfillStripe(userId, integration.access_token);
    } else if (platform === 'ga4') {
      await backfillGA4(userId, integration);
    } else if (platform === 'meta') {
      await backfillMeta(userId, integration);
    } else if (platform === 'paypal') {
      await backfillPayPal(userId, integration);
    } else if (platform === 'paddle') {
      await backfillPaddle(userId, integration);
    } else if (platform === 'lemon-squeezy') {
      await backfillLemonSqueezy(userId, integration);
    } else if (platform === 'gumroad') {
      await backfillGumroad(userId, integration);
    } else if (platform === 'plausible') {
      await backfillPlausible(userId, integration);
    } else if (platform === 'mixpanel') {
      await backfillMixpanel(userId, integration);
    } else if (platform === 'amplitude') {
      await backfillAmplitude(userId, integration);
    } else if (platform === 'posthog') {
      await backfillPostHog(userId, integration);
    } else if (platform === 'fathom') {
      await backfillFathom(userId, integration);
    } else if (platform === 'google-ads') {
      await backfillGoogleAds(userId, integration);
    } else if (platform === 'tiktok-ads') {
      await backfillTikTokAds(userId, integration);
    } else if (platform === 'twitter-ads') {
      await backfillTwitterAds(userId, integration);
    } else if (platform === 'linkedin-ads') {
      await backfillLinkedInAds(userId, integration);
    } else if (platform === 'snapchat-ads') {
      await backfillSnapchatAds(userId, integration);
    } else if (platform === 'pinterest-ads') {
      await backfillPinterestAds(userId, integration);
    } else if (platform === 'mailchimp') {
      await backfillMailchimp(userId, integration);
    } else if (platform === 'klaviyo') {
      await backfillKlaviyo(userId, integration);
    } else if (platform === 'convertkit') {
      await backfillConvertKit(userId, integration);
    } else if (platform === 'activecampaign') {
      await backfillActiveCampaign(userId, integration);
    } else if (platform === 'brevo') {
      await backfillBrevo(userId, integration);
    } else if (platform === 'beehiiv') {
      await backfillBeehiiv(userId, integration);
    } else if (platform === 'shopify') {
      await backfillShopify(userId, integration);
    } else if (platform === 'woocommerce') {
      await backfillWooCommerce(userId, integration);
    } else if (platform === 'bigcommerce') {
      await backfillBigCommerce(userId, integration);
    } else if (platform === 'amazon-seller') {
      await backfillAmazonSeller(userId, integration);
    } else if (platform === 'etsy') {
      await backfillEtsy(userId, integration);
    } else if (platform === 'hubspot') {
      await backfillHubSpot(userId, integration);
    } else if (platform === 'salesforce') {
      await backfillSalesforce(userId, integration);
    } else if (platform === 'pipedrive') {
      await backfillPipedrive(userId, integration);
    } else if (platform === 'notion') {
      await backfillNotion(userId, integration);
    } else if (platform === 'intercom') {
      await backfillIntercom(userId, integration);
    } else if (platform === 'zendesk') {
      await backfillZendesk(userId, integration);
    } else if (platform === 'freshdesk') {
      await backfillFreshdesk(userId, integration);
    } else if (platform === 'segment') {
      await backfillSegment(userId, integration);
    } else if (platform === 'heap') {
      await backfillHeap(userId, integration);
    } else if (platform === 'fullstory') {
      await backfillFullStory(userId, integration);
    } else if (platform === 'hotjar') {
      await backfillHotjar(userId, integration);
    } else if (platform === 'instagram') {
      await backfillInstagram(userId, integration);
    } else if (platform === 'youtube') {
      await backfillYouTube(userId, integration);
    } else if (platform === 'twitter-organic') {
      await backfillTwitterOrganic(userId, integration);
    } else {
      logWarn(`[trigger] Unknown platform: ${platform}`);
      return;
    }
    logOk(`[trigger] Backfill complete — user=${userId.slice(0, 8)} platform=${platform}`);
  } catch (err) {
    logFail(`[trigger] Backfill failed — ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP TRIGGER SERVER
// Listens for POST /sync-trigger with Bearer SYNC_SECRET.
// Starts alongside daemon mode so the Next.js app can kick off backfills
// immediately after a user connects a platform via OAuth.
//
// Required env vars (add to .env on the upbid.dev server):
//   SYNC_SECRET    – shared secret, must match SYNC_SECRET in the Next.js app
//   TRIGGER_PORT   – port to listen on (default: 4242)
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'http';

const SYNC_SECRET   = g('SYNC_SECRET');
const TRIGGER_PORT  = parseInt(g('TRIGGER_PORT') || '4242', 10);
const HEARTBEAT_URL = g('HEARTBEAT_URL') || '';

/**
 * Ping an uptime heartbeat URL (e.g. BetterStack / UptimeRobot) after every
 * successful daily sync so you know the daemon is alive and healthy.
 * Set HEARTBEAT_URL in .env — leave blank to disable.
 */
async function pingHeartbeat() {
  if (!HEARTBEAT_URL) return;
  try {
    await fetch(HEARTBEAT_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000),
    });
    logOk('[heartbeat] ping sent');
  } catch (e) {
    logFail(`[heartbeat] ping failed: ${e.message}`);
  }
}

function startTriggerServer() {
  if (!SYNC_SECRET) {
    logWarn('[trigger] SYNC_SECRET not set — HTTP trigger server disabled');
    return;
  }

  const server = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Verify secret for all routes
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${SYNC_SECRET}`) {
      logWarn(`[trigger] Unauthorized request from ${req.socket.remoteAddress}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Parse body
    let body = '';
    try {
      for await (const chunk of req) body += chunk;
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad request' }));
      return;
    }

    // ── POST /sync-trigger ───────────────────────────────────────────────────
    if (req.url === '/sync-trigger') {
      let userId, platform, newAccountId;
      try {
        ({ userId, platform, newAccountId = null } = JSON.parse(body));
        if (!userId || !platform) throw new Error('Missing userId or platform');
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      log(`[trigger] Received — user=${userId.slice(0, 8)} platform=${platform}${newAccountId ? ' (account change)' : ''}`);
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Backfill queued' }));
      runBackfillForUser(userId, platform, newAccountId).catch(e =>
        logFail(`[trigger] Unhandled error in backfill: ${e.message}`)
      );
      return;
    }

    // ── POST /playbooks/generate ─────────────────────────────────────────────
    if (req.url === '/playbooks/generate') {
      let userId;
      try {
        ({ userId } = JSON.parse(body));
        if (!userId) throw new Error('Missing userId');
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      log(`[trigger] Playbook generation queued for user=${userId.slice(0, 8)}`);
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Playbook generation queued' }));
      generatePlaybooksForUser(userId).catch(e =>
        logFail(`[trigger] Unhandled error in playbook generation: ${e.message}`)
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(TRIGGER_PORT, () => {
    logOk(`[trigger] HTTP server listening on port ${TRIGGER_PORT}`);
  });

  server.on('error', (err) => {
    logFail(`[trigger] HTTP server error: ${err.message}`);
  });
}


if (backfillMode) {
  // Manual one-shot full backfill, then exit
  await runBackfill();

} else if (alertsOnly) {
  // Manual one-shot: alert check + anomaly alerts + goals check only, then exit
  await checkAlerts();
  await runAnomalyAlerts();
  await checkGoals();
  // Manual one-shot: digest send only, then exit
  await sendDailyDigests();
  await generateAllPlaybooks();

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
  log(`  • Anomaly detection:   after every daily sync`);
  log(`  • Goals & KPIs check:  after every daily sync`);
  log(`  • Digest send:         after every daily sync (sent to users on their chosen day)`);
  log(`  • AI Playbooks:        after every daily sync (cached in ai_playbooks_cache)`);
  log(`  • Trigger server:      port ${TRIGGER_PORT}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 0. Start the HTTP trigger server (fire-and-forget backfill on OAuth connect)
  startTriggerServer();

  // 1. Immediate first run (sync + alerts + anomalies + goals)
  // Note: sendDailyDigests and generateAllPlaybooks are intentionally NOT called
  // here — they run only at the scheduled daily time (02:00 UTC) to avoid
  // duplicate API calls on restarts.
  await runAutoBackfill();
  await runSync();
  await checkAlerts();
  await runAnomalyAlerts();
  await checkGoals();
  await pingHeartbeat();

  // 2. Auto-backfill loop — every 30 minutes
  setInterval(async () => {
    try { await runAutoBackfill(); } catch (e) { logFail(`[auto-backfill loop] ${e.message}`); }
  }, CHECK_INTERVAL_MS);

  // 3. Daily sync + alerts + anomalies + goals + digest + playbooks at 02:00 UTC
  scheduleDailyAt(DAILY_UTC_HOUR, async () => {
    await runSync();
    await checkAlerts();
    await runAnomalyAlerts();
    await checkGoals();
    await sendDailyDigests();
    await generateAllPlaybooks();
    await pingHeartbeat();
  }, 'daily-sync+alerts+anomalies+digest+playbooks');

  // 4. Weekly playbook emails — every Monday at 08:00 UTC
  scheduleDailyAt(8, async () => {
    const dayOfWeek = new Date().getUTCDay(); // 0=Sun, 1=Mon
    if (dayOfWeek !== 1) return; // only run on Mondays
    await sendWeeklyPlaybooksEmails();
  }, 'weekly-playbooks-email');

} else {
  // One-shot: sync yesterday + check alerts + anomalies + goals + digests + playbooks, then exit
  await runSync();
  await checkAlerts();
  await runAnomalyAlerts();
  await checkGoals();
  await sendDailyDigests();
  await generateAllPlaybooks();
}
