#!/usr/bin/env node

/**
 * Initialize Email Templates
 * Creates the email templates table and inserts 10 templates
 * 
 * NOTE: Run the SQL migration manually in Supabase Dashboard first:
 * supabase/migrations/033_email_templates_tracking.sql
 * 
 * This script just inserts the 10 email templates.
 */

import https from 'https';
import { URL } from 'url';
import fs from 'fs';

// Load environment variables
const envPath = new URL('../.env', import.meta.url).pathname;
const envContent = fs.readFileSync(envPath, 'utf-8');
const ENV = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) ENV[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

console.log('🚀 Initializing email templates...\n');

// Email templates data
const templates = [
  {
    template_name: 'Direct Question',
    template_number: 1,
    subject_line: 'Quick question about {business_name}',
    body_template: `Hey {first_name},

I came across {business_name} and wanted to reach out.

Quick question: how are you currently tracking your business metrics?

Most founders I talk to are either juggling 5+ dashboards or stuck in spreadsheets. We built Fold to fix that - one dashboard, all your data, $19/mo.

Worth a look: {tracking_link}

Best,
George
Fold Analytics`
  },
  {
    template_name: 'Problem Agitate',
    template_number: 2,
    subject_line: 'Are you tired of switching between dashboards?',
    body_template: `Hi {first_name},

Noticed {business_name} - looks solid.

Real talk: Are you still logging into Stripe, GA4, and Meta separately to see your numbers?

That was driving me crazy too. That's why I built Fold.

Connect everything in 90 seconds. See it all in one place. $19/mo.

Demo: {tracking_link}

- George`
  },
  {
    template_name: 'Founder to Founder',
    template_number: 3,
    subject_line: '{first_name}, fellow founder here',
    body_template: `Hey {first_name},

Fellow founder here. Saw {business_name} and thought I'd reach out.

I built Fold because I was frustrated with expensive, bloated analytics tools. 

Simple idea: Connect Stripe + GA4 + Meta. Get one clean dashboard. $19/mo instead of $500+/mo.

Take a look: {tracking_link}

Would love your feedback.

George
usefold.io`
  },
  {
    template_name: 'Social Proof',
    template_number: 4,
    subject_line: '100+ founders switched to this',
    body_template: `{first_name},

100+ small business owners just switched from their old analytics setup to Fold.

Why? Because they were tired of:
- Paying $200+/mo for tools built for enterprises
- Switching between 5 different dashboards
- Missing important trends in their data

Fold: One dashboard. All your metrics. $19/mo.

See demo: {tracking_link}

George`
  },
  {
    template_name: 'Time Saver',
    template_number: 5,
    subject_line: 'Save 10 hours/month on analytics',
    body_template: `Hi {first_name},

{business_name} caught my attention.

Quick stat: Our users save 10+ hours per month by having all their analytics in one place instead of jumping between Stripe, GA4, Meta, etc.

10 hours = $500+ in your time.
Fold = $19/mo.

Check it out: {tracking_link}

George
Fold Analytics`
  },
  {
    template_name: 'Curiosity Hook',
    template_number: 6,
    subject_line: 'This might interest you',
    body_template: `{first_name},

Running {business_name}, you probably track revenue, traffic, conversions etc.

Question: How long does it take you to get all those numbers each morning?

With Fold, it's one click. Everything connected. AI highlights what matters.

See how it works: {tracking_link}

Best,
George`
  },
  {
    template_name: 'Pain Point Direct',
    template_number: 7,
    subject_line: 'Still using spreadsheets for analytics?',
    body_template: `Hey {first_name},

Saw {business_name} and had to ask: are you still using spreadsheets to track your metrics?

No judgment - I did that for 2 years. Then I built Fold.

All your data sources → One dashboard → AI insights
$19/mo, setup in 90 seconds.

Demo: {tracking_link}

George`
  },
  {
    template_name: 'ROI Focus',
    template_number: 8,
    subject_line: 'Cut your analytics costs by 90%',
    body_template: `{first_name},

If you're using Mixpanel, Amplitude, or similar tools, you're probably paying $200-500/mo.

Fold does the same thing for $19/mo.

Same insights. Better interface. Built for small businesses, not enterprises.

See the difference: {tracking_link}

George
Fold Analytics`
  },
  {
    template_name: 'Feature Highlight',
    template_number: 9,
    subject_line: 'One dashboard for everything',
    body_template: `Hi {first_name},

{business_name} looks great.

Quick pitch: Fold connects all your tools (Stripe, GA4, Meta Ads, etc.) and shows everything in one beautiful dashboard.

No more tab switching. No more spreadsheets. Just insights.

$19/mo. 90-second setup.

Try it: {tracking_link}

Best,
George`
  },
  {
    template_name: 'No Pressure',
    template_number: 10,
    subject_line: 'Built something that might help',
    body_template: `{first_name},

I built an analytics dashboard for small businesses and thought it might be useful for {business_name}.

No sales pitch. Just wanted to share:

{tracking_link}

It's $19/mo, connects all your tools in one place, and has AI insights.

Happy to answer questions if you have any.

George`
  }
];

// Helper function to make HTTP requests
function fetchRetry(name, url, opts = {}, retries = 3) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
      timeout: opts.timeout || 30000,
    };
    
    if (opts.body) {
      options.headers['Content-Length'] = Buffer.byteLength(opts.body);
    }

    const attempt = (retriesLeft) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(opts.json !== false ? JSON.parse(data) : data);
            } catch (err) {
              resolve(data);
            }
          } else if (retriesLeft > 0 && res.statusCode >= 500) {
            console.log(`⚠️  ${name} failed (${res.statusCode}), retrying... (${retriesLeft} left)`);
            setTimeout(() => attempt(retriesLeft - 1), 1000);
          } else {
            reject(new Error(`${name} failed: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        if (retriesLeft > 0) {
          console.log(`⚠️  ${name} errored, retrying... (${retriesLeft} left)`);
          setTimeout(() => attempt(retriesLeft - 1), 1000);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (retriesLeft > 0) {
          console.log(`⚠️  ${name} timed out, retrying... (${retriesLeft} left)`);
          setTimeout(() => attempt(retriesLeft - 1), 1000);
        } else {
          reject(new Error(`${name} timed out`));
        }
      });

      if (opts.body) req.write(opts.body);
      req.end();
    };

    attempt(retries);
  });
}

// Insert templates
async function insertTemplates() {
  let inserted = 0;
  let skipped = 0;

  for (const template of templates) {
    try {
      const body = JSON.stringify(template);
      
      await fetchRetry(
        `Insert Template #${template.template_number}`,
        `${SUPABASE_URL}/rest/v1/outbound_email_templates`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body,
        }
      );

      console.log(`✅ #${template.template_number}: ${template.template_name}`);
      inserted++;
    } catch (err) {
      if (err.message.includes('duplicate') || err.message.includes('409')) {
        console.log(`⏭️  #${template.template_number}: ${template.template_name} (already exists)`);
        skipped++;
      } else {
        console.error(`❌ #${template.template_number}: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Done! Inserted: ${inserted} | Skipped: ${skipped}\n`);
}

insertTemplates().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
