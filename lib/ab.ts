/**
 * A/B Testing — Hero section variants
 *
 * ICP: Solo / small-team founders running SaaS or e-commerce.
 * They manually check 5 tabs every Monday, miss revenue drops until Friday,
 * and waste ad budget they can't attribute to real revenue.
 *
 * Strategy: Aspirin over vitamin — lead with the acute, bleeding pain.
 * Each variant attacks a different pain point to surface the best-performing angle.
 *
 * Variant assignment:
 *   - Assigned once in middleware (fold_ab cookie, 90-day TTL)
 *   - Read server-side in page.tsx — zero layout shift
 *   - Tracked via gtag custom event on client mount
 */

export type AbVariant = "a" | "b" | "c" | "d" | "e";

export interface HeroCopy {
  /** Narrow badge above the headline */
  badge: string;
  /** Badge dot color (Tailwind class suffix) */
  badgeColor: "red" | "amber" | "teal" | "violet" | "orange";
  /** <h1> — the make-or-break line */
  headline: string;
  /** Highlighted / colored part of the headline (rendered in accent color) */
  headlineAccent: string;
  /** Subheadline paragraph */
  sub: string;
  /** Primary CTA button */
  cta: string;
  /** Secondary ghost CTA (keep consistent or override) */
  ctaSecondary?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy variants
// ─────────────────────────────────────────────────────────────────────────────

const VARIANTS: Record<AbVariant, HeroCopy> = {
  /**
   * A — CONTROL (current live copy)
   * Pain: generic revenue leak awareness
   */
  a: {
    badge: "Most founders discover revenue leaks too late",
    badgeColor: "red",
    headline: "You're losing revenue ",
    headlineAccent: "you can't see.",
    sub: `Every day your Stripe, GA4, Meta Ads, and Shopify data sits in separate tabs, a revenue leak grows undetected. Fold connects {integrations}+ live integrations and tells you exactly what broke, why it broke, and what to fix first — before it compounds.`,
    cta: "Find my revenue leaks",
  },

  /**
   * B — THE MONDAY RITUAL
   * Pain: wasted time, piecing together 5 tabs manually every week
   * Aspirin: replace the ritual with one live view
   */
  b: {
    badge: "You'll spend 40 minutes on 5 tabs this Monday. Again.",
    badgeColor: "amber",
    headline: "Stop opening 5 tabs to understand ",
    headlineAccent: "your own business.",
    sub: `Stripe. GA4. Meta Ads. Shopify. Mailchimp. Every Monday you piece them together — and still aren't confident you have the full picture. Fold connects {integrations}+ live integrations into one dashboard that tells you exactly what changed, why, and what to fix first. Check-in done in 30 seconds.`,
    cta: "Replace my 5-tab Monday",
  },

  /**
   * C — THE FRIDAY DISCOVERY
   * Pain: you only find out a revenue drop happened days later
   * Aspirin: real-time anomaly detection with explanations
   */
  c: {
    badge: "Revenue dropped Tuesday. You'll find out Friday.",
    badgeColor: "red",
    headline: "Your revenue is dropping ",
    headlineAccent: "and you don't know yet.",
    sub: `By the time you open your dashboards, the damage is compounding. Fold watches your Stripe, GA4, Meta Ads, and Shopify 24/7 — and alerts you the moment something breaks, with the exact reason in plain English. Catch it in hours, not days.`,
    cta: "Catch my next revenue drop early",
  },

  /**
   * D — WASTED AD SPEND
   * Pain: paying for ads with no idea if they're generating revenue
   * Aspirin: real ROAS / CAC attribution linking Stripe ↔ Meta
   */
  d: {
    badge: "Most founders can't tell if their ads are actually making money",
    badgeColor: "orange",
    headline: "You're spending on ads ",
    headlineAccent: "that might be losing money.",
    sub: `Without connecting your Meta Ads spend to real Stripe revenue, you're optimizing for clicks — not cash. Fold links your ad campaigns directly to payments, shows real ROAS and CAC daily, and tells you exactly which campaigns to scale and which to kill.`,
    cta: "Show me my real ad ROI",
  },

  /**
   * E — NO ANALYST, NO TIME
   * Pain: can't afford an analyst, no time to dig into data
   * Aspirin: AI does the analysis and tells you what to do in plain English
   */
  e: {
    badge: "Built for founders who don't have time to be analysts",
    badgeColor: "teal",
    headline: "Every answer. ",
    headlineAccent: "Zero spreadsheets.",
    sub: `You didn't start a business to live in dashboards. Fold pulls from {integrations}+ live integrations, runs the analysis automatically, and delivers one plain-English summary every morning: what changed, what's at risk, and exactly what to do next. No analyst. No guesswork.`,
    cta: "Get my daily business briefing",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** All valid variant keys — used for random assignment and validation */
export const AB_VARIANTS: AbVariant[] = ["a", "b", "c", "d", "e"];

/**
 * Returns a random variant key, weighted equally (20% each).
 * Call this once in middleware and persist in cookie.
 */
export function randomVariant(): AbVariant {
  const idx = Math.floor(Math.random() * AB_VARIANTS.length);
  return AB_VARIANTS[idx];
}

/**
 * Returns the copy for a given variant key.
 * Falls back to control (a) if the cookie value is invalid.
 */
export function getHeroCopy(variant: string | undefined): HeroCopy & { variant: AbVariant } {
  const key = (variant ?? "a") as AbVariant;
  const copy = VARIANTS[key] ?? VARIANTS["a"];
  return { ...copy, variant: key };
}

export const AB_COOKIE = "fold_ab";
export const AB_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
