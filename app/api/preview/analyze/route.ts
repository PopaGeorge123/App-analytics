import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { INTEGRATIONS_CATALOG } from "@/lib/integrations/catalog";
import crypto from "crypto";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeDomain(urlStr: string): string {
  try {
    const u = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return urlStr.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].toLowerCase();
  }
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + (process.env.IP_HASH_SALT ?? "preview-salt")).digest("hex").slice(0, 32);
}

// ── Detection patterns per integration ───────────────────────────────────────
const DETECTION_PATTERNS: Record<string, RegExp[]> = {
  stripe: [/stripe\.com\/v3/i, /js\.stripe\.com/i],
  ga4: [/googletagmanager\.com/i, /G-[A-Z0-9]{6,12}/i, /gtag\s*\(/i, /google-analytics\.com/i],
  meta: [/connect\.facebook\.net/i, /fbq\s*\(/i, /facebook\.com\/tr/i],
  "google-ads": [/googleadservices\.com/i, /AW-[0-9]{7,}/i, /googlesyndication\.com/i],
  plausible: [/plausible\.io\/js/i],
  posthog: [/posthog\.com/i, /posthog-js/i],
  hotjar: [/hotjar\.com/i, /static\.hotjar\.com/i],
  intercom: [/intercomcdn\.com/i, /widget\.intercom\.io/i, /app\.intercom\.io/i],
  crisp: [/crisp\.chat/i, /client\.crisp\.chat/i],
  hubspot: [/hs-scripts\.com/i, /js\.hs-scripts\.com/i, /forms\.hubspot\.com/i],
  mailchimp: [/mailchimp\.com/i, /list-manage\.com/i, /chimpstatic\.com/i],
  klaviyo: [/klaviyo\.com/i, /static\.klaviyo\.com/i],
  shopify: [/cdn\.shopify\.com/i, /myshopify\.com/i],
  paddle: [/paddle\.com\/js/i, /cdn\.paddle\.com/i],
  "lemon-squeezy": [/lemonsqueezy\.com/i, /assets\.lemonsqueezy\.com/i],
  gumroad: [/gumroad\.com/i, /assets\.gumroad\.com/i],
  segment: [/cdn\.segment\.com/i, /analytics\.segment\.io/i],
  mixpanel: [/mixpanel\.com/i, /cdn\.mxpnl\.com/i],
};

function detectIntegrations(html: string) {
  const found: Array<{ id: string; confidence: "high" | "medium" }> = [];
  for (const [id, patterns] of Object.entries(DETECTION_PATTERNS)) {
    const matched = patterns.some((p) => p.test(html));
    if (matched) found.push({ id, confidence: "high" });
  }
  return found
    .map(({ id, confidence }) => {
      const cat = INTEGRATIONS_CATALOG.find((c) => c.id === id);
      if (!cat) return null;
      return { id: cat.id, name: cat.name, color: cat.color, icon: cat.icon, category: cat.category, confidence };
    })
    .filter(Boolean);
}

function extractMeta(html: string): { title: string; description: string } {
  const title =
    html.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim() ?? "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,300})["']/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+property=["']og:description["']/i)?.[1]?.trim() ??
    "";
  return { title, description };
}

function extractContactEmail(html: string): string | null {
  const skipPrefixes = /^(noreply|no-reply|donotreply|support|help|info|hello|contact|admin|sales|team|billing|abuse|postmaster|webmaster|newsletter|unsubscribe|legal|privacy|press|media|jobs|careers|hr)/i;

  // 1. mailto: links first (most reliable)
  const mailtoMatches = [...html.matchAll(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi)];
  for (const m of mailtoMatches) {
    const email = m[1].toLowerCase();
    if (!skipPrefixes.test(email.split("@")[0])) return email;
  }
  // 2. Fallback: raw email patterns in text/content
  const rawMatches = [...html.matchAll(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g)];
  for (const m of rawMatches) {
    const email = m[1].toLowerCase();
    if (!skipPrefixes.test(email.split("@")[0])) return email;
  }
  // 3. Accept generic contact emails as last resort
  for (const m of mailtoMatches) return m[1].toLowerCase();
  for (const m of rawMatches) return m[1].toLowerCase();
  return null;
}

function extractFavicon(html: string, origin: string): string {
  const match =
    html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
  if (match) {
    const href = match[1];
    if (href.startsWith("http")) return href;
    return `${origin}${href.startsWith("/") ? "" : "/"}${href}`;
  }
  return `${origin}/favicon.ico`;
}

const FALLBACK_PREDICTIONS = {
  businessCategory: "SaaS",
  businessDescription: "A web-based business serving online customers.",
  techStack: [] as string[],
  mrr: 3247, mrrGrowth: 8.7, monthlyVisitors: 6891, visitorsGrowth: 6.3,
  bounceRate: 47.2, conversionRate: 2.3, avgSessionDuration: 167,
  newCustomers: 23, churnRate: 3.4, ltv: 287, adSpend: 920, roas: 2.7,
  revenueChart: { labels: ["Dec","Jan","Feb","Mar","Apr","May"], data: [2187,2456,2623,2891,3054,3247] },
  visitorsChart: { labels: ["Dec","Jan","Feb","Mar","Apr","May"], data: [4387,4892,5234,5876,6421,6891] },
  dailyRevenue:  { labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], data: [437,592,683,671,798,512,394] },
  topPages: [
    { path: "/", views: 3287, bounceRate: 43.8, avgTime: 121 },
    { path: "/pricing", views: 1143, bounceRate: 31.2, avgTime: 172 },
    { path: "/about", views: 697, bounceRate: 56.4, avgTime: 94 },
    { path: "/blog", views: 534, bounceRate: 63.7, avgTime: 87 },
    { path: "/contact", views: 318, bounceRate: 51.3, avgTime: 76 },
  ],
  trafficSources: [
    { source: "Organic Search", sessions: 2967, pct: 43 },
    { source: "Direct", sessions: 1723, pct: 25 },
    { source: "Referral", sessions: 1102, pct: 16 },
    { source: "Paid Search", sessions: 689, pct: 10 },
    { source: "Social", sessions: 413, pct: 6 },
  ],
  devices: { desktop: 61, mobile: 33, tablet: 6 },
  countries: [
    { name: "United States", code: "US", sessions: 2963, pct: 43 },
    { name: "United Kingdom", code: "GB", sessions: 689, pct: 10 },
    { name: "Canada", code: "CA", sessions: 482, pct: 7 },
    { name: "Germany", code: "DE", sessions: 413, pct: 6 },
    { name: "Australia", code: "AU", sessions: 275, pct: 4 },
  ],
  recentCustomers: [
    { name: "Jordan T.", email: "j***@startup.co", plan: "Pro", mrr: 49, joinedDaysAgo: 1 },
    { name: "Maya R.", email: "m***@business.io", plan: "Growth", mrr: 79, joinedDaysAgo: 3 },
    { name: "Chris L.", email: "c***@gmail.com", plan: "Starter", mrr: 19, joinedDaysAgo: 5 },
  ],
  aiInsights: [
    "Connect real integrations to replace these estimates with accurate live metrics.",
    "Your pricing page engagement suggests strong product-market fit worth investigating further.",
    "Consider adding retargeting campaigns to convert the 43% organic traffic at a lower CAC.",
    "Desktop-heavy traffic indicates B2B audience - optimize checkout flow for business buyers.",
  ],
  opportunities: [
    { title: "Implement exit-intent popup", impact: "high", effort: "low", estimatedRevenue: 340 },
    { title: "Launch annual billing option", impact: "high", effort: "medium", estimatedRevenue: 980 },
    { title: "Create affiliate program", impact: "medium", effort: "medium", estimatedRevenue: 520 },
  ],
};

export async function POST(req: Request) {
  const db = createServiceClient();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ?? "unknown";
  const ipHash = hashIp(ip);

  const body = await req.json().catch(() => ({})) as { url?: string };
  let rawUrl = (body.url ?? "").trim();
  if (!rawUrl) return NextResponse.json({ error: "URL is required." }, { status: 400 });
  if (!rawUrl.startsWith("http")) rawUrl = `https://${rawUrl}`;

  let parsedUrl: URL;
  try { parsedUrl = new URL(rawUrl); }
  catch { return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 }); }

  const hostname = parsedUrl.hostname;
  if (hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("192.168.") || hostname === "::1") {
    return NextResponse.json({ error: "Please enter a public website URL." }, { status: 400 });
  }

  const domain = normalizeDomain(rawUrl);

  // ── 1. Check domain cache ──────────────────────────────────────────────────
  const { data: cached } = await db
    .from("preview_scans")
    .select("*")
    .eq("domain", domain)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      site: { url: cached.site_url, title: cached.site_title, description: cached.site_description, favicon: cached.site_favicon },
      detectedIntegrations: cached.detected_integrations,
      predictions: cached.predictions,
      cached: true,
      domain,
    });
  }

  // ── 2. Rate limit: 1 new analysis per IP ──────────────────────────────────
  const { data: ipRecord } = await db
    .from("preview_ip_log")
    .select("ip_hash")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  if (ipRecord) {
    return NextResponse.json(
      { error: "You've already used your free website analysis. Sign up to unlock unlimited insights." },
      { status: 429 }
    );
  }

  // ── 3. Fetch website ───────────────────────────────────────────────────────
  let html = "";
  let finalUrl = rawUrl;
  let title = "";
  let description = "";
  let favicon = "";

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(rawUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AppAnalyticsPreviewBot/1.0)", Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    clearTimeout(timer);
    html = await res.text();
    finalUrl = res.url;
    const origin = new URL(finalUrl).origin;
    const meta = extractMeta(html);
    title = meta.title;
    description = meta.description;
    favicon = extractFavicon(html, origin);
  } catch {
    title = parsedUrl.hostname.replace(/^www\./, "");
  }

  const detectedIntegrations = detectIntegrations(html);
  const integrationNames = detectedIntegrations.length > 0
    ? detectedIntegrations.map((d) => d!.name).join(", ")
    : "none detected";

  // ── 4. AI prediction ───────────────────────────────────────────────────────
  const htmlSnippet = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 3500);

  const prompt = `You are an expert business intelligence analyst creating realistic estimated analytics for a website preview dashboard.

WEBSITE INFORMATION:
- URL: ${finalUrl}
- Title: ${title || "unknown"}
- Description: ${description || "not available"}
- Detected integrations: ${integrationNames}
- Page content sample: ${htmlSnippet}

IMPORTANT: Generate REALISTIC, VARIED data based on the actual business type and detected tools. Make it look authentic and natural, NOT templated.

Guidelines for realistic variation:
- Numbers should be irregular (avoid round numbers like 4800, use 4,762 or 3,891)
- Growth rates vary significantly by industry (bootstrapped SaaS: 5-15%, VC-backed: 15-40%, ecommerce: varies wildly)
- Charts should show realistic fluctuations, not smooth linear growth
- Traffic sources depend on business type (B2B = more direct/organic, B2C = more social/paid)
- Device split varies (B2B = 65-75% desktop, consumer apps = 60-70% mobile)
- Bounce rates realistic to page type (landing pages 40-70%, app dashboards 25-40%)
- Insights should reference ACTUAL detected tools and specific business characteristics
- Top pages should match the business type (SaaS has /pricing, /docs; ecommerce has /shop, /products)

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "businessCategory": "Determine from content: SaaS, Ecommerce, Marketplace, Agency, Media/Blog, etc.",
  "businessDescription": "One specific sentence describing what this business actually does based on the content.",
  "techStack": ["List actual detected tools like ${integrationNames}, plus infer likely stack from HTML"],
  "mrr": "Realistic monthly revenue based on business type (varied, use decimals)",
  "mrrGrowth": "Realistic % growth (varied, can be negative, use decimals like 7.3 or -2.1)",
  "monthlyVisitors": "Realistic visitor count (irregular numbers)",
  "visitorsGrowth": "Realistic % (varied, can fluctuate)",
  "bounceRate": "Realistic % for this business type (40-70 range, decimals)",
  "conversionRate": "Industry-appropriate % (SaaS: 2-5%, ecommerce: 1-3%, decimals)",
  "avgSessionDuration": "Realistic seconds (120-300 range, irregular)",
  "newCustomers": "Realistic count based on MRR and pricing tier",
  "churnRate": "Realistic % (SaaS: 2-7%, ecommerce higher, decimals)",
  "ltv": "Realistic lifetime value based on MRR and churn",
  "adSpend": "Realistic ad spend (can be 0 for organic-only, or varied amount)",
  "roas": "Realistic return on ad spend (1.5-5.0 range, decimals, or null if no ads)",
  "revenueChart": {
    "labels": ["Dec","Jan","Feb","Mar","Apr","May"],
    "data": [6 realistic, IRREGULAR values showing actual business fluctuations - NOT smooth growth]
  },
  "visitorsChart": {
    "labels": ["Dec","Jan","Feb","Mar","Apr","May"],
    "data": [6 realistic, VARIED values - include dips, spikes, plateaus]
  },
  "dailyRevenue": {
    "labels": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    "data": [7 realistic values - B2B lower on weekends, consumer varies differently]
  },
  "topPages": [
    {"path": "Actual likely page path based on business type", "views": "irregular number", "bounceRate": "varied %", "avgTime": "varied seconds"},
    {"path": "Another realistic page", "views": "lower than first", "bounceRate": "varied", "avgTime": "varied"},
    {"path": "Third page", "views": "even lower", "bounceRate": "varied", "avgTime": "varied"},
    {"path": "Fourth page if applicable", "views": "irregular", "bounceRate": "varied", "avgTime": "varied"},
    {"path": "Fifth page if applicable", "views": "irregular", "bounceRate": "varied", "avgTime": "varied"}
  ],
  "trafficSources": [
    {"source": "Source name", "sessions": "irregular number", "pct": "realistic % that varies by business type"},
    "4-6 sources total, percentages must add to ~100, vary the mix significantly based on business type and detected tools"
  ],
  "devices": {
    "desktop": "Realistic % based on business type (B2B: 65-75, consumer: 30-45)",
    "mobile": "Realistic % (remainder minus tablet)",
    "tablet": "Realistic % (usually 4-8)"
  },
  "countries": [
    {"name": "Most likely primary market", "code": "2-letter code", "sessions": "irregular", "pct": "realistic %"},
    {"name": "Second market", "code": "XX", "sessions": "varied", "pct": "varied %"},
    {"name": "Third market", "code": "XX", "sessions": "varied", "pct": "varied %"},
    "Add 2-5 countries total, with realistic geographic distribution for this business type"
  ],
  "recentCustomers": [
    {"name": "Varied realistic name", "email": "realistic masked email format", "plan": "Plan name fitting the business", "mrr": "varied realistic amount", "joinedDaysAgo": "varied 1-7"},
    {"name": "Different name", "email": "different email domain", "plan": "varied plan", "mrr": "different amount", "joinedDaysAgo": "varied"},
    {"name": "Another name", "email": "another domain", "plan": "varied", "mrr": "varied", "joinedDaysAgo": "varied"}
  ],
  "aiInsights": [
    "SPECIFIC insight referencing ACTUAL detected tools or page content - make it personalized",
    "Another SPECIFIC insight about THIS business's actual metrics or market position",
    "Third SPECIFIC insight with actionable detail relevant to detected tech stack",
    "Fourth SPECIFIC insight about growth trajectory or competitive positioning",
    "Optional fifth insight if you have something particularly relevant"
  ],
  "opportunities": [
    {"title": "Specific opportunity based on ACTUAL business type", "impact": "high/medium/low", "effort": "low/medium/high", "estimatedRevenue": "realistic varied number"},
    {"title": "Another specific opportunity for THIS business", "impact": "varied", "effort": "varied", "estimatedRevenue": "varied"},
    {"title": "Third opportunity if applicable", "impact": "varied", "effort": "varied", "estimatedRevenue": "varied"}
  ]
}

Remember: Make every number IRREGULAR and VARIED. No smooth curves. Real businesses have fluctuations, dips, spikes. Make insights SPECIFIC to what you actually detected.`;

  let predictions: typeof FALLBACK_PREDICTIONS = FALLBACK_PREDICTIONS;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const jsonStr = raw.startsWith("```") ? raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim() : raw;
    predictions = JSON.parse(jsonStr);
  } catch { /* use fallback */ }

  // ── 5. Persist result ──────────────────────────────────────────────────────
  await db.from("preview_scans").upsert({
    domain, site_url: finalUrl, site_title: title,
    site_description: description, site_favicon: favicon,
    detected_integrations: detectedIntegrations,
    predictions,
  }, { onConflict: "domain" });

  // ── 5b. Schedule outreach email (4-hour delay) ────────────────────────────
  const outreachEmail = extractContactEmail(html);
  if (outreachEmail) {
    const scheduledAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    await db.from("preview_scans").update({
      outreach_email: outreachEmail,
      outreach_scheduled_at: scheduledAt,
    }).eq("domain", domain).is("outreach_sent_at", null);
  }

  await db.from("preview_ip_log").upsert(
    { ip_hash: ipHash, scan_domain: domain },
    { onConflict: "ip_hash" }
  );

  return NextResponse.json({
    site: { url: finalUrl, title, description, favicon },
    detectedIntegrations,
    predictions,
    cached: false,
    domain,
  });
}
