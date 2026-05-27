# Outbound Prospecting System - Complete Overview

## 🎯 What It Does

Automated B2B outbound prospecting system that:
1. **Searches** Google for businesses in specific categories (SaaS, E-commerce, etc.)
2. **Scrapes** their websites to extract contact emails and business info
3. **Detects** tech stack and integrations (Stripe, Shopify, GA4, etc.)
4. **Sends** personalized outreach emails with your value proposition
5. **Tracks** email opens, clicks, and conversions automatically
6. **Stores** everything in database for analysis and follow-up

---

## 📁 Files Created

### Database
- **`supabase/migrations/030_outbound_prospecting.sql`**
  - Creates `outbound_prospects` table (stores all scraped businesses)
  - Creates `outbound_email_events` table (tracks opens, clicks, bounces)
  - Sets up RLS policies and automatic status update triggers
  - PostgreSQL functions for event handling

### Main Script
- **`scripts/outbound-prospecting.mjs`** (600+ lines)
  - Google Search integration via Serper.dev API
  - Website scraping and email extraction
  - Integration detection (Stripe, Shopify, GA4, etc.)
  - Email sending via Resend with personalized templates
  - Tracking pixel and click link embedding
  - Rate limiting and error handling
  - Deduplication and safety features

### API Routes
- **`app/api/track/open/[prospectId]/route.ts`**
  - Tracks email opens via 1x1 transparent GIF pixel
  - Logs user agent and IP address
  - Updates prospect status automatically

- **`app/api/track/click/[prospectId]/route.ts`**
  - Tracks CTA button clicks
  - Redirects to signup/demo page
  - Logs engagement event

- **`app/api/unsubscribe/[prospectId]/route.ts`**
  - Handles unsubscribe requests
  - Shows confirmation page
  - Marks prospect as unsubscribed

- **`app/api/admin/prospects/route.ts`**
  - Admin API to fetch prospects with filters
  - Returns stats: total, sent, opened, clicked, converted
  - Calculates open rate, click rate, conversion rate

- **`app/api/admin/prospects/[prospectId]/route.ts`**
  - Admin API to update prospect status manually
  - Useful for marking conversions or adding notes

### Documentation
- **`scripts/README.md`** (updated)
  - Complete usage guide for the prospecting script
  - Examples for all categories
  - Safety features and best practices

- **`scripts/PROSPECTING_SETUP.md`** (350+ lines)
  - Step-by-step setup guide
  - API key configuration
  - Testing workflow
  - Scaling strategies
  - Troubleshooting

- **`scripts/PROSPECTING_QUERIES.sql`**
  - 20+ ready-to-use SQL queries
  - Performance analytics
  - Follow-up lists
  - Export queries
  - Maintenance scripts

---

## 🚀 Quick Start

### 1. Setup (One Time)
```bash
# Run database migration
# (Execute in Supabase SQL Editor)
supabase/migrations/030_outbound_prospecting.sql

# Get Serper API key (free tier: 100 searches/month)
# https://serper.dev
# Add to .env:
SERPER_API_KEY=your_key_here

# Verify Resend is configured
# RESEND_API_KEY should already be in .env
```

### 2. Test (Dry Run)
```bash
# Find 5 SaaS companies, scrape emails, NO sending
node scripts/outbound-prospecting.mjs "SaaS" --limit=5
```

### 3. Review Data
```sql
-- Check what was scraped
select business_name, domain, contact_email, detected_integrations, status
from outbound_prospects
order by created_at desc
limit 10;
```

### 4. Send Emails
```bash
# Send to first 10 prospects
node scripts/outbound-prospecting.mjs "SaaS" --limit=10 --send-emails
```

### 5. Track Results
```sql
-- Check open rate
select 
  count(*) as sent,
  count(email_opened_at) as opened,
  round(count(email_opened_at)::numeric / count(*) * 100, 2) as open_rate
from outbound_prospects
where email_sent_at is not null;
```

---

## 📊 Categories Available

| Category | Fit for Fold | Notes |
|----------|-------------|-------|
| **SaaS** | ⭐⭐⭐⭐⭐ | Best fit - revenue tracking, MRR, churn |
| **E-commerce** | ⭐⭐⭐⭐⭐ | High fit - Shopify/WooCommerce analytics |
| **Marketplace** | ⭐⭐⭐⭐ | Good fit - transaction tracking |
| **Fintech** | ⭐⭐⭐⭐ | Good fit - revenue/transaction analytics |
| **Agency** | ⭐⭐⭐ | Moderate - client reporting use case |
| **Media & Content** | ⭐⭐⭐ | Moderate - traffic/ad analytics |
| **Consumer App** | ⭐⭐⭐ | Moderate - user analytics |
| **Healthcare** | ⭐⭐ | Lower - compliance concerns |
| **Education** | ⭐⭐ | Lower - different analytics needs |
| **Other** | ⭐ | Catch-all |

**Recommended starting order:**
1. SaaS
2. E-commerce
3. Marketplace
4. Fintech

---

## 🎯 Email Template Features

The default email template includes:

✅ **Personalization:**
- Uses recipient's first name
- References their business name
- Mentions detected integrations (Stripe, Shopify, etc.)
- Category-specific messaging

✅ **Professional Design:**
- Fold branding with gradient header
- Clean, readable HTML layout
- Mobile-responsive
- Branded colors and typography

✅ **Tracking:**
- 1x1 pixel for open tracking
- Trackable CTA button
- Click-through tracking
- Unsubscribe link

✅ **Value Proposition:**
- Clear problem statement (scattered data)
- Solution explanation (unified dashboard + AI)
- Strong CTA (See demo)
- Low friction (2-minute setup)

---

## 📈 Expected Results

Based on typical B2B cold email benchmarks:

| Metric | Industry Average | Target for Fold |
|--------|-----------------|----------------|
| **Open Rate** | 15-25% | 20-30% (personalized) |
| **Click Rate** | 2-5% | 5-8% (strong CTA) |
| **Reply Rate** | 1-3% | 2-4% (relevant audience) |
| **Conversion** | 0.5-1% | 1-2% (high-fit leads) |

**Example: 100 emails sent**
- 25 opens (25%)
- 6 clicks (6%)
- 3 replies (3%)
- 1-2 signups (1-2%)

---

## 🔒 Safety Features

### Built-in Protections:
- ✅ **Deduplication** - Won't scrape same domain twice
- ✅ **Rate limiting** - 1s between scrapes, 200ms between emails
- ✅ **Dry run mode** - Test without sending (default)
- ✅ **Email validation** - Only sends if valid email found
- ✅ **Unsubscribe** - Automatic handling and status update
- ✅ **Bounce handling** - Tracks and respects bounce events
- ✅ **Error recovery** - Continues on individual failures

### Best Practices:
- Start with small batches (10-20)
- Monitor open rates before scaling
- Respect unsubscribe requests immediately
- Don't spam same domain multiple times
- Personalize for each category

---

## 🛠️ Customization

### Email Template
Edit `scripts/outbound-prospecting.mjs` around line 350:
- Change subject line
- Modify HTML template
- Adjust value proposition
- Update CTA text/link
- Add your signature

### Search Queries
Edit `scripts/outbound-prospecting.mjs` around line 250:
- Modify search query format
- Add exclusions (-wikipedia -linkedin)
- Target specific regions
- Include/exclude keywords

### Detected Integrations
Edit `DETECTION_PATTERNS` around line 200:
- Add new integrations to detect
- Modify detection patterns
- Change confidence scoring

---

## 📊 Analytics Queries

All ready-to-use queries in `scripts/PROSPECTING_QUERIES.sql`:

**Overview:**
- Campaign performance summary
- Stats by category
- Open/click/conversion rates

**Engagement:**
- Most engaged prospects
- Recent activity
- High-value leads

**Follow-up:**
- Opened but didn't click
- Sent but never opened
- Clicked but not converted

**Quality:**
- Prospects with integrations
- Bounced/unsubscribed
- Conversions

---

## 🔄 Workflow Example

### Week 1: Testing
```bash
# Monday: Dry run
node scripts/outbound-prospecting.mjs "SaaS" --limit=20

# Tuesday: Review + send first batch
node scripts/outbound-prospecting.mjs "SaaS" --limit=10 --send-emails

# Wednesday: Check open rates
# (Use SQL queries from PROSPECTING_QUERIES.sql)

# Thursday: Send second batch
node scripts/outbound-prospecting.mjs "SaaS" --limit=20 --send-emails

# Friday: Analyze results, plan week 2
```

### Week 2: Scaling
```bash
# Target multiple categories
node scripts/outbound-prospecting.mjs "E-commerce" --limit=30 --send-emails
node scripts/outbound-prospecting.mjs "Marketplace" --limit=20 --send-emails

# Follow up with engaged prospects manually
```

---

## 🚨 Important Notes

### API Limits:
- **Serper** (free): 100 searches/month
- **Resend**: Check your plan limits
- Consider upgrading if scaling beyond 100 prospects/month

### Legal Compliance:
- ✅ Unsubscribe link in every email
- ✅ Respect unsubscribe requests
- ✅ Only B2B outreach (not B2C)
- ✅ Clear sender identity
- ⚠️ Check GDPR/CAN-SPAM compliance for your region

### Email Deliverability:
- Use authenticated domain for sending (george@usefold.io)
- Don't send too many too fast (rate limiting built-in)
- Monitor bounce rates
- Keep email copy conversational, not salesy

---

## 📞 Support

If issues arise:

1. **Check logs** - Script outputs detailed logs
2. **Verify API keys** - All keys in `.env` file
3. **Run dry run** - Test without sending
4. **Check database** - Use queries from PROSPECTING_QUERIES.sql
5. **Review docs** - PROSPECTING_SETUP.md has troubleshooting

---

## ✅ Checklist

Before your first campaign:

- [ ] Migration 030 executed in Supabase
- [ ] SERPER_API_KEY added to .env
- [ ] RESEND_API_KEY verified in .env
- [ ] Dry run completed successfully
- [ ] Scraped data reviewed in database
- [ ] Email template customized (optional)
- [ ] First batch sent (10-20 emails)
- [ ] Tracking verified (check open events)
- [ ] SQL queries tested for analytics

---

## 🎉 You're Ready!

The outbound prospecting system is fully functional and ready to use. Start with a small dry run, review the results, and scale up gradually.

**Next steps:**
1. Read `PROSPECTING_SETUP.md` for detailed setup
2. Run your first dry run: `node scripts/outbound-prospecting.mjs "SaaS" --limit=5`
3. Check database with queries from `PROSPECTING_QUERIES.sql`
4. Send first real batch with `--send-emails` flag
5. Monitor results and iterate on messaging

Happy prospecting! 🚀
