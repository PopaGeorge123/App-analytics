# Outbound Prospecting Setup Guide

## Quick Start

This guide will help you set up the automated outbound prospecting system that finds businesses, scrapes contact info, and sends personalized emails with tracking.

---

## 1. Database Setup

Run the migration to create the required tables:

```sql
-- Run this in Supabase SQL editor or via CLI
supabase/migrations/030_outbound_prospecting.sql
```

This creates:
- `outbound_prospects` - Stores all scraped businesses
- `outbound_email_events` - Tracks email opens, clicks, bounces
- Automatic triggers to update prospect status on events

---

## 2. Get API Keys

### Serper API (Google Search)
1. Go to https://serper.dev
2. Sign up for free account (100 searches/month free)
3. Copy your API key
4. Add to `.env`:
   ```
   SERPER_API_KEY=your_serper_api_key_here
   ```

### Resend API (Email Sending)
You should already have this configured. Verify in `.env`:
```
RESEND_API_KEY=re_your_key_here
```

---

## 3. Test the Script

### Dry Run (No Emails)
Test the scraping without sending any emails:

```bash
node scripts/outbound-prospecting.mjs "SaaS" --limit=5
```

This will:
- Search Google for 5 SaaS companies
- Scrape their websites
- Extract contact emails
- Save everything to database
- **NOT send any emails** (safe to test)

Expected output:
```
🔍 Starting outbound prospecting for: SaaS
   Limit: 5 websites
   Send emails: NO (dry run)

📡 Searching for SaaS websites...
   Found 10 potential websites

[1/5] example.com
  🌐 Scraping website...
  📧 Email: hello@example.com
  🏢 Business: Example Inc
  🔧 Integrations: stripe, google-analytics
  ✅ Saved to database
  ⏭️  Email skipped (dry run mode)

✅ Prospecting complete!
   Processed: 5 websites
   Saved to DB: 5 prospects
   Emails sent: 0

💡 Tip: Add --send-emails flag to actually send emails
```

---

## 4. Review Scraped Data

Check the database to see what was scraped:

```sql
select 
  business_name,
  domain,
  contact_email,
  category,
  detected_integrations,
  status
from outbound_prospects
order by created_at desc
limit 10;
```

---

## 5. Send Real Emails

Once you're happy with the scraped data, send emails:

```bash
node scripts/outbound-prospecting.mjs "SaaS" --limit=10 --send-emails
```

**⚠️ Important:**
- Start small (10-20 prospects max)
- Monitor open rates before scaling
- Personalize the email template for your use case
- Respect unsubscribe requests

---

## 6. Track Results

### Check Email Opens
```sql
select 
  p.business_name,
  p.contact_email,
  p.email_sent_at,
  p.email_opened_at,
  p.email_open_count,
  p.status
from outbound_prospects p
where p.email_sent_at is not null
order by p.email_open_count desc;
```

### Check All Events
```sql
select 
  p.business_name,
  e.event_type,
  e.created_at,
  e.user_agent
from outbound_email_events e
join outbound_prospects p on p.id = e.prospect_id
order by e.created_at desc
limit 20;
```

### Open Rate Stats
```sql
select 
  count(*) as total_sent,
  count(email_opened_at) as total_opened,
  round(count(email_opened_at)::numeric / count(*)::numeric * 100, 2) as open_rate_pct
from outbound_prospects
where email_sent_at is not null;
```

---

## 7. Customize Email Template

Edit the email in `scripts/outbound-prospecting.mjs` around line 350:

```javascript
const subject = `Quick question about ${prospect.business_name || prospect.domain}`;

const html = `
  <!-- Your custom HTML template -->
`;
```

**Tips for better open rates:**
- Personalize subject line with business name
- Keep it short and conversational
- Reference detected integrations
- Clear value proposition
- Strong CTA
- Professional signature

---

## 8. Categories to Target

Available categories:
- `SaaS` - Best for Fold (revenue tracking use case)
- `E-commerce` - Good fit (Shopify/WooCommerce tracking)
- `Agency` - Moderate fit (client reporting use case)
- `Media & Content` - Moderate fit (traffic/ad analytics)
- `Marketplace` - Good fit (transaction tracking)
- `Consumer App` - Moderate fit (user analytics)
- `Fintech` - Good fit (transaction/revenue tracking)
- `Healthcare` - Lower fit (compliance concerns)
- `Education` - Lower fit (different analytics needs)
- `Other` - Catch-all category

**Recommended starting categories for Fold:**
1. SaaS (highest fit)
2. E-commerce (high fit)
3. Marketplace (high fit)
4. Fintech (high fit)

---

## 9. Scaling Up

Once you've tested and optimized:

```bash
# Run larger batches
node scripts/outbound-prospecting.mjs "SaaS" --limit=50 --send-emails

# Target multiple categories
node scripts/outbound-prospecting.mjs "E-commerce" --limit=30 --send-emails
node scripts/outbound-prospecting.mjs "Marketplace" --limit=20 --send-emails
```

**Rate limits:**
- Serper free tier: 100 searches/month
- Resend: Check your plan limits
- Script delays: 1s between scrapes, 200ms between emails

---

## 10. Best Practices

### ✅ Do:
- Start with dry runs
- Review scraped data before sending
- Personalize emails for each category
- Monitor open/click rates
- Respect unsubscribes immediately
- Test subject lines and messaging

### ❌ Don't:
- Send to unqualified leads
- Use generic templates
- Ignore bounce/unsubscribe signals
- Send too many at once (start small)
- Spam the same domain multiple times

---

## Troubleshooting

### No search results found
- Check `SERPER_API_KEY` is valid
- Try different category or search query
- Verify internet connection

### Emails not sending
- Check `RESEND_API_KEY` is valid
- Verify `--send-emails` flag is included
- Check Resend dashboard for errors
- Verify email addresses are valid

### No emails found on websites
- Try different search queries (some sites hide emails)
- Check scraped HTML in database
- Consider adding contact form scraping

### Low open rates
- Improve subject line personalization
- Reference specific detected integrations
- Test different sending times
- Verify tracking pixel is loading

---

## Example Workflow

1. **Monday morning:** Run dry run for SaaS (--limit=20)
2. **Review data:** Check scraped emails and business names in DB
3. **Tuesday morning:** Send first batch (--limit=10 --send-emails)
4. **Wednesday:** Check open rates, adjust messaging
5. **Thursday:** Send second batch (--limit=20 --send-emails)
6. **Friday:** Analyze results, plan next week's categories

---

## Support

If you run into issues:
1. Check the logs for specific error messages
2. Verify all API keys are valid
3. Check database tables exist (run migration)
4. Review the code comments in `outbound-prospecting.mjs`

Happy prospecting! 🚀
