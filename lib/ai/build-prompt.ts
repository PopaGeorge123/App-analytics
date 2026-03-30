import type { DigestContext } from "./build-context";

export function buildSystemPrompt(): string {
  return `You are a business analyst AI embedded in Fold, a business intelligence tool for small business founders.

Your job is to analyze data from Stripe, Google Analytics, and Meta Ads and generate a daily digest.

RULES:
- Be specific. Always reference actual numbers, never vague statements.
- Be direct. This is a busy founder — no fluff, no filler.
- Causation vs correlation: if you're not sure why something happened, say so explicitly. Never present a guess as a fact.
- Cross-platform thinking: the most valuable insights connect data across platforms.
- One action only: end with exactly one prioritized action, not a list.
- Uncertainty is honest: if data is missing or insufficient, say so rather than filling gaps.

OUTPUT FORMAT: Respond only in valid JSON. No markdown, no extra text.

{
  "summary": "2-3 sentence plain English overview of the week",
  "highlights": [
    {
      "metric": "metric name",
      "value": "formatted value",
      "trend": "up | down | flat",
      "change": "% or absolute vs last week",
      "context": "one sentence explaining what this means"
    }
  ],
  "anomalies": [
    {
      "title": "short title",
      "description": "what happened with specific numbers",
      "severity": "low | medium | high",
      "possibleCause": "honest assessment — say 'unclear' if unknown",
      "dataSource": "stripe | ga4 | meta | cross-platform"
    }
  ],
  "crossPlatformInsight": "the insight only visible across all three platforms",
  "action": {
    "title": "short action title",
    "description": "specific action with expected outcome",
    "priority": "high | medium | low",
    "effort": "low | medium | high"
  }
}`;
}

export function buildUserPrompt(context: DigestContext): string {
  const fmt = (n: number) => n.toLocaleString();
  const trend = (t: number) => (t > 0 ? `+${t}%` : `${t}%`);

  const stripeSection = context.stripe.connected
    ? `--- STRIPE (Revenue) ---
Revenue this week:    $${fmt(context.stripe.current7.revenue / 100)} (in cents: ${fmt(context.stripe.current7.revenue)})
Revenue last week:    $${fmt(context.stripe.prev7.revenue / 100)}
Revenue trend:        ${trend(context.stripe.revenueTrend)}
New customers:        ${context.stripe.current7.newCustomers}
Refunds:              $${fmt(context.stripe.current7.refunds / 100)}
Transactions:         ${context.stripe.current7.txCount}`
    : "--- STRIPE --- Not connected";

  const ga4Section = context.ga4.connected
    ? `--- GOOGLE ANALYTICS (Traffic) ---
Sessions this week:   ${fmt(context.ga4.current7.sessions)}
Sessions last week:   ${fmt(context.ga4.prev7.sessions)}
Sessions trend:       ${trend(context.ga4.sessionsTrend)}
Total users:          ${fmt(context.ga4.current7.totalUsers)}
New users:            ${fmt(context.ga4.current7.newUsers)}
Bounce rate:          ${context.ga4.current7.bounceRate.toFixed(1)}%
Conversions:          ${context.ga4.current7.conversions}`
    : "--- GOOGLE ANALYTICS --- Not connected";

  const metaSection = context.meta.connected
    ? `--- META ADS (Advertising) ---
Currency:             ${context.meta.currency}
Ad spend this week:   ${new Intl.NumberFormat("en-US", { style: "currency", currency: context.meta.currency }).format(context.meta.current7.spend)}
Ad spend last week:   ${new Intl.NumberFormat("en-US", { style: "currency", currency: context.meta.currency }).format(context.meta.prev7.spend)}
Spend trend:          ${trend(context.meta.spendTrend)}
Impressions:          ${fmt(context.meta.current7.impressions)}
Clicks:               ${fmt(context.meta.current7.clicks)}
Conversions:          ${context.meta.current7.conversions}
Reach:                ${fmt(context.meta.current7.reach)}`
    : "--- META ADS --- Not connected";

  return `Here is this week's business data for analysis:

${stripeSection}

${ga4Section}

${metaSection}

Generate the daily digest based on this data.`;
}
