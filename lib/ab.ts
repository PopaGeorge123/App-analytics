/**
 * A/B Testing — Hero section variants
 *
 * ICP: Shopify / WooCommerce store owners doing $5K–$100K/month.
 * They run Meta Ads, have GA4 connected, use Klaviyo or Mailchimp,
 * and manually check 5 separate dashboards to piece together what happened.
 * They can't tell which ads are actually profitable vs. which are burning budget.
 * Revenue drops go unnoticed for days. Dead stock piles up silently.
 *
 * Strategy: Aspirin over vitamin — lead with the acute, bleeding pain.
 * Each variant attacks a different pain point to surface the best-performing angle.
 *
 * Variant assignment:
 *   - Assigned once in middleware (fold_ab cookie, 90-day TTL)
 *   - Read server-side in page.tsx — zero layout shift
 *   - Tracked via gtag custom event on client mount
 */

export type AbVariant = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i";

export interface HeroCopy {
  /** Narrow badge above the headline */
  //badge: string;
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
    //badge: "Most shop owners have heavy traffic, but no sales",
    badgeColor: "red",
    headline: "You're losing sales and ",
    headlineAccent: "that kills your business.",
    sub: `Fix your funnels before your business gets bankrupt.`,
    cta: "Find my revenue leaks",
  },

  /**
   * B — THE MONDAY RITUAL
   * Pain: wasted time, piecing together 5 tabs manually every week
   * Aspirin: replace the ritual with one live view
   */
  b: {
    //badge: "You'll spend 40 minutes on 5 tabs this Monday. Again.",
    badgeColor: "amber",
    headline: "Stop spending money on ads when",
    headlineAccent: "your funnels are broken.",
    sub: `Fold connects {integrations}+ live integrations into Fold and shows where your funnels are broken.`,
    cta: "Fix my funnels now",
  },

  /**
   * C — THE FRIDAY DISCOVERY
   * Pain: you only find out a revenue drop happened days later
   * Aspirin: real-time anomaly detection with explanations
   */
  c: {
    //badge: "Revenue dropped Tuesday. You'll find out Friday.",
    badgeColor: "red",
    headline: "Your business is bleeding money, ",
    headlineAccent: "and you don't even know it.",
    sub: `By the time you fix your funnel, your store has already lost thousands of dollars.`,
    cta: "Find my revenue leaks",
  },

  /**
   * D — WASTED AD SPEND
   * Pain: paying for ads with no idea if they're generating revenue
   * Aspirin: real ROAS / CAC attribution linking Stripe ↔ Meta
   */
  d: {
    //badge: "Most founders can't tell if their ads are actually making money",
    badgeColor: "orange",
    headline: "You're geting visitors, ",
    headlineAccent: "but no one buys.",
    sub: `Fold connects all your store data and fixes your funnels.`,
    cta: "Fix my funnels now",
  },

  /**
   * E — NO ANALYST, NO TIME
   * Pain: can't afford an analyst, no time to dig into data
   * Aspirin: AI does the analysis and tells you what to do in plain English
   */
  e: {
    //badge: "Built for founders who don't have time to be analysts",
    badgeColor: "teal",
    headline: "Every answer. ",
    headlineAccent: "Zero guesswork.",
    sub: `You don't have time to spend finding your store conversion bottlenecks. Fold's AI analyzes your data and tells you exactly how to fix them.`,
    cta: "Double my conversion rate",
  },

  /**
   * F — REVENUE LEAK DETECTION
   * Pain: Silent revenue leaks eating profit
   * Aspirin: AI finds and fixes leaks automatically
   */
  f: {
    //badge: "Most founders have a $5K+/mo revenue leak they don't see",
    badgeColor: "red",
    headline: "Your business is leaking money. ",
    headlineAccent: "AI will find it in 2 minutes.",
    sub: `Connect your store data and Fold's AI will automatically find and fix your biggest revenue leaks`,
    cta: "Stop loosing money",
  },

  /**
   * G — AD ATTRIBUTION TRUTH
   * Pain: Wasting ad budget on unprofitable campaigns
   * Aspirin: True ROAS linking spend → revenue
   */
  g: {
    //badge: "Your ad platforms are lying about which campaigns make money",
    badgeColor: "orange",
    headline: "You're getting visitors, ",
    headlineAccent: "but no one buys.",
    sub: `Fold fixes your funnels and doubles your conversion rate so you double your revenue.`,
    cta: "Double my revenue",
  },

  /**
   * H — ECOMMERCE: AD PROFIT QUESTION
   * Pain: Running Meta/Google ads but no clear picture of profit per campaign
   * Aspirin: Fold answers the exact question e-commerce owners care about most
   */
  h: {
    //badge: "Most Shopify stores can't tell which ads are actually profitable",
    badgeColor: "orange",
    headline: "You're running ads, ",
    headlineAccent: "but your store has a conversion problem.",
    sub: `Fold connects all your store data, finds the conversion leaks, and fixes your conversion rate so you can grow profitably.`,
    cta: "Fix my conversion problem",
  },

  /**
   * I — ECOMMERCE: MORNING BRIEFING
   * Pain: Scattered data across Shopify, Meta, Klaviyo — no unified morning view
   * Aspirin: One daily briefing with the 3 things that matter
   */
  i: {
    //badge: "Know your store's health in 30 seconds every morning",
    badgeColor: "teal",
    headline: "You launched your store and need to",
    headlineAccent: "increase your conversion.",
    sub: `Fold connects all your store data and gives you simple detailed insights so you can focus on growing your business instead of digging through data.`,
    cta: "Increase my conversion",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** All valid variant keys — used for random assignment and validation */
export const AB_VARIANTS: AbVariant[] = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

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
