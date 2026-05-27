# Scripts Directory

This directory contains one-off administrative and maintenance scripts for Fold Analytics.

## Integration Launch Announcements

### `announce-integration.mjs`

Sends email notifications to all users on the waitlist when a "coming soon" integration goes live.

**Usage:**
```bash
node scripts/announce-integration.mjs <integration-id>
```

**Examples:**
```bash
# Announce Notion integration
node scripts/announce-integration.mjs notion

# Announce ConvertKit integration
node scripts/announce-integration.mjs convertkit

# Announce Freshdesk integration
node scripts/announce-integration.mjs freshdesk
```

**What it does:**
1. Queries the `integration_waitlist` table for all users who requested the specified integration
2. Filters out users who have already been notified (`announced = false`)
3. Sends each user a personalized launch announcement email via Resend
4. Marks each user as `announced = true` to prevent duplicate emails

**Required environment variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL` (optional, defaults to https://usefold.io)

**Email content:**
- Personalized with user's first name (if available)
- Branded HTML template with gradient header
- CTA button linking to dashboard settings
- Privacy reassurance
- Professional footer

**Safety features:**
- Deduplication via `announced` flag prevents sending duplicate emails
- Rate limiting: 100ms delay between emails to respect Resend API limits
- Detailed logging of success/failure for each email
- Graceful error handling for individual failures

**When to use:**
Run this script immediately after you:
1. Move an integration from `status: "coming-soon"` to `status: "live"` in `lib/integrations/catalog.ts`
2. Deploy the updated integration to production
3. Verify the integration is working correctly

---

## Other Scripts

### `backfill-*.mjs`
Various data backfill scripts for specific platforms or use cases.

### `check-*.mjs`
Database integrity and validation scripts.

### `send-*.mjs`
Email sending scripts for specific campaigns or notifications.
