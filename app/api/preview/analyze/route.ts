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
  mrr: 3200, mrrGrowth: 9.2, monthlyVisitors: 6800, visitorsGrowth: 7.1,
  bounceRate: 48, conversionRate: 2.1, avgSessionDuration: 165,
  newCustomers: 24, churnRate: 3.1, ltv: 280, adSpend: 900, roas: 2.9,
  revenueChart: { labels: ["Dec","Jan","Feb","Mar","Apr","May"], data: [2100,2400,2700,2900,3100,3200] },
  visitorsChart: { labels: ["Dec","Jan","Feb","Mar","Apr","May"], data: [4200,4700,5100,5700,6200,6800] },
  dailyRevenue:  { labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], data: [420,580,710,640,820,490,380] },
  topPages: [
    { path: "/", views: 3200, bounceRate: 44, avgTime: 118 },
    { path: "/pricing", views: 1100, bounceRate: 33, avgTime: 165 },
    { path: "/about", views: 680, bounceRate: 58, avgTime: 90 },
    { path: "/blog", views: 520, bounceRate: 65, avgTime: 82 },
    { path: "/contact", views: 310, bounceRate: 52, avgTime: 73 },
  ],
  trafficSources: [
    { source: "Organic Search", sessions: 2900, pct: 43 },
    { source: "Direct", sessions: 1700, pct: 25 },
    { source: "Referral", sessions: 1100, pct: 16 },
    { source: "Paid Search", sessions: 680, pct: 10 },
    { source: "Social", sessions: 420, pct: 6 },
  ],
  devices: { desktop: 60, mobile: 34, tablet: 6 },
  countries: [
    { name: "United States", code: "US", sessions: 2900, pct: 43 },
    { name: "United Kingdom", code: "GB", sessions: 680, pct: 10 },
    { name: "Canada", code: "CA", sessions: 490, pct: 7 },
    { name: "Germany", code: "DE", sessions: 380, pct: 6 },
    { name: "Australia", code: "AU", sessions: 290, pct: 4 },
  ],
  recentCustomers: [
    { name: "Alex M.", email: "a***@gmail.com", plan: "Pro", mrr: 49, joinedDaysAgo: 1 },
    { name: "Sarah K.", email: "s***@company.com", plan: "Pro", mrr: 49, joinedDaysAgo: 2 },
    { name: "Tom W.", email: "t***@startup.io", plan: "Starter", mrr: 19, joinedDaysAgo: 4 },
  ],
  aiInsights: [
    "Connect real data to replace these estimates with live metrics from your integrations.",
    "Based on your tech stack, there are quick wins available for conversion rate improvement.",
    "Your industry benchmarks suggest meaningful growth potential in organic search.",
    "Investing in SEO content could accelerate traffic growth at a lower CAC than paid ads.",
  ],
  opportunities: [
    { title: "Recover abandoned checkouts", impact: "high", effort: "low", estimatedRevenue: 280 },
    { title: "Add annual plan pricing", impact: "high", effort: "medium", estimatedRevenue: 900 },
    { title: "Implement referral program", impact: "medium", effort: "medium", estimatedRevenue: 480 },
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

  const prompt = `You are a business intelligence analyst. Generate a full estimated dashboard for this website.

Website: ${finalUrl}
Title: ${title || "unknown"}
Meta description: ${description || "not available"}
Detected tools: ${integrationNames}
Page text: ${htmlSnippet}

Respond ONLY with valid JSON — no markdown:
{
  "businessCategory": "SaaS",
  "businessDescription": "One concise sentence.",
  "techStack": ["Next.js", "Stripe"],
  "mrr": 4800, "mrrGrowth": 11.2,
  "monthlyVisitors": 9200, "visitorsGrowth": 8.7,
  "bounceRate": 41.3, "conversionRate": 3.1, "avgSessionDuration": 194,
  "newCustomers": 38, "churnRate": 2.1, "ltv": 420, "adSpend": 1200, "roas": 3.8,
  "revenueChart": { "labels": ["Dec","Jan","Feb","Mar","Apr","May"], "data": [2900,3200,3600,4000,4400,4800] },
  "visitorsChart": { "labels": ["Dec","Jan","Feb","Mar","Apr","May"], "data": [5800,6400,7100,7900,8500,9200] },
  "dailyRevenue":  { "labels": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], "data": [680,920,1100,840,1300,760,590] },
  "topPages": [
    { "path": "/", "views": 4200, "bounceRate": 38, "avgTime": 124 },
    { "path": "/pricing", "views": 1900, "bounceRate": 29, "avgTime": 187 }
  ],
  "trafficSources": [
    { "source": "Organic Search", "sessions": 3800, "pct": 41 },
    { "source": "Direct", "sessions": 2200, "pct": 24 },
    { "source": "Referral", "sessions": 1400, "pct": 15 },
    { "source": "Paid Search", "sessions": 1100, "pct": 12 },
    { "source": "Social", "sessions": 700, "pct": 8 }
  ],
  "devices": { "desktop": 57, "mobile": 37, "tablet": 6 },
  "countries": [
    { "name": "United States", "code": "US", "sessions": 4100, "pct": 45 },
    { "name": "United Kingdom", "code": "GB", "sessions": 980, "pct": 11 },
    { "name": "Germany", "code": "DE", "sessions": 720, "pct": 8 },
    { "name": "Canada", "code": "CA", "sessions": 610, "pct": 7 },
    { "name": "Australia", "code": "AU", "sessions": 430, "pct": 5 }
  ],
  "recentCustomers": [
    { "name": "Alex M.", "email": "a***@gmail.com", "plan": "Pro", "mrr": 49, "joinedDaysAgo": 1 },
    { "name": "Sarah K.", "email": "s***@company.com", "plan": "Pro", "mrr": 49, "joinedDaysAgo": 2 },
    { "name": "Tom W.", "email": "t***@startup.io", "plan": "Starter", "mrr": 19, "joinedDaysAgo": 3 }
  ],
  "aiInsights": [
    "Your /pricing page has an unusually low bounce rate — visitors are highly engaged. A/B test a sticky CTA.",
    "Organic search drives 41% of traffic but paid only 12%. SEO investment could double growth at lower CAC.",
    "Desktop users account for 57% of traffic, suggesting a B2B audience. Optimize the desktop flow first.",
    "MRR growth of 11.2% MoM is strong. At this rate you will cross $10k MRR within 8 months.",
    "The bounce rate on the homepage is below industry average. The messaging is resonating well."
  ],
  "opportunities": [
    { "title": "Recover abandoned checkouts", "impact": "high", "effort": "low", "estimatedRevenue": 380 },
    { "title": "Add annual plan pricing", "impact": "high", "effort": "medium", "estimatedRevenue": 1200 },
    { "title": "Implement referral program", "impact": "medium", "effort": "medium", "estimatedRevenue": 640 }
  ]
}`;

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
