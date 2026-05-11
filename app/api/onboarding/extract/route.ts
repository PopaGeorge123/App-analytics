import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|section|article|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ")
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 5)
    .join("\n")
    .slice(0, 6000);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let url: string;
  try {
    const body = await req.json();
    url = (body.url ?? "").trim();
    if (!url) throw new Error("missing url");
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    new URL(url); // validate
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Fetch the page HTML
  let pageText = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FoldBot/1.0; +https://usefold.io)" },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const html = await res.text();
      pageText = stripHtml(html);
    }
  } catch {
    // proceed with empty content — Claude will still try based on the URL
  }

  // Ask Claude to extract business context
  const prompt = `You are analyzing a business website to extract key information that will help an AI analytics assistant understand what the business does.

Website URL: ${url}

${pageText ? `Page content (extracted text):\n${pageText}` : "Could not fetch page content — use the URL domain and structure to infer."}

Extract the following and respond ONLY with valid JSON (no markdown, no explanation):
{
  "businessName": "Company name (from the page or domain)",
  "description": "2-3 sentence description of what this business does, who their customers are, and what problem they solve. Write in second person (e.g. 'Your business...'). Keep it concise and factual.",
  "industry": "One of: SaaS, E-commerce, Agency, Media & Content, Marketplace, Consumer App, Fintech, Healthcare, Education, Other",
  "keywords": ["3-5 relevant keywords about the business"]
}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no json");
    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      businessName: parsed.businessName ?? "",
      description: parsed.description ?? "",
      industry: parsed.industry ?? "Other",
      keywords: parsed.keywords ?? [],
    });
  } catch {
    return NextResponse.json(
      { error: "Could not extract website info. Please describe your business manually." },
      { status: 422 }
    );
  }
}
