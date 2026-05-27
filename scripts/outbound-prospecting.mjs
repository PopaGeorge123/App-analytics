#!/usr/bin/env node

/**
 * Outbound Prospecting Script
 * 
 * Searches for websites in specific business categories, scrapes them for contact info,
 * and sends personalized outreach emails with open tracking.
 * 
 * Usage:
 *   node scripts/outbound-prospecting.mjs <category> [--prospects=10] [--send-emails]
 * 
 * Examples:
 *   node scripts/outbound-prospecting.mjs "SaaS" --prospects=20 --send-emails
 *   node scripts/outbound-prospecting.mjs "E-commerce" --prospects=10
 */

import https from 'https';
import { URL } from 'url';
import fs from 'fs';

// ============================================================================
// Configuration
// ============================================================================

const CATEGORIES = [
  'SaaS', 'E-commerce', 'Agency', 'Media & Content', 'Marketplace',
  'Consumer App', 'Fintech', 'Healthcare', 'Education', 'Other'
];

// Load environment variables from .env file
const envPath = new URL('../.env', import.meta.url).pathname;
const envContent = fs.readFileSync(envPath, 'utf-8');
const ENV = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) ENV[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = ENV.RESEND_API_KEY || '';
const APP_URL = 'https://usefold.io';
const SERPER_API_KEY = ENV.SERPER_API_KEY || ''; // Google Search API alternative (serper.dev)

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

if (!RESEND_API_KEY) {
  console.error('⚠️  Warning: RESEND_API_KEY not found - emails will not be sent');
}

if (!SERPER_API_KEY) {
  console.error('⚠️  Warning: SERPER_API_KEY not found - using fallback search method');
}

// ============================================================================
// HTTP Utilities
// ============================================================================

function fetchRetry(name, url, opts = {}, retries = 3) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
      timeout: opts.timeout || 10000,
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

function getHeaders() {
  return {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

// Supabase client wrapper
const SB = {
  async insert(table, data) {
    const body = JSON.stringify(data);
    return fetchRetry(`SB INSERT ${table}`, `${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: getHeaders(),
      body,
    });
  },
  
  async select(table, params = {}) {
    const queryParams = new URLSearchParams();
    if (params.eq) {
      for (const [key, val] of Object.entries(params.eq)) {
        queryParams.append(key, `eq.${val}`);
      }
    }
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.order) queryParams.append('order', params.order);
    
    const url = `${SUPABASE_URL}/rest/v1/${table}?${queryParams}`;
    return fetchRetry(`SB SELECT ${table}`, url, { headers: getHeaders() });
  },
  
  async update(table, data, where) {
    const queryParams = new URLSearchParams();
    for (const [key, val] of Object.entries(where)) {
      queryParams.append(key, `eq.${val}`);
    }
    
    const body = JSON.stringify(data);
    const url = `${SUPABASE_URL}/rest/v1/${table}?${queryParams}`;
    return fetchRetry(`SB UPDATE ${table}`, url, {
      method: 'PATCH',
      headers: getHeaders(),
      body,
    });
  },
};

// ============================================================================
// Google Search via Serper.dev API
// ============================================================================

async function searchGoogle(query, limit = 10) {
  if (!SERPER_API_KEY) {
    console.log('⚠️  No SERPER_API_KEY - skipping search');
    return [];
  }
  
  console.log(`   Using Serper API with query: "${query}"`);
  
  try {
    const body = JSON.stringify({
      q: query,
      num: limit,
      gl: 'us',
      hl: 'en',
    });
    
    const result = await fetchRetry('Serper Search', 'https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body,
    });
    
    console.log(`   Serper returned ${result.organic?.length || 0} results`);
    
    return (result.organic || []).map(item => ({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
    }));
  } catch (err) {
    console.error('❌ Search failed:', err.message);
    console.error('   Full error:', err);
    return [];
  }
}

// ============================================================================
// Website Scraping
// ============================================================================

function normalizeDomain(urlStr) {
  try {
    const u = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return urlStr.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
  }
}

async function scrapeWebsite(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    
    const html = await fetchRetry('Scrape Website', url, {
      json: false,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FoldAnalyticsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    clearTimeout(timer);
    
    // Extract metadata
    const title = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim() || '';
    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i)?.[1]?.trim() ||
      '';
    
    // Extract contact email
    const email = extractContactEmail(html);
    
    // Extract business name (from title, og:site_name, or domain)
    const businessName = 
      html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1]?.trim() ||
      title.split(/[|\-–—]/)[0].trim() ||
      '';
    
    // Detect integrations
    const detectedIntegrations = detectIntegrations(html);
    
    return {
      title,
      description,
      email,
      businessName,
      detectedIntegrations,
      html,
    };
  } catch (err) {
    console.error(`  ❌ Failed to scrape: ${err.message}`);
    return null;
  }
}

function extractContactEmail(html) {
  const skipPrefixes = /^(noreply|no-reply|donotreply|support|help|info|hello|contact|admin|sales|team|billing|abuse|postmaster|webmaster|newsletter|unsubscribe|legal|privacy|press|media|jobs|careers|hr)/i;

  // 1. mailto: links first
  const mailtoMatches = [...html.matchAll(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi)];
  for (const m of mailtoMatches) {
    const email = m[1].toLowerCase();
    if (!skipPrefixes.test(email.split('@')[0])) return email;
  }
  
  // 2. Raw email patterns
  const rawMatches = [...html.matchAll(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g)];
  for (const m of rawMatches) {
    const email = m[1].toLowerCase();
    if (!skipPrefixes.test(email.split('@')[0])) return email;
  }
  
  // 3. Accept generic emails as last resort
  for (const m of mailtoMatches) return m[1].toLowerCase();
  for (const m of rawMatches) return m[1].toLowerCase();
  
  return null;
}

const DETECTION_PATTERNS = {
  stripe: [/stripe\.com\/v3/i, /js\.stripe\.com/i],
  shopify: [/cdn\.shopify\.com/i, /myshopify\.com/i],
  'google-analytics': [/googletagmanager\.com/i, /google-analytics\.com/i],
  intercom: [/intercomcdn\.com/i, /widget\.intercom\.io/i],
  hubspot: [/hs-scripts\.com/i, /forms\.hubspot\.com/i],
  mailchimp: [/mailchimp\.com/i, /list-manage\.com/i],
  wordpress: [/wp-content/i, /wp-includes/i],
  woocommerce: [/woocommerce/i],
};

function detectIntegrations(html) {
  const found = [];
  for (const [id, patterns] of Object.entries(DETECTION_PATTERNS)) {
    if (patterns.some(p => p.test(html))) {
      found.push(id);
    }
  }
  return found;
}

// ============================================================================
// Email Sending
// ============================================================================

async function sendProspectEmail(prospect, sendEmails = false) {
  if (!sendEmails || !RESEND_API_KEY || !prospect.contact_email) {
    return { sent: false, reason: 'skipped' };
  }
  
  const trackingPixelUrl = `${APP_URL}/api/track/open/${prospect.id}`;
  const ctaUrl = `${APP_URL}/api/track/click/${prospect.id}`;
  
  const firstName = prospect.contact_name?.split(' ')[0] || 'there';
  
  const subject = `Quick question about ${prospect.business_name || prospect.domain}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0a0a0f;color:#e8e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#13131a;border-radius:16px;overflow:hidden;border:1px solid #1f1f2a;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#635bff 0%,#00d4aa 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Fold Analytics
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#e8e8f0;">
                Hey ${firstName},
              </p>
              
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#bcbcd8;">
                I noticed <strong style="color:#e8e8f0;">${prospect.business_name || prospect.domain}</strong>${
                  prospect.detectedIntegrations?.length > 0 
                    ? ` is using ${prospect.detectedIntegrations.slice(0, 2).join(' and ')}` 
                    : ''
                } — nice setup!
              </p>
              
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#bcbcd8;">
                Quick question: are you tracking all your key metrics in one place? Most ${prospect.category || 'businesses'} we talk to have data scattered across Stripe, GA4, ad platforms, and email tools.
              </p>
              
              <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#bcbcd8;">
                <strong style="color:#e8e8f0;">Fold</strong> connects all your tools in 90 seconds and gives you a unified dashboard with AI insights. Think ChartMogul meets Baremetrics, but for <em>all</em> your platforms — not just Stripe.
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#635bff;border-radius:8px;padding:14px 32px;text-align:center;">
                    <a href="${ctaUrl}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:block;">
                      See a live demo →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#bcbcd8;">
                Takes 2 minutes to connect your first integration (Stripe, Shopify, GA4, Meta Ads, etc.) and you'll immediately see MRR, churn, ROAS, traffic trends, and AI-generated insights.
              </p>
              
              <p style="margin:0;font-size:15px;line-height:24px;color:#bcbcd8;">
                Happy to answer any questions — just hit reply.
              </p>
              
              <p style="margin:24px 0 0;font-size:15px;line-height:24px;color:#e8e8f0;">
                — George<br>
                <span style="font-size:13px;color:#6a6a90;">Fold Analytics</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #1f1f2a;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#6a6a90;">
                <a href="${APP_URL}" style="color:#00d4aa;text-decoration:none;">usefold.io</a>
              </p>
              <p style="margin:0;font-size:11px;color:#4a4a6a;">
                Don't want these emails? <a href="${APP_URL}/unsubscribe/${prospect.id}" style="color:#6a6a90;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
  
  <!-- Tracking Pixel -->
  <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;" />
</body>
</html>`;

  const text = `Hey ${firstName},

I noticed ${prospect.business_name || prospect.domain} — nice setup!

Quick question: are you tracking all your key metrics in one place?

Fold connects all your tools (Stripe, GA4, ads, email) in 90 seconds and gives you a unified dashboard with AI insights.

See a live demo: ${ctaUrl}

Happy to answer any questions — just hit reply.

— George
Fold Analytics
${APP_URL}`;

  try {
    const body = JSON.stringify({
      from: 'George from Fold <info@usefold.io>', //acum e corect
      to: [prospect.contact_email],
      subject,
      html,
      text,
      tags: [
        { name: 'campaign', value: 'outbound_prospecting' },
        { name: 'category', value: prospect.category },
      ],
    });

    await fetchRetry('Resend Send', 'https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    // Update prospect in DB
    await SB.update('outbound_prospects', {
      email_sent_at: new Date().toISOString(),
      email_subject: subject,
      email_preview: text.slice(0, 200),
      status: 'email_sent',
    }, { id: prospect.id });

    return { sent: true };
  } catch (err) {
    console.error(`  ❌ Email failed for ${prospect.contact_email}:`, err.message);
    return { sent: false, error: err.message };
  }
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const category = args.find(a => !a.startsWith('--'));
  const prospectsArg = args.find(a => a.startsWith('--prospects='));
  const sendEmails = args.includes('--send-emails');
  
  const limit = prospectsArg ? parseInt(prospectsArg.split('=')[1]) : 10;
  
  if (!category || !CATEGORIES.includes(category)) {
    console.error(`❌ Invalid category. Must be one of: ${CATEGORIES.join(', ')}`);
    console.log('\nUsage: node scripts/outbound-prospecting.mjs <category> [--prospects=10] [--send-emails]');
    process.exit(1);
  }
  
  console.log(`\n🔍 Starting outbound prospecting for: ${category}`);
  console.log(`   Target: ${limit} NEW prospects`);
  console.log(`   Send emails: ${sendEmails ? 'YES' : 'NO (dry run)'}\n`);
  
  // MULTIPLE SEARCH QUERIES to find diverse micro-businesses
  // Will rotate through these until we hit the limit
  const allSearchQueries = {
    'SaaS': [
      'lifetime deal saas pricing',
      'bootstrap saas tool indie',
      'micro saas product small',
      'saas startup solo founder',
      'indie saas maker pricing'
    ],
    'E-commerce': [
      'handcrafted shop contact',
      'artisan store small business',
      'handmade boutique indie',
      'craft shop one person',
      'small batch products store'
    ],
    'Agency': [
      'solo designer portfolio',
      'freelance creative one person',
      'independent designer agency',
      'boutique design studio small',
      'freelance developer portfolio'
    ],
    'Media & Content': [
      'indie newsletter substack',
      'solo writer blog newsletter',
      'independent journalist writer',
      'personal blog creator',
      'indie author newsletter'
    ],
    'Marketplace': [
      'indie marketplace pricing',
      'small marketplace community',
      'niche marketplace indie',
      'bootstrap marketplace platform',
      'micro marketplace creator'
    ],
    'Consumer App': [
      'indie app pricing',
      'solo developer app',
      'indie mobile app maker',
      'bootstrap app startup',
      'micro app indie developer'
    ],
    'Fintech': [
      'bootstrapped payment pricing',
      'indie fintech startup',
      'micro payment solution',
      'solo developer payment',
      'small fintech tool'
    ],
    'Healthcare': [
      'independent telehealth pricing',
      'solo practitioner telehealth',
      'private practice telemedicine',
      'independent doctor virtual',
      'solo healthcare provider'
    ],
    'Education': [
      'indie course gumroad',
      'solo educator course',
      'independent teacher online',
      'bootstrap course platform',
      'micro elearning creator'
    ],
    'Other': [
      'indie maker pricing',
      'bootstrap startup tool',
      'solo founder product',
      'micro business indie',
      'small startup maker'
    ]
  };
  
  const queries = allSearchQueries[category] || allSearchQueries['Other'];
  
  // Step 1: Search Google with multiple queries until we have enough prospects
  let allResults = [];
  let queryIndex = 0;
  let saved = 0;
  let emailsSent = 0;
  
  console.log(`📡 Searching with ${queries.length} different query variations...\n`);
  console.log(`🔁 Will keep cycling through queries until finding ${limit} NEW prospects\n`);
  
  // Keep searching until we find enough new prospects (cycle through queries indefinitely)
  while (saved < limit) {
    const searchQuery = queries[queryIndex % queries.length]; // Loop back to start when done
    const cycleNumber = Math.floor(queryIndex / queries.length) + 1;
    const queryInCycle = (queryIndex % queries.length) + 1;
    
    console.log(`🔎 Cycle ${cycleNumber}, Query ${queryInCycle}/${queries.length}: "${searchQuery}"`);
    
    const searchResults = await searchGoogle(searchQuery, 20); // Get 20 per query
    
    if (searchResults.length === 0) {
      console.log('   No results, trying next query...\n');
      queryIndex++;
      continue;
    }
    
    console.log(`   Found ${searchResults.length} potential websites`);
    
    // Step 2: Process each website from this query
    for (const result of searchResults) {
      if (saved >= limit) break; // Stop when we hit the target
      
      const domain = normalizeDomain(result.url);
      
      console.log(`\n[${saved + 1}/${limit}] ${domain}`);
      
      // Check if already in database
      const existing = await SB.select('outbound_prospects', { 
        eq: { domain },
        limit: 1 
      });
      
      if (existing && existing.length > 0) {
        console.log('  ⏭️  Already in database, skipping...');
        continue; // Don't increment saved, just skip
      }
      
      // Scrape website
      console.log('  🌐 Scraping website...');
      const scraped = await scrapeWebsite(result.url);
      
      if (!scraped) {
        continue; // Skip failed scrapes, don't count them
      }
      
      console.log(`  📧 Email: ${scraped.email || 'not found'}`);
      console.log(`  🏢 Business: ${scraped.businessName || 'unknown'}`);
      console.log(`  🔧 Integrations: ${scraped.detectedIntegrations.join(', ') || 'none detected'}`);
      
      // Save to database
      try {
        const prospect = {
          category,
          domain,
          website_url: result.url,
          business_name: scraped.businessName || null,
          page_title: scraped.title || null,
          page_description: scraped.description || null,
          contact_email: scraped.email || null,
          detected_integrations: scraped.detectedIntegrations,
          scraped_at: new Date().toISOString(),
          status: 'scraped',
        };
        
        const inserted = await SB.insert('outbound_prospects', prospect);
        
        if (inserted && inserted.length > 0) {
          console.log('  ✅ Saved to database');
          saved++; // Only increment when successfully saved
          
          // Send email if requested and email found
          if (scraped.email) {
            console.log('  📨 Sending email...');
            const emailResult = await sendProspectEmail(
              { ...prospect, id: inserted[0].id },
              sendEmails
            );
            
            if (emailResult.sent) {
              console.log('  ✅ Email sent successfully');
              emailsSent++;
            } else if (sendEmails) {
              console.log(`  ⚠️  Email not sent: ${emailResult.reason || emailResult.error}`);
            } else {
              console.log('  ⏭️  Email skipped (dry run mode)');
            }
            
            // Rate limit
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      } catch (err) {
        console.error(`  ❌ Database error: ${err.message}`);
      }
      
      // Rate limit between websites
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Move to next query
    queryIndex++;
    
    if (saved < limit) {
      console.log(`\n   Progress: ${saved}/${limit} prospects found. Moving to next query...\n`);
      
      // Add longer delay between queries to avoid rate limits
      if (queryIndex % queries.length === 0) {
        console.log(`   ⏸️  Completed cycle ${cycleNumber}. Pausing 5 seconds before restarting...\n`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  console.log(`\n✅ Prospecting complete!`);
  console.log(`   Total saved: ${saved} NEW prospects`);
  console.log(`   Emails sent: ${emailsSent}`);
  console.log(`   Total cycles: ${Math.floor(queryIndex / queries.length)}`);
  console.log(`   Total queries executed: ${queryIndex}\n`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
