import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { INTEGRATIONS_CATALOG } from "@/lib/integrations/catalog";
import crypto from "crypto";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1): number {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

// Generate realistic time series data with overall trend + random fluctuations
function generateRealisticSeries(length: number, baseStart: number, baseEnd: number, variance = 0.15): number[] {
  const data: number[] = [];
  const trendSlope = (baseEnd - baseStart) / (length - 1);
  
  for (let i = 0; i < length; i++) {
    // Base trend value
    const trendValue = baseStart + (trendSlope * i);
    
    // Add random variance (-variance to +variance of trend value)
    const randomVariance = trendValue * (Math.random() * variance * 2 - variance);
    
    // Ensure positive value
    const value = Math.max(Math.round(trendValue + randomVariance), Math.round(baseStart * 0.5));
    
    data.push(value);
  }
  
  return data;
}

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
  mrr: randomInt(2500, 8000),
  mrrGrowth: randomFloat(3, 18, 1),
  monthlyVisitors: randomInt(4000, 12000),
  visitorsGrowth: randomFloat(2, 15, 1),
  bounceRate: randomFloat(38, 65, 1),
  conversionRate: randomFloat(1.5, 4.5, 1),
  avgSessionDuration: randomInt(120, 240),
  newCustomers: randomInt(15, 45),
  churnRate: randomFloat(2, 7, 1),
  ltv: randomInt(200, 500),
  adSpend: randomInt(500, 2000),
  roas: randomFloat(1.8, 4.2, 1),
  revenueChart: {
    labels: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"],
    data: generateRealisticSeries(6, randomInt(1800, 2200), randomInt(3500, 4500), 0.12)
  },
  visitorsChart: {
    labels: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"],
    data: generateRealisticSeries(6, randomInt(3500, 4500), randomInt(7000, 9000), 0.1)
  },
  dailyRevenue: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    data: [
      randomInt(400, 600),   // Mon - business day
      randomInt(450, 650),   // Tue - peak
      randomInt(480, 680),   // Wed - peak
      randomInt(460, 660),   // Thu - business day
      randomInt(420, 620),   // Fri - tapering
      randomInt(280, 420),   // Sat - weekend drop
      randomInt(240, 380)    // Sun - weekend low
    ]
  },
  topPages: [
    { path: "/", views: randomInt(2500, 4000), bounceRate: randomFloat(35, 55, 1), avgTime: randomInt(100, 150) },
    { path: "/pricing", views: randomInt(800, 1500), bounceRate: randomFloat(25, 40, 1), avgTime: randomInt(140, 200) },
    { path: "/about", views: randomInt(400, 900), bounceRate: randomFloat(45, 65, 1), avgTime: randomInt(70, 120) },
    { path: "/blog", views: randomInt(300, 700), bounceRate: randomFloat(55, 70, 1), avgTime: randomInt(60, 110) },
    { path: "/contact", views: randomInt(200, 500), bounceRate: randomFloat(40, 60, 1), avgTime: randomInt(50, 100) },
  ],
  trafficSources: [
    { source: "Organic Search", sessions: randomInt(2500, 4000), pct: randomInt(38, 48) },
    { source: "Direct", sessions: randomInt(1200, 2200), pct: randomInt(20, 30) },
    { source: "Referral", sessions: randomInt(800, 1500), pct: randomInt(12, 20) },
    { source: "Paid Search", sessions: randomInt(400, 1000), pct: randomInt(8, 15) },
    { source: "Social", sessions: randomInt(200, 600), pct: randomInt(4, 10) },
  ],
  devices: { desktop: randomInt(55, 70), mobile: randomInt(25, 38), tablet: randomInt(4, 8) },
  countries: [
    { name: "United States", code: "US", sessions: randomInt(2500, 4000), pct: randomInt(38, 48) },
    { name: "United Kingdom", code: "GB", sessions: randomInt(500, 1000), pct: randomInt(8, 14) },
    { name: "Canada", code: "CA", sessions: randomInt(300, 700), pct: randomInt(5, 10) },
    { name: "Germany", code: "DE", sessions: randomInt(250, 600), pct: randomInt(4, 9) },
    { name: "Australia", code: "AU", sessions: randomInt(150, 450), pct: randomInt(3, 7) },
  ],
  recentCustomers: [
    { name: "Jordan T.", email: "j***@startup.co", plan: "Pro", mrr: randomInt(39, 99), joinedDaysAgo: randomInt(1, 3) },
    { name: "Maya R.", email: "m***@business.io", plan: "Growth", mrr: randomInt(59, 149), joinedDaysAgo: randomInt(2, 5) },
    { name: "Chris L.", email: "c***@gmail.com", plan: "Starter", mrr: randomInt(19, 49), joinedDaysAgo: randomInt(3, 7) },
  ],
  aiInsights: [
    "Connect real integrations to replace these estimates with accurate live metrics.",
    "Your pricing page engagement suggests strong product-market fit worth investigating further.",
    "Consider adding retargeting campaigns to convert the organic traffic at a lower CAC.",
    "Desktop-heavy traffic indicates B2B audience - optimize checkout flow for business buyers.",
  ],
  opportunities: [
    { title: "Implement exit-intent popup", impact: "high", effort: "low", estimatedRevenue: randomInt(250, 500) },
    { title: "Launch annual billing option", impact: "high", effort: "medium", estimatedRevenue: randomInt(700, 1200) },
    { title: "Create affiliate program", impact: "medium", effort: "medium", estimatedRevenue: randomInt(400, 800) },
  ],
};

export async function POST(req: Request) {
  const db = createServiceClient();

  // Check if user is admin (bypass rate limit only for admin)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ADMIN_USER_ID = 'bfd5f621-a8f0-4530-ae27-aabbe54491e0';
  const isAdmin = user?.id === ADMIN_USER_ID;

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

  // ── 1. Check domain cache (skip for admin to always get fresh data) ──────────────────────────────────────────────────
  if (!isAdmin) {
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
  }

  // ── 2. Rate limit: 1 new analysis per IP (skip for admin) ──────────────────────────────────
  if (!isAdmin) {
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

CRITICAL RULES FOR TIME SERIES DATA:
1. NEVER create repeating patterns (like up-down-up-down or identical cycles)
2. Show GRADUAL OVERALL GROWTH with small random variations (±5-12%)
3. Each month should generally be higher than the previous, with occasional small dips
4. Example GOOD revenue trend: [2341, 2587, 2698, 2934, 3156, 3421] - notice upward trajectory with natural variance
5. Example BAD revenue trend: [3000, 2000, 3000, 2000, 3000, 2000] - this is unrealistic zigzag pattern
6. Real businesses grow organically, not in perfect waves or cycles

Guidelines for realistic variation:
- Numbers should be irregular (avoid round numbers like 4800, use 4,762 or 3,891)
- Growth rates vary significantly by industry (bootstrapped SaaS: 5-15%, VC-backed: 15-40%, ecommerce: varies wildly)
- Monthly charts should show UPWARD TREND with small random dips, NOT oscillating patterns
- Daily charts can show weekday/weekend patterns for B2B (high Mon-Fri, low Sat-Sun)
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
    "data": "6 realistic values showing OVERALL UPWARD TREND with small random fluctuations. Example: [2341, 2587, 2698, 2934, 3156, 3421] - notice gradual increase with natural variance, NOT repeating patterns like [200, 180, 200, 180]. Each value should be slightly higher than previous with ±8% random variation."
  },
  "visitorsChart": {
    "labels": ["Dec","Jan","Feb","Mar","Apr","May"],
    "data": "6 realistic values with OVERALL GROWTH TREND. Example: [4782, 5123, 5487, 5891, 6234, 6789] - gradual increase with small dips allowed. NOT zigzag patterns. Growth should feel organic."
  },
  "dailyRevenue": {
    "labels": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    "data": "7 values showing WEEKDAY vs WEEKEND pattern. Example for B2B: [487, 523, 612, 578, 541, 312, 267] - high Mon-Fri, drop Sat-Sun. For consumer: more even distribution. Make it realistic to business type."
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

REMEMBER: Time series data MUST show gradual growth trends, NOT repeating up-down-up-down patterns. Real businesses don't oscillate like sine waves!`;

  let predictions: typeof FALLBACK_PREDICTIONS = FALLBACK_PREDICTIONS;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const jsonStr = raw.startsWith("```") ? raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim() : raw;
    const aiPredictions = JSON.parse(jsonStr);
    
    // Validate and sanitize AI predictions to avoid NaN values
    predictions = {
      businessCategory: aiPredictions.businessCategory || FALLBACK_PREDICTIONS.businessCategory,
      businessDescription: aiPredictions.businessDescription || FALLBACK_PREDICTIONS.businessDescription,
      techStack: Array.isArray(aiPredictions.techStack) ? aiPredictions.techStack : FALLBACK_PREDICTIONS.techStack,
      mrr: Number(aiPredictions.mrr) || randomInt(2500, 8000),
      mrrGrowth: Number(aiPredictions.mrrGrowth) || randomFloat(3, 18, 1),
      monthlyVisitors: Number(aiPredictions.monthlyVisitors) || randomInt(4000, 12000),
      visitorsGrowth: Number(aiPredictions.visitorsGrowth) || randomFloat(2, 15, 1),
      bounceRate: Number(aiPredictions.bounceRate) || randomFloat(38, 65, 1),
      conversionRate: Number(aiPredictions.conversionRate) || randomFloat(1.5, 4.5, 1),
      avgSessionDuration: Number(aiPredictions.avgSessionDuration) || randomInt(120, 240),
      newCustomers: Number(aiPredictions.newCustomers) || randomInt(15, 45),
      churnRate: Number(aiPredictions.churnRate) || randomFloat(2, 7, 1),
      ltv: Number(aiPredictions.ltv) || randomInt(200, 500),
      adSpend: Number(aiPredictions.adSpend) || randomInt(500, 2000),
      roas: Number(aiPredictions.roas) || randomFloat(1.8, 4.2, 1),
      revenueChart: {
        labels: aiPredictions.revenueChart?.labels || FALLBACK_PREDICTIONS.revenueChart.labels,
        data: Array.isArray(aiPredictions.revenueChart?.data) && aiPredictions.revenueChart.data.every((v: any) => !isNaN(Number(v)))
          ? aiPredictions.revenueChart.data.map((v: any) => Number(v))
          : generateRealisticSeries(6, randomInt(1800, 2200), randomInt(3500, 4500), 0.12)
      },
      visitorsChart: {
        labels: aiPredictions.visitorsChart?.labels || FALLBACK_PREDICTIONS.visitorsChart.labels,
        data: Array.isArray(aiPredictions.visitorsChart?.data) && aiPredictions.visitorsChart.data.every((v: any) => !isNaN(Number(v)))
          ? aiPredictions.visitorsChart.data.map((v: any) => Number(v))
          : generateRealisticSeries(6, randomInt(3500, 4500), randomInt(7000, 9000), 0.1)
      },
      dailyRevenue: {
        labels: aiPredictions.dailyRevenue?.labels || FALLBACK_PREDICTIONS.dailyRevenue.labels,
        data: Array.isArray(aiPredictions.dailyRevenue?.data) && aiPredictions.dailyRevenue.data.every((v: any) => !isNaN(Number(v)))
          ? aiPredictions.dailyRevenue.data.map((v: any) => Number(v))
          : FALLBACK_PREDICTIONS.dailyRevenue.data
      },
      topPages: Array.isArray(aiPredictions.topPages) 
        ? aiPredictions.topPages.map((p: any) => ({
            path: p.path || "/",
            views: Number(p.views) || randomInt(500, 2000),
            bounceRate: Number(p.bounceRate) || randomFloat(35, 65, 1),
            avgTime: Number(p.avgTime) || randomInt(60, 150)
          }))
        : FALLBACK_PREDICTIONS.topPages,
      trafficSources: Array.isArray(aiPredictions.trafficSources)
        ? aiPredictions.trafficSources.map((s: any) => ({
            source: s.source || "Unknown",
            sessions: Number(s.sessions) || randomInt(500, 2000),
            pct: Number(s.pct) || randomInt(5, 25)
          }))
        : FALLBACK_PREDICTIONS.trafficSources,
      devices: {
        desktop: Number(aiPredictions.devices?.desktop) || randomInt(55, 70),
        mobile: Number(aiPredictions.devices?.mobile) || randomInt(25, 38),
        tablet: Number(aiPredictions.devices?.tablet) || randomInt(4, 8)
      },
      countries: Array.isArray(aiPredictions.countries)
        ? aiPredictions.countries.map((c: any) => ({
            name: c.name || "Unknown",
            code: c.code || "XX",
            sessions: Number(c.sessions) || randomInt(300, 1500),
            pct: Number(c.pct) || randomInt(5, 20)
          }))
        : FALLBACK_PREDICTIONS.countries,
      recentCustomers: Array.isArray(aiPredictions.recentCustomers)
        ? aiPredictions.recentCustomers.map((c: any) => ({
            name: c.name || "Customer",
            email: c.email || "user@example.com",
            plan: c.plan || "Plan",
            mrr: Number(c.mrr) || randomInt(19, 99),
            joinedDaysAgo: Number(c.joinedDaysAgo) || randomInt(1, 7)
          }))
        : FALLBACK_PREDICTIONS.recentCustomers,
      aiInsights: Array.isArray(aiPredictions.aiInsights) 
        ? aiPredictions.aiInsights 
        : FALLBACK_PREDICTIONS.aiInsights,
      opportunities: Array.isArray(aiPredictions.opportunities)
        ? aiPredictions.opportunities.map((o: any) => ({
            title: o.title || "Opportunity",
            impact: o.impact || "medium",
            effort: o.effort || "medium",
            estimatedRevenue: Number(o.estimatedRevenue) || randomInt(300, 800)
          }))
        : FALLBACK_PREDICTIONS.opportunities
    };
  } catch (err) {
    console.error("[preview/analyze] AI prediction failed:", err);
    // Use randomized fallback
  }

  // ── 5. Persist result ──────────────────────────────────────────────────────
  await db.from("preview_scans").upsert({
    domain, site_url: finalUrl, site_title: title,
    site_description: description, site_favicon: favicon,
    detected_integrations: detectedIntegrations,
    predictions,
  }, { onConflict: "domain" });

  // ── 5b. Schedule outreach email (4-hour delay) - skip for admin ────────────────────────────
  if (!isAdmin) {
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
  }

  return NextResponse.json({
    site: { url: finalUrl, title, description, favicon },
    detectedIntegrations,
    predictions,
    cached: false,
    domain,
  });
}
