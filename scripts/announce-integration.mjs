#!/usr/bin/env node
/**
 * Fold Analytics — Integration Launch Announcement Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends emails to all users on the waitlist when a "coming soon" integration
 * goes live. Marks each user as "announced" so they don't get duplicate emails.
 *
 * Usage:
 *   node scripts/announce-integration.mjs <integration-id>
 *
 * Example:
 *   node scripts/announce-integration.mjs notion
 *   node scripts/announce-integration.mjs convertkit
 *
 * Required .env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Load .env (same pattern as sync-all.mjs)
// ─────────────────────────────────────────────────────────────────────────────
const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const env = {};
try {
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  console.log(`[env] Loaded ${Object.keys(env).length} vars from ${ENV_PATH}`);
} catch (e) {
  console.warn(`[env] Could not read .env — falling back to process.env (${e.message})`);
}

const g = (k) => env[k] ?? process.env[k] ?? '';

const SUPABASE_URL = g('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY  = g('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_KEY   = g('RESEND_API_KEY');
const APP_URL      = g('NEXT_PUBLIC_APP_URL') || 'https://usefold.io';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env');
  process.exit(1);
}

if (!RESEND_KEY) {
  console.error('✗ RESEND_API_KEY required in .env');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Args
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log(`
Usage: node scripts/announce-integration.mjs <integration-id>

Example:
  node scripts/announce-integration.mjs notion
  node scripts/announce-integration.mjs convertkit

This will:
  1. Find all users on the waitlist for the specified integration
  2. Send each user a personalized launch announcement email
  3. Mark each user as "announced" to prevent duplicate emails
  `);
  process.exit(args.includes('--help') ? 0 : 1);
}

const integrationId = args[0];

// ─────────────────────────────────────────────────────────────────────────────
// Integration Display Names
// ─────────────────────────────────────────────────────────────────────────────
const INTEGRATION_NAMES = {
  'notion': 'Notion',
  'intercom': 'Intercom',
  'zendesk': 'Zendesk',
  'freshdesk': 'Freshdesk',
  'segment': 'Segment',
  'heap': 'Heap',
  'fullstory': 'FullStory',
  'hotjar': 'Hotjar',
  'instagram': 'Instagram',
  'youtube': 'YouTube',
  'twitter-organic': 'Twitter',
  'convertkit': 'Kit (ConvertKit)',
  'activecampaign': 'ActiveCampaign',
  'brevo': 'Brevo',
  'beehiiv': 'Beehiiv',
  'shopify': 'Shopify',
  'woocommerce': 'WooCommerce',
  'bigcommerce': 'BigCommerce',
  'amazon-seller': 'Amazon Seller',
  'etsy': 'Etsy',
  'hubspot': 'HubSpot',
  'salesforce': 'Salesforce',
  'pipedrive': 'Pipedrive',
};

const integrationName = INTEGRATION_NAMES[integrationId] || integrationId;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
const ts   = () => new Date().toISOString();
const log  = (m) => console.log(`[${ts()}] ${m}`);
const logOk   = (m) => console.log(`[${ts()}]   ✓ ${m}`);
const logWarn = (m) => console.log(`[${ts()}]   ⚠ ${m}`);
const logFail = (m) => console.log(`[${ts()}]   ✗ ${m}`);

// ─────────────────────────────────────────────────────────────────────────────
// Supabase REST helpers
// ─────────────────────────────────────────────────────────────────────────────
const SB = {
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },

  async select(table, cols = '*', filters = {}) {
    const p = new URLSearchParams({ select: cols });
    for (const [k, v] of Object.entries(filters)) {
      p.append(k, `eq.${v}`);
    }
    const getHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${p}`, { headers: getHeaders });
    if (!r.ok) throw new Error(`SB SELECT ${table}: ${r.status}`);
    return r.json();
  },

  async patch(table, data, filters = {}) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      p.append(k, `eq.${v}`);
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${p}`, {
      method: 'PATCH',
      headers: { ...SB.headers, Prefer: 'return=minimal' },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const b = await r.text().catch(() => '');
      throw new Error(`SB PATCH ${table}: ${r.status} ${b}`);
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Email Template
// ─────────────────────────────────────────────────────────────────────────────
function buildAnnouncementEmailHtml(integrationName, firstName) {
  const name = firstName || 'there';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${integrationName} is now live on Fold</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg, #00d4aa 0%, #00bfa0 100%);padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
        🎉 ${integrationName} is Live!
      </h1>
    </div>

    <!-- Body -->
    <div style="padding:32px 24px;color:#1a1a2e;">
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
        Hey ${name},
      </p>
      
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
        Great news — <strong>${integrationName}</strong> is now available on Fold! You asked for it, and we built it.
      </p>

      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
        You can connect ${integrationName} right now from your dashboard and start seeing your data alongside all your other metrics.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${APP_URL}/dashboard?tab=data-sources" 
           style="display:inline-block;background:#00d4aa;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;letter-spacing:0.3px;">
          Connect ${integrationName} Now
        </a>
      </div>

      <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#4a4a6a;">
        As always, we only read the data you authorize — nothing is ever written to your ${integrationName} account, and your data is never shared with anyone.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:24px;background:#f5f5f8;border-top:1px solid #e0e0e8;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;color:#6a6a90;">
        <strong>Fold Analytics</strong> · Revenue, traffic and growth in one place
      </p>
      <p style="margin:0;font-size:12px;color:#8a8aa0;">
        <a href="${APP_URL}" style="color:#00d4aa;text-decoration:none;">usefold.io</a>
        · 
        <a href="${APP_URL}/dashboard?tab=data-sources" style="color:#8a8aa0;text-decoration:none;">Data Sources</a>
      </p>
    </div>

  </div>

  <!-- Unsubscribe -->
  <div style="max-width:600px;margin:16px auto;text-align:center;">
    <p style="margin:0;font-size:11px;color:#8a8aa0;">
      You're receiving this because you requested to be notified when ${integrationName} launched.
    </p>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Script
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting launch announcement for integration: ${integrationId}`);

  // 1. Fetch all users on waitlist who haven't been announced yet
  let waitlistUsers;
  try {
    const params = new URLSearchParams({
      select: 'id,user_id,email,integration_id',
      integration_id: `eq.${integrationId}`,
      announced: 'eq.false',
    });
    const getHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/integration_waitlist?${params}`, { headers: getHeaders });
    if (!res.ok) throw new Error(`Query failed: ${res.status}`);
    waitlistUsers = await res.json();
  } catch (err) {
    logFail(`Failed to fetch waitlist: ${err.message}`);
    process.exit(1);
  }

  if (waitlistUsers.length === 0) {
    log(`No users on the waitlist for "${integrationId}" (or all already announced)`);
    process.exit(0);
  }

  log(`Found ${waitlistUsers.length} user(s) to notify`);

  // 2. Fetch user profiles to get first names
  const userIds = [...new Set(waitlistUsers.map(u => u.user_id).filter(Boolean))];
  let userProfiles = {};
  if (userIds.length > 0) {
    try {
      const profiles = await SB.select('users', 'id,first_name', {});
      userProfiles = Object.fromEntries(
        profiles.filter(p => userIds.includes(p.id)).map(p => [p.id, p.first_name])
      );
    } catch (err) {
      logWarn(`Could not fetch user profiles: ${err.message}`);
    }
  }

  // 3. Send emails
  let sent = 0, failed = 0;

  for (const entry of waitlistUsers) {
    const { id, user_id, email, integration_id } = entry;
    const firstName = user_id ? userProfiles[user_id] : null;

    try {
      const emailHtml = buildAnnouncementEmailHtml(integrationName, firstName);

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Fold <info@usefold.io>',
          to: email,
          subject: `${integrationName} is now live on Fold 🎉`,
          html: emailHtml,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        logWarn(`Email failed for ${email}: ${errBody?.message ?? res.status}`);
        failed++;
        continue;
      }

      logOk(`Sent to ${email}`);
      sent++;

      // Mark as announced
      try {
        await SB.patch('integration_waitlist', { announced: true }, { id });
      } catch (patchErr) {
        logWarn(`Failed to mark ${id} as announced: ${patchErr.message}`);
      }

      // Rate limit: wait 100ms between emails
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      logFail(`Error processing ${email}: ${err.message}`);
      failed++;
    }
  }

  log(`Done! Sent: ${sent}, Failed: ${failed}`);
}

main().catch(err => {
  logFail(`Fatal error: ${err.message}`);
  process.exit(1);
});
