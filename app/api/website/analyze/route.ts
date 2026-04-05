import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rateLimit";

// Allow up to 90s — screenshot fetch + Claude vision takes longer
export const maxDuration = 90;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Screenshot capture ────────────────────────────────────────────────────
// Uses thum.io (free, no API key) to render the page in a real browser
// and return a JPEG screenshot. Falls back gracefully if unavailable.

async function captureScreenshot(url: string): Promise<{ base64: string; mediaType: "image/jpeg" } | null> {
  try {
    // thum.io renders pages server-side with JS enabled — free, no auth needed
    const screenshotUrl = `https://image.thum.io/get/width/1280/crop/900/noanimate/${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(screenshotUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FoldBot/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { base64, mediaType: "image/jpeg" };
  } catch {
    return null;
  }
}

// ── HTML Content Extractor ────────────────────────────────────────────────

function extractPageContent(html: string, url: string): string {
  const raw = html;

  // ── 1. Stripped plain text (no tags, no scripts/styles) ──────────────
  const stripped = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|section|article|header|footer|h[1-6]|blockquote|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ").replace(/&[a-z]+;/g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 3)
    .join("\n");

  // ── 2. Meta / SEO tags ───────────────────────────────────────────────
  const metaTitle = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g,"").trim() ?? "";
  const metaDesc =
    raw.match(/meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})/i)?.[1]?.trim() ??
    raw.match(/meta[^>]+content=["']([^"']{1,400})["'][^>]+name=["']description["']/i)?.[1]?.trim() ?? "";
  const ogTitle    = raw.match(/property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() ?? raw.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]?.trim() ?? "";
  const ogDesc     = raw.match(/property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() ?? raw.match(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1]?.trim() ?? "";
  const ogImage    = raw.match(/property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() ?? "";
  const twitterCard= raw.match(/name=["']twitter:card["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() ?? "";
  const canonical  = raw.match(/rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]?.trim() ?? raw.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1]?.trim() ?? "";
  const robots     = raw.match(/name=["']robots["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() ?? "";
  const langAttr   = raw.match(/<html[^>]+lang=["']([^"']+)/i)?.[1]?.trim() ?? "";

  // ── 3. All headings H1–H4 ────────────────────────────────────────────
  const headings: string[] = [];
  const hRe = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hm;
  while ((hm = hRe.exec(raw)) !== null && headings.length < 30) {
    const t = hm[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (t.length > 1 && t.length < 200) headings.push(`H${hm[1]}: "${t}"`);
  }

  // ── 4. Paragraphs (body copy) — up to 40 meaningful ones ─────────────
  const paragraphs: string[] = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRe.exec(raw)) !== null && paragraphs.length < 40) {
    const t = pm[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (t.length > 20 && t.length < 600) paragraphs.push(`"${t}"`);
  }

  // ── 5. All CTAs: buttons + prominent links ───────────────────────────
  const ctaSet = new Set<string>();
  // Buttons
  const btnRe = /<button[^>]*>([\s\S]*?)<\/button>/gi;
  let bm;
  while ((bm = btnRe.exec(raw)) !== null && ctaSet.size < 20) {
    const t = bm[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (t.length > 1 && t.length < 80) ctaSet.add(`[BUTTON] "${t}"`);
  }
  // Links that look like CTAs (short text, not navigation)
  const aRe = /<a[^>]+href=["'][^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let am;
  while ((am = aRe.exec(raw)) !== null && ctaSet.size < 30) {
    const t = am[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (t.length > 1 && t.length < 60) ctaSet.add(`[LINK] "${t}"`);
  }

  // ── 6. Navigation ────────────────────────────────────────────────────
  const navMatch = raw.match(/<(?:nav|header)[^>]*>([\s\S]*?)<\/(?:nav|header)>/gi) ?? [];
  const navLinks: string[] = [];
  navMatch.forEach((block) => {
    const re = /<a[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(block)) !== null && navLinks.length < 15) {
      const t = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (t.length > 0 && t.length < 50) navLinks.push(`"${t}"`);
    }
  });

  // ── 7. Forms ─────────────────────────────────────────────────────────
  const formBlocks = raw.match(/<form[\s\S]*?<\/form>/gi) ?? [];
  const formDetails: string[] = [];
  formBlocks.slice(0, 4).forEach((form, i) => {
    const inputs: string[] = [];
    const inputRe = /<input[^>]*>/gi;
    let im;
    while ((im = inputRe.exec(form)) !== null) {
      const type  = im[0].match(/type=["']([^"']+)/i)?.[1] ?? "text";
      const ph    = im[0].match(/placeholder=["']([^"']+)/i)?.[1] ?? "";
      const name  = im[0].match(/name=["']([^"']+)/i)?.[1] ?? "";
      const label = ph || name || type;
      if (type !== "hidden") inputs.push(`${type}:"${label}"`);
    }
    const textarea = (form.match(/<textarea/gi) ?? []).length;
    const selects  = (form.match(/<select/gi) ?? []).length;
    const submitBtn = form.match(/<(?:button|input[^>]+type=["']submit)/i)?.[0] ?? "";
    const submitText = submitBtn.match(/value=["']([^"']+)/i)?.[1] ?? submitBtn.match(/>([\s\S]*?)<\/button>/i)?.[1]?.replace(/<[^>]+>/g,"").trim() ?? "submit";
    formDetails.push(`Form ${i+1}: fields=[${inputs.join(", ")}] textareas=${textarea} selects=${selects} submit="${submitText}"`);
  });

  // ── 8. Images ────────────────────────────────────────────────────────
  const allImgs = raw.match(/<img[^>]*>/gi) ?? [];
  const imgTotal = allImgs.length;
  const missingAlt = allImgs.filter(i => !/alt=["'][^"']{1,}/i.test(i)).length;
  const emptyAlt   = allImgs.filter(i => /alt=["']\s*["']/i.test(i)).length;
  // Sample of img src/alt for context
  const imgSamples: string[] = [];
  allImgs.slice(0, 8).forEach((img) => {
    const src = img.match(/src=["']([^"']{1,80})/i)?.[1] ?? "";
    const alt = img.match(/alt=["']([^"']*)/i)?.[1] ?? "(missing)";
    if (src) imgSamples.push(`src="${src.split("/").pop()}" alt="${alt}"`);
  });

  // ── 9. Technical signals ─────────────────────────────────────────────
  const hasViewport   = /name=["']viewport["']/i.test(raw);
  const hasCharset    = /charset=/i.test(raw);
  const hasCanonical  = canonical.length > 0;
  const hasFavicon    = /rel=["'](?:shortcut )?icon["']/i.test(raw);
  const hasSchema     = /<script[^>]+type=["']application\/ld\+json["']/i.test(raw);
  const hasLazyLoad   = /loading=["']lazy["']/i.test(raw);
  const hasSitemap    = /sitemap/i.test(raw);
  const hasAnalytics  = /gtag|google-analytics|_ga|plausible|mixpanel|segment|hotjar|clarity/i.test(raw);
  const hasCookieBanner = /cookie|gdpr|consent/i.test(raw);
  const httpsUsed     = url.startsWith("https://");
  const scriptCount   = (raw.match(/<script/gi) ?? []).length;
  const asyncScripts  = (raw.match(/async|defer/gi) ?? []).length;
  const inlineStyles  = (raw.match(/style="/gi) ?? []).length;
  const cssFiles      = (raw.match(/rel=["']stylesheet["']/gi) ?? []).length;

  // ── 10. Social proof signals ─────────────────────────────────────────
  const hasTestimonials = /testimonial|review|rating|stars|customer|client|said|says/i.test(stripped);
  const hasPricing      = /pricing|plan|per month|\/mo|billed|subscribe|free trial/i.test(stripped);
  const hasFAQ          = /faq|frequently asked|question/i.test(stripped);
  const hasVideo        = /<(?:video|iframe)[^>]+(?:youtube|vimeo|src)/i.test(raw);
  const hasTrustBadges  = /ssl|secure|guarantee|certified|award|trusted|verified/i.test(stripped);

  // ── 11. Full visible text (up to 4000 chars) ─────────────────────────
  const visibleText = stripped.slice(0, 4000);

  return `=== FULL PAGE ANALYSIS: ${url} ===

--- 1. SEO META TAGS ---
<title>: ${metaTitle || "❌ MISSING"}
meta description: ${metaDesc ? `"${metaDesc}"` : "❌ MISSING"}
OG title: ${ogTitle ? `"${ogTitle}"` : "missing"}
OG description: ${ogDesc ? `"${ogDesc}"` : "missing"}
OG image: ${ogImage || "missing"}
Twitter card: ${twitterCard || "missing"}
Canonical URL: ${canonical || "❌ MISSING"}
Robots meta: ${robots || "not set"}
HTML lang attr: ${langAttr || "❌ MISSING"}

--- 2. ALL HEADINGS (${headings.length} found) ---
${headings.length ? headings.join("\n") : "❌ NO HEADINGS FOUND"}

--- 3. BODY COPY — ALL PARAGRAPHS (${paragraphs.length} found) ---
${paragraphs.length ? paragraphs.slice(0, 25).join("\n") : "(no paragraph text found)"}

--- 4. ALL BUTTONS & CTAs (${ctaSet.size} found) ---
${ctaSet.size ? [...ctaSet].join("\n") : "❌ NO BUTTONS OR CTAs FOUND"}

--- 5. NAVIGATION LINKS (${navLinks.length} found) ---
${navLinks.length ? navLinks.join(", ") : "(no nav found)"}

--- 6. FORMS (${formBlocks.length} found) ---
${formDetails.length ? formDetails.join("\n") : "(no forms found)"}

--- 7. IMAGES (${imgTotal} total) ---
Missing alt text: ${missingAlt}
Empty alt text: ${emptyAlt}
Lazy loading: ${hasLazyLoad ? "yes" : "no"}
Samples: ${imgSamples.join(" | ") || "(none)"}

--- 8. TECHNICAL ---
HTTPS: ${httpsUsed ? "✅ yes" : "❌ NO"}
Viewport meta: ${hasViewport ? "✅" : "❌ MISSING"}
Charset meta: ${hasCharset ? "✅" : "❌ MISSING"}
Canonical tag: ${hasCanonical ? "✅" : "❌ MISSING"}
Favicon: ${hasFavicon ? "✅" : "❌ MISSING"}
Schema/JSON-LD: ${hasSchema ? "✅ present" : "❌ none"}
Total <script> tags: ${scriptCount} (${asyncScripts} use async/defer)
Inline style attrs: ${inlineStyles}
CSS files linked: ${cssFiles}
Analytics detected: ${hasAnalytics ? "✅ yes" : "❌ no"}
Cookie/GDPR banner: ${hasCookieBanner ? "present" : "not detected"}
Sitemap ref: ${hasSitemap ? "found" : "not found"}

--- 9. CONTENT QUALITY SIGNALS ---
Has testimonials/reviews: ${hasTestimonials ? "✅ yes" : "❌ no"}
Has pricing section: ${hasPricing ? "✅ yes" : "no"}
Has FAQ section: ${hasFAQ ? "✅ yes" : "no"}
Has video content: ${hasVideo ? "✅ yes" : "no"}
Has trust badges/security: ${hasTrustBadges ? "✅ yes" : "no"}

--- 10. FULL VISIBLE TEXT (first 4000 chars) ---
${visibleText}`;
}

// ── Prompt ────────────────────────────────────────────────────────────────

function buildPrompt(url: string, html: string, currentScore: number, hasScreenshot: boolean): string {
  const pageContent = extractPageContent(html, url);

  // How many points this batch of tasks should cover: 55-65% of the gap,
  // shrinks as score climbs (diminishing returns). Never more than 30 pts total.
  const gap = 100 - currentScore;
  const batchCoverage = Math.min(30, Math.round(gap * (currentScore < 50 ? 0.65 : currentScore < 75 ? 0.55 : 0.40)));
  const taskCount = currentScore >= 85 ? "3-5" : currentScore >= 70 ? "5-8" : "6-10";
  const maxImpact = currentScore >= 80 ? 4 : currentScore >= 60 ? 6 : 8;

  const screenshotNote = hasScreenshot
    ? `You have been provided with a full-page screenshot of the website as it appears in a real browser with JavaScript fully loaded. Use what you SEE in the screenshot as your primary source of truth — the visual layout, above-the-fold content, colours, spacing, readability, and any UI elements that may not appear in static HTML.`
    : `No screenshot was available — rely on the extracted HTML content below.`;

  return `You are a world-class UX, SEO, performance, and conversion-rate expert. You have just crawled a website and captured a real browser screenshot.

Website URL: ${url}
Current optimization score: ${currentScore}/100

${screenshotNote}

${pageContent}

---

Your job:
1. Evaluate the website across 6 categories: UX, Performance, SEO, Copy, Conversion, Accessibility
2. Assign a new overall score from 0-100 (where 100 = theoretically perfect, almost never reached)
3. Generate a list of SPECIFIC, DATA-DRIVEN improvement tasks for THIS round only

CRITICAL rules for tasks:
- Every task MUST reference actual content found on the page or visible in the screenshot. Examples:
  ✓ "Your H1 reads 'Welcome to our site' — rewrite it to communicate your core value proposition"
  ✓ "CTA button says 'Submit' — change it to a benefit-driven label like 'Get my free quote'"
  ✓ "Meta description is missing — add a 150-160 char description targeting your main keyword"
  ✓ "X images are missing alt text — add descriptive alt attributes to each"
  ✓ "The hero section (visible in screenshot) has no clear value proposition above the fold"
  ✗ NEVER write vague tasks like "improve your design" or "make CTAs more compelling" without quoting the actual current text
- Generate ${taskCount} tasks for this round
- Each task has an impact_score between 1 and ${maxImpact} points
- The sum of ALL task impact_scores must equal EXACTLY ${batchCoverage}
- Do NOT try to cover the full gap to 100 — improvement is iterative, there are always more things to fix
- Focus on the highest-priority issues first (biggest impact for least effort)
- Categories: "ux" | "performance" | "seo" | "copy" | "conversion" | "accessibility"

IMPORTANT: Respond ONLY with valid JSON, no markdown, no explanation:
{
  "score": <integer 0-100>,
  "summary": "<2-3 sentence assessment referencing actual page content and visual elements you observed>",
  "tasks": [
    {
      "title": "<short action title max 8 words>",
      "description": "<quote the specific existing text/element or describe what you saw in the screenshot, explain the exact problem, suggest the concrete fix — 2-3 sentences>",
      "category": "<ux|performance|seo|copy|conversion|accessibility>",
      "impact_score": <integer 1-${maxImpact}>
    }
  ]
}`;
}

// ── Route ─────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 5 website analyses per hour per user (expensive — screenshot + Claude vision)
  const rl = checkRateLimit(`website-analyze:${user.id}`, 5, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many analysis requests. Please wait before analyzing again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const db = createServiceClient();

  // 1. Get website profile
  const { data: profile, error: profileErr } = await db
    .from("website_profiles")
    .select("id, url, score")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "No website URL found. Add your website first." }, { status: 400 });
  }

  // 2. Mark as analyzing
  await db
    .from("website_profiles")
    .update({ analysis_status: "analyzing", analysis_error: null })
    .eq("user_id", user.id);

  try {
    // 3. Fetch website HTML + screenshot in parallel
    const [html, screenshot] = await Promise.all([
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const res = await fetch(profile.url, {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; FoldBot/1.0)" },
          });
          clearTimeout(timeout);
          return await res.text();
        } catch {
          return `<!-- Could not fetch HTML from ${profile.url} — analyzing URL structure and domain only -->`;
        }
      })(),
      captureScreenshot(profile.url),
    ]);

    // 4. Build Claude message — include screenshot as vision if available
    const userContent: Anthropic.MessageParam["content"] = [];

    if (screenshot) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: screenshot.mediaType,
          data: screenshot.base64,
        },
      });
    }

    userContent.push({
      type: "text",
      text: buildPrompt(profile.url, html, profile.score ?? 0, !!screenshot),
    });

    // 5. Call Claude with vision
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: userContent }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    // 6. Parse JSON response
    let parsed: {
      score: number;
      summary: string;
      tasks: { title: string; description: string; category: string; impact_score: number }[];
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON if Claude added any surrounding text
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Claude returned invalid JSON");
      parsed = JSON.parse(match[0]);
    }

    // Clamp score
    const newScore = Math.min(100, Math.max(0, Math.round(parsed.score)));

    // 7. Delete old pending tasks (keep completed ones for history)
    await db
      .from("website_tasks")
      .delete()
      .eq("user_id", user.id)
      .eq("completed", false);

    // 8. Insert new tasks
    const taskRows = parsed.tasks.map((t) => ({
      user_id: user.id,
      title: t.title,
      description: t.description,
      category: t.category,
      impact_score: Math.min(20, Math.max(1, Math.round(t.impact_score))),
    }));

    if (taskRows.length > 0) {
      await db.from("website_tasks").insert(taskRows);
    }

    // 9. Update profile with new score + status
    await db
      .from("website_profiles")
      .update({
        score: newScore,
        description: parsed.summary,
        analysis_status: "done",
        last_scanned_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, score: newScore, summary: parsed.summary, taskCount: taskRows.length, screenshotUsed: !!screenshot });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .from("website_profiles")
      .update({ analysis_status: "error", analysis_error: msg })
      .eq("user_id", user.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
