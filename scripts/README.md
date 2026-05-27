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

## Outbound Prospecting

### `outbound-prospecting.mjs`

Automated outbound prospecting system that searches for businesses, scrapes their websites for contact info, and sends personalized outreach emails with open/click tracking.

**Usage:**
```bash
node scripts/outbound-prospecting.mjs <category> [--limit=10] [--send-emails]
```

**Categories:**
- SaaS
- E-commerce
- Agency
- Media & Content
- Marketplace
- Consumer App
- Fintech
- Healthcare
- Education
- Other

**Examples:**
```bash
# Dry run: Find 20 SaaS companies (no emails sent)
node scripts/outbound-prospecting.mjs "SaaS" --limit=20

# Send emails to 10 E-commerce sites
node scripts/outbound-prospecting.mjs "E-commerce" --limit=10 --send-emails

# Find 50 agencies and send emails
node scripts/outbound-prospecting.mjs "Agency" --limit=50 --send-emails
```

**What it does:**
1. **Searches Google** for websites in the specified category using Serper.dev API
2. **Scrapes each website** to extract:
   - Business name, title, description
   - Contact email address
   - Detected integrations (Stripe, Shopify, GA4, etc.)
   - Tech stack indicators
3. **Saves to database** in the `outbound_prospects` table with metadata
4. **Sends personalized email** (if `--send-emails` flag is used):
   - Personalized with business name and detected tools
   - Professional HTML template matching Fold branding
   - Includes CTA button linking to demo
   - Embeds tracking pixel for open tracking
   - Trackable click links
5. **Tracks engagement** automatically via database triggers:
   - Email opens (via 1x1 pixel)
   - Link clicks (via redirect)
   - Unsubscribes

**Required environment variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (required for sending emails)
- `SERPER_API_KEY` (required for Google search - get free key at serper.dev)
- `NEXT_PUBLIC_APP_URL` (optional, defaults to https://usefold.io)

**Database tables:**
- `outbound_prospects` - Stores all scraped prospects with metadata
- `outbound_email_events` - Tracks all email engagement events (open, click, bounce, unsubscribe)

**Tracking:**
- Email opens tracked via: `/api/track/open/[prospectId]`
- Link clicks tracked via: `/api/track/click/[prospectId]`
- Unsubscribes handled via: `/api/unsubscribe/[prospectId]`
- All events automatically update prospect status in database

**Safety features:**
- Deduplication: Skips websites already in database
- Rate limiting: 1 second between website scrapes, 200ms between emails
- Dry run mode: Test without sending emails (default behavior)
- Email validation: Only sends if valid email found
- Unsubscribe link in every email
- Respects email bounce and unsubscribe events

**Best practices:**
1. Always run in dry run mode first to preview results
2. Start with small limits (10-20) to test
3. Monitor open rates and adjust messaging accordingly
4. Check `outbound_prospects` table to review scraped data before sending
5. Use category-specific messaging for better conversion

**Setup:**
1. Run migration: `supabase/migrations/030_outbound_prospecting.sql`
2. Get Serper API key: https://serper.dev (100 free searches/month)
3. Configure Resend for email sending
4. Run dry run to test: `node scripts/outbound-prospecting.mjs "SaaS" --limit=5`
5. Send real emails: Add `--send-emails` flag

---

## Other Scripts

### `backfill-*.mjs`
Various data backfill scripts for specific platforms or use cases.

### `check-*.mjs`
Database integrity and validation scripts.

### `send-*.mjs`
Email sending scripts for specific campaigns or notifications.
