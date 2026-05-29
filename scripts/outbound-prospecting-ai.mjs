#!/usr/bin/env node

/**
 * AI-Powered Outbound Prospecting Script v2
 * 
 * Uses AI to generate optimized search terms, tracks performance, and learns
 * which terms are most effective at finding qualified prospects.
 * 
 * Usage:
 *   node scripts/outbound-prospecting-ai.mjs <category> [--prospects=10] [--send-emails]
 * 
 * Examples:
 *   node scripts/outbound-prospecting-ai.mjs "SaaS" --prospects=50 --send-emails
 *   node scripts/outbound-prospecting-ai.mjs "E-commerce" --prospects=20
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
const ANTHROPIC_API_KEY = ENV.ANTHROPIC_API_KEY || '';
const APP_URL = 'https://usefold.io';
const SERPER_API_KEY = ENV.SERPER_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('❌ Missing ANTHROPIC_API_KEY in .env - required for AI search term generation');
  process.exit(1);
}

if (!SERPER_API_KEY) {
  console.error('❌ Missing SERPER_API_KEY in .env');
  process.exit(1);
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
    if (params.select) queryParams.append('select', params.select);
    
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
// AI Search Term Generation
// ============================================================================

async function generateSearchTerms(category, batchNumber, previousTerms = [], performanceData = []) {
  console.log(`\n🤖 Generating 20 new search terms for ${category}...`);
  console.log(`   Batch: ${batchNumber}`);
  console.log(`   Avoiding ${previousTerms.length} previous terms\n`);
  
  // Build context about what worked/didn't work
  let performanceContext = '';
  if (performanceData.length > 0) {
    const topTerms = performanceData
      .filter(t => t.efficiency_score > 0)
      .sort((a, b) => b.efficiency_score - a.efficiency_score)
      .slice(0, 5);
    
    const worstTerms = performanceData
      .filter(t => t.times_searched > 0)
      .sort((a, b) => a.efficiency_score - b.efficiency_score)
      .slice(0, 5);
    
    if (topTerms.length > 0) {
      performanceContext += `\n\nMost effective search terms (${topTerms.map(t => `"${t.search_term}" - ${t.efficiency_score.toFixed(1)}% efficiency`).join(', ')})`;
    }
    
    if (worstTerms.length > 0) {
      performanceContext += `\n\nLeast effective terms to avoid patterns from: ${worstTerms.map(t => `"${t.search_term}"`).join(', ')}`;
    }
  }
  
  const prompt = `You are an expert at finding micro-businesses and solo founders online. Generate 20 unique SIMPLE Google search queries to find ${category} businesses that fit this profile:

TARGET PROFILE:
- Very small businesses (1-10 people, often solo founders)
- Bootstrap/indie/self-funded (not VC-backed)
- Price point: $19/month analytics tool is affordable
- Likely need better analytics (currently using basic tools or spreadsheets)
- Have a website with contact email
- Indicators: "lifetime deal", "indie", "bootstrap", "solo founder", "micro", "handcrafted", "artisan", "one-person"

CATEGORY: ${category}

${previousTerms.length > 0 ? `AVOID THESE PREVIOUS TERMS:\n${previousTerms.slice(0, 50).map(t => `- ${t}`).join('\n')}` : ''}
${performanceContext}

CRITICAL CONSTRAINTS:
- NO advanced operators (NO "OR", NO "site:", NO "inurl:", NO "-", NO quotes)
- ONLY simple keywords separated by spaces
- Maximum 6-8 words per query
- Think like a basic Google search, not an advanced one
- Examples: "micro saas pricing page", "bootstrap saas founder contact", "indie maker tool launched"

INSTRUCTIONS:
1. Generate 20 NEW SIMPLE search queries (different from previous terms)
2. Use only basic keywords: ${category}, indie, bootstrap, solo, micro, founder, pricing, contact
3. Mix different combinations: pricing + contact, founder + indie, bootstrap + tool
4. Keep it simple - pretend you're searching on Google homepage
5. No special characters or operators

Return ONLY a JSON array of 20 SIMPLE search terms with reasoning:
[
  {
    "term": "search query here",
    "reasoning": "why this will find qualified prospects"
  }
]`;

  try {
    // Use Claude 3 Opus - most widely available model
    const body = JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      temperature: 0.9, // Higher creativity for diverse terms
      system: 'You are an expert prospecting researcher. Return only valid JSON arrays.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    const response = await fetchRetry('Claude Generate Terms', 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body,
      timeout: 30000,
    });
    
    let content = response.content[0].text;
    
    // Claude often wraps JSON in markdown code blocks - strip them
    if (content.includes('```json')) {
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    } else if (content.includes('```')) {
      content = content.replace(/```\s*/g, '');
    }
    
    // Trim whitespace
    content = content.trim();
    
    const parsed = JSON.parse(content);
    
    // Extract terms array (handle different response structures)
    const terms = parsed.terms || parsed.search_terms || parsed.queries || parsed;
    
    if (!Array.isArray(terms) || terms.length === 0) {
      throw new Error('AI did not return valid terms array');
    }
    
    console.log(`✅ Generated ${terms.length} new search terms`);
    
    // Save to database
    const savedTerms = [];
    for (const item of terms) {
      const term = typeof item === 'string' ? item : item.term;
      const reasoning = typeof item === 'object' ? item.reasoning : '';
      
      try {
        const inserted = await SB.insert('outbound_search_terms', {
          category,
          search_term: term,
          generation_batch: batchNumber,
          ai_prompt: prompt.slice(0, 500), // Store truncated prompt
          ai_reasoning: reasoning,
        });
        
        if (inserted && inserted.length > 0) {
          savedTerms.push({
            id: inserted[0].id,
            term: term,
            reasoning: reasoning
          });
          console.log(`   ✓ "${term}"`);
        }
      } catch (err) {
        if (err.message.includes('duplicate')) {
          console.log(`   ⏭️  Skipped duplicate: "${term}"`);
        } else {
          console.error(`   ❌ Failed to save "${term}":`, err.message);
        }
      }
    }
    
    return savedTerms;
  } catch (err) {
    console.error('❌ AI generation failed:', err.message);
    throw err;
  }
}

// ============================================================================
// Google Search via Serper.dev API
// ============================================================================

async function searchGoogle(query, limit = 20) {
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
    
    return (result.organic || []).map(item => ({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
    }));
  } catch (err) {
    console.error('❌ Search failed:', err.message);
    return [];
  }
}

// ============================================================================
// Website Scraping (same as before)
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
    const html = await fetchRetry('Scrape Website', url, {
      json: false,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FoldAnalyticsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    const title = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim() || '';
    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i)?.[1]?.trim() ||
      '';
    
    const email = extractContactEmail(html);
    
    const businessName = 
      html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1]?.trim() ||
      title.split(/[|\-–—]/)[0].trim() ||
      '';
    
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

  const mailtoMatches = [...html.matchAll(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi)];
  for (const m of mailtoMatches) {
    const email = m[1].toLowerCase();
    if (!skipPrefixes.test(email.split('@')[0])) return email;
  }
  
  const rawMatches = [...html.matchAll(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g)];
  for (const m of rawMatches) {
    const email = m[1].toLowerCase();
    if (!skipPrefixes.test(email.split('@')[0])) return email;
  }
  
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
// Email Template Selection & Sending with Auto-Optimization
// ============================================================================

// Weighted random selection based on performance score
async function selectBestEmailTemplate() {
  try {
    // Get active templates sorted by performance score
    const templates = await SB.select('outbound_email_templates', {
      eq: { is_active: true },
      order: 'performance_score.desc',
    });
    
    if (!templates || templates.length === 0) {
      throw new Error('No active email templates found');
    }
    
    // For first 20 emails, distribute evenly across all templates to gather data
    const totalSent = templates.reduce((sum, t) => sum + (t.times_sent || 0), 0);
    if (totalSent < 20) {
      // Round-robin selection for initial data gathering
      const leastUsed = templates.reduce((min, t) => 
        (t.times_sent || 0) < (min.times_sent || 0) ? t : min
      );
      return leastUsed;
    }
    
    // After initial phase, use weighted selection favoring high-performers
    // Top 3 templates get 70% of traffic, rest get 30%
    const top3 = templates.slice(0, 3);
    const rest = templates.slice(3);
    
    const useTop3 = Math.random() < 0.7;
    
    if (useTop3 && top3.length > 0) {
      // Weighted random from top 3
      const totalScore = top3.reduce((sum, t) => sum + (t.performance_score || 0), 0);
      let random = Math.random() * totalScore;
      
      for (const template of top3) {
        random -= (template.performance_score || 0);
        if (random <= 0) return template;
      }
      
      return top3[0]; // Fallback
    } else if (rest.length > 0) {
      // Random from rest (exploration)
      return rest[Math.floor(Math.random() * rest.length)];
    } else {
      return templates[0];
    }
  } catch (err) {
    console.error('❌ Template selection failed:', err.message);
    throw err;
  }
}

function renderEmailTemplate(template, prospect) {
  const firstName = prospect.contact_name?.split(' ')[0] || prospect.business_name?.split(' ')[0] || 'there';
  const businessName = prospect.business_name || prospect.domain;
  const trackingLink = `${APP_URL}/api/track/click/${prospect.id}`;
  
  let body = template.body_template;
  body = body.replace(/\{first_name\}/g, firstName);
  body = body.replace(/\{business_name\}/g, businessName);
  body = body.replace(/\{tracking_link\}/g, trackingLink);
  
  let subject = template.subject_line;
  subject = subject.replace(/\{first_name\}/g, firstName);
  subject = subject.replace(/\{business_name\}/g, businessName);
  
  return { subject, body };
}

async function sendProspectEmail(prospect, sendEmails = false) {
  if (!sendEmails || !RESEND_API_KEY || !prospect.contact_email) {
    return { sent: false, reason: 'skipped' };
  }
  
  try {
    // Select best performing template
    const template = await selectBestEmailTemplate();
    
    // Render email from template
    const { subject, body } = renderEmailTemplate(template, prospect);
    
    // Plain text only - no tracking pixel (can't track opens in plain text)
    // We rely on click tracking only
    
    // Send plain text email (no HTML, no emoji)
    await fetchRetry('Resend Send', 'https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'George from Fold <info@usefold.io>',
        to: [prospect.contact_email],
        subject,
        text: body, // Plain text only, no tracking pixel
        // No HTML version - plain text only for better deliverability
      }),
    });

    // Update prospect with template tracking
    await SB.update('outbound_prospects', {
      email_sent_at: new Date().toISOString(),
      email_template_id: template.id,
      status: 'email_sent',
    }, { id: prospect.id });
    
    // Update template usage stats
    await SB.update('outbound_email_templates', {
      times_sent: template.times_sent + 1,
      last_used_at: new Date().toISOString(),
    }, { id: template.id });

    console.log(`    ✉️  Template: ${template.template_name} (#${template.template_number})`);

    return { sent: true, template: template.template_name };
  } catch (err) {
    console.error(`  ❌ Email failed:`, err.message);
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
  
  const targetProspects = prospectsArg ? parseInt(prospectsArg.split('=')[1]) : 10;
  
  if (!category || !CATEGORIES.includes(category)) {
    console.error(`❌ Invalid category. Must be one of: ${CATEGORIES.join(', ')}`);
    console.log('\nUsage: node scripts/outbound-prospecting-ai.mjs <category> [--prospects=10] [--send-emails]');
    process.exit(1);
  }
  
  console.log(`\n🚀 AI-Powered Outbound Prospecting for: ${category}`);
  console.log(`   Target: ${targetProspects} NEW prospects`);
  console.log(`   Send emails: ${sendEmails ? 'YES' : 'NO (dry run)'}\n`);
  
  let saved = 0;
  let emailsSent = 0;
  let batchNumber = 1;
  
  while (saved < targetProspects) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Progress: ${saved}/${targetProspects} prospects | Batch ${batchNumber}`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Get previous search terms and performance data
    const previousTerms = await SB.select('outbound_search_terms', {
      eq: { category },
      select: 'search_term,efficiency_score,email_efficiency_score,times_searched,unique_prospects_found',
    });
    
    const previousTermStrings = previousTerms.map(t => t.search_term);
    
    // Generate new search terms with AI
    const newTerms = await generateSearchTerms(category, batchNumber, previousTermStrings, previousTerms);
    
    if (newTerms.length === 0) {
      console.error('\n❌ No new search terms generated. Exiting.');
      break;
    }
    
    // Search with each new term
    for (const termData of newTerms) {
      if (saved >= targetProspects) break;
      
      console.log(`\n🔎 Searching: "${termData.term}"`);
      console.log(`   💡 Why: ${termData.reasoning}`);
      
      const searchResults = await searchGoogle(termData.term, 20);
      
      // Update search term stats
      let uniqueFound = 0;
      let duplicates = 0;
      let emailsFoundInTerm = 0;
      
      for (const result of searchResults) {
        if (saved >= targetProspects) break;
        
        const domain = normalizeDomain(result.url);
        
        // Check if already exists
        const existing = await SB.select('outbound_prospects', { 
          eq: { domain },
          limit: 1 
        });
        
        const isNew = !existing || existing.length === 0;
        
        if (!isNew) {
          duplicates++;
          continue;
        }
        
        console.log(`\n  [${saved + 1}/${targetProspects}] ${domain}`);
        
        const scraped = await scrapeWebsite(result.url);
        if (!scraped) continue;
        
        console.log(`    📧 Email: ${scraped.email || 'not found'}`);
        
        if (scraped.email) emailsFoundInTerm++;
        
        // Save prospect
        try {
          const prospect = {
            category,
            domain,
            website_url: result.url,
            business_name: scraped.businessName || null,
            contact_email: scraped.email || null,
            detected_integrations: scraped.detectedIntegrations,
            scraped_at: new Date().toISOString(),
            status: 'scraped',
          };
          
          const inserted = await SB.insert('outbound_prospects', prospect);
          
          if (inserted && inserted.length > 0) {
            saved++;
            uniqueFound++;
            
            // Link prospect to search term
            await SB.insert('outbound_prospect_sources', {
              prospect_id: inserted[0].id,
              search_term_id: termData.id,
              was_new_prospect: true,
            });
            
            // Send email if applicable
            if (scraped.email && sendEmails) {
              const emailResult = await sendProspectEmail({ ...prospect, id: inserted[0].id }, true);
              if (emailResult.sent) emailsSent++;
            }
          }
        } catch (err) {
          console.error(`    ❌ Save failed: ${err.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Update search term performance
      await SB.update('outbound_search_terms', {
        times_searched: 1, // Will increment in real version
        total_results: searchResults.length,
        unique_prospects_found: uniqueFound,
        duplicate_count: duplicates,
        emails_found: emailsFoundInTerm,
        last_searched_at: new Date().toISOString(),
      }, { id: termData.id });
      
      console.log(`\n  📈 Term performance: ${uniqueFound} new | ${duplicates} duplicates | ${emailsFoundInTerm} emails`);
      
      if (searchResults.length > 0) {
        const efficiency = (uniqueFound / searchResults.length * 100).toFixed(1);
        console.log(`  🎯 Efficiency: ${efficiency}%`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    batchNumber++;
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ PROSPECTING COMPLETE!`);
  console.log(`${'='.repeat(80)}`);
  console.log(`   Total prospects saved: ${saved}`);
  console.log(`   Emails sent: ${emailsSent}`);
  console.log(`   AI batches generated: ${batchNumber - 1}\n`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
