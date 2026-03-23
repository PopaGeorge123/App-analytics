#!/usr/bin/env node
/**
 * Fold Analytics — Cron Sync Runner
 *
 * Calls /api/cron/sync one user at a time with delays to avoid
 * rate limiting from Stripe, Google Analytics, and Meta APIs.
 *
 * Usage:
 *   node scripts/cron-runner.mjs
 *   node scripts/cron-runner.mjs --interval 3600   # run every 3600s (1h)
 *   node scripts/cron-runner.mjs --once             # run once and exit
 *
 * Env vars needed (reads from .env automatically):
 *   CRON_SECRET, NEXT_PUBLIC_APP_URL (or APP_URL)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Load .env ────────────────────────────────────────────────────────────────
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

// ── Config ───────────────────────────────────────────────────────────────────
const APP_URL    = env['NEXT_PUBLIC_APP_URL'] || env['APP_URL'] || 'http://localhost:3000';
const SECRET     = env['CRON_SECRET'];
const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];

// Delay between processing each user (ms) — avoids hammering APIs
const DELAY_BETWEEN_USERS_MS = 4000; // 4 seconds

// Max retries on 429 / network errors
const MAX_RETRIES = 3;

// Default interval between full sync runs (seconds)
const args = process.argv.slice(2);
const onceMode = args.includes('--once');
const intervalIdx = args.indexOf('--interval');
const INTERVAL_SEC = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1]) : 3600; // 1 hour default

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function log(msg, ...rest) {
  console.log(`[${new Date().toISOString()}] ${msg}`, ...rest);
}

async function fetchWithRetry(url, options, attempt = 1) {
  try {
    const res = await fetch(url, options);

    if (res.status === 429) {
      // Rate limited — exponential backoff: 10s, 30s, 90s
      const waitMs = Math.pow(3, attempt) * 10_000;
      log(`⚠ Rate limited (429). Retry ${attempt}/${MAX_RETRIES} in ${waitMs / 1000}s…`);
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Rate limited after ${MAX_RETRIES} retries`);
      }
      await sleep(waitMs);
      return fetchWithRetry(url, options, attempt + 1);
    }

    return res;
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const waitMs = Math.pow(2, attempt) * 2000;
    log(`⚠ Network error. Retry ${attempt}/${MAX_RETRIES} in ${waitMs / 1000}s… (${err.message})`);
    await sleep(waitMs);
    return fetchWithRetry(url, options, attempt + 1);
  }
}

// ── Get all users with integrations directly from Supabase ──────────────────
async function getUsersWithIntegrations() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/integrations?select=user_id,platform`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      }
    }
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  const rows = await res.json();

  // Group by user
  const map = {};
  for (const row of rows) {
    if (!map[row.user_id]) map[row.user_id] = [];
    map[row.user_id].push(row.platform);
  }
  return map; // { userId: ['stripe', 'ga4', 'meta'] }
}

// ── Sync a single user via API ───────────────────────────────────────────────
async function syncUser(userId, platforms) {
  const res = await fetchWithRetry(
    `${APP_URL}/api/cron/sync-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SECRET}`,
      },
      body: JSON.stringify({ userId, platforms }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// ── Main sync loop ───────────────────────────────────────────────────────────
async function runSync() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('Starting sync run…');

  let users;
  try {
    users = await getUsersWithIntegrations();
  } catch (err) {
    log('✗ Failed to fetch users:', err.message);
    return;
  }

  const userIds = Object.keys(users);
  log(`Found ${userIds.length} user(s) with integrations`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const platforms = users[userId];

    log(`[${i + 1}/${userIds.length}] Syncing user ${userId.slice(0, 8)}… (${platforms.join(', ')})`);

    try {
      const result = await syncUser(userId, platforms);
      log(`  ✓ Done:`, JSON.stringify(result.results?.[userId] || result));
      successCount++;
    } catch (err) {
      log(`  ✗ Error: ${err.message}`);
      errorCount++;
    }

    // Delay before next user (skip delay after last user)
    if (i < userIds.length - 1) {
      log(`  ⏳ Waiting ${DELAY_BETWEEN_USERS_MS / 1000}s before next user…`);
      await sleep(DELAY_BETWEEN_USERS_MS);
    }
  }

  log(`Sync complete. ✓ ${successCount} succeeded, ✗ ${errorCount} failed`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ── Entry point ──────────────────────────────────────────────────────────────
if (!SECRET || SECRET === 'your-random-cron-secret-here') {
  console.error('✗ CRON_SECRET not set in .env! Please set a strong random value.');
  process.exit(1);
}

if (onceMode) {
  log('Mode: run once');
  await runSync();
} else {
  log(`Mode: repeat every ${INTERVAL_SEC}s`);
  // Run immediately, then repeat
  while (true) {
    await runSync();
    log(`Next run in ${INTERVAL_SEC}s…`);
    await sleep(INTERVAL_SEC * 1000);
  }
}
