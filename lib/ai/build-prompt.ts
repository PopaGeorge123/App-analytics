import type { DigestContext } from "./build-context";

export function buildSystemPrompt(context?: DigestContext): string {
  const profile = context?.businessProfile;

  const businessContext = profile && (profile.businessDescription || profile.industry)
    ? `
BUSINESS CONTEXT:
${profile.businessDescription ? `- Description: ${profile.businessDescription}` : ""}
${profile.industry ? `- Industry: ${profile.industry}` : ""}
${profile.employeeCount ? `- Team size: ${profile.employeeCount}` : ""}
${profile.monthlyRevenue ? `- Reported monthly revenue range: ${profile.monthlyRevenue}` : ""}
${profile.websiteUrl ? `- Website: ${profile.websiteUrl}` : ""}

Use this context to calibrate all analysis. Tailor benchmarks, anomaly thresholds, and recommendations to what is realistic for an e-commerce business of this type and stage. Do not repeat this context verbatim in your output.
`
    : "";

  return `You are a business analyst AI embedded in Fold, a business intelligence tool for e-commerce founders.

Your job is to analyze data from Stripe, Shopify, Google Analytics, Meta Ads, and email platforms to generate a daily digest focused on e-commerce performance.
${businessContext}
RULES:
- Be specific. Always reference actual numbers, never vague statements.
- Be direct. This is a busy founder — no fluff, no filler.
- E-commerce focus: prioritize GMV, AOV, ROAS, refund rates, cart abandonment, and repeat purchase patterns.
- Causation vs correlation: if you're not sure why something happened, say so explicitly. Never present a guess as a fact.
- Cross-platform thinking: the most valuable insights connect data across platforms (e.g., ad spend → ROAS → store revenue → refunds).
- One action only: end with exactly one prioritized action, not a list.
- Uncertainty is honest: if data is missing or insufficient, say so rather than filling gaps.

OUTPUT FORMAT: Respond only in valid JSON. No markdown, no extra text.

{
  "summary": "2-3 sentence plain English overview of the week's e-commerce performance",
  "highlights": [
    {
      "metric": "metric name",
      "value": "formatted value",
      "trend": "up | down | flat",
      "change": "% or absolute vs last week",
      "context": "one sentence explaining what this means for the business"
    }
  ],
  "anomalies": [
    {
      "title": "short title",
      "description": "what happened with specific numbers",
      "severity": "low | medium | high",
      "possibleCause": "honest assessment — say 'unclear' if unknown",
      "dataSource": "stripe | shopify | ga4 | meta | email | cross-platform"
    }
  ],
  "crossPlatformInsight": "the insight only visible by connecting data across platforms",
  "action": {
    "title": "short action title",
    "description": "specific action with expected outcome and $ impact estimate where possible",
    "priority": "high | medium | low",
    "effort": "low | medium | high"
  }
}`;
}

export function buildUserPrompt(context: DigestContext): string {
  const fmt = (n: number) => n.toLocaleString();
  const fmtCents = (n: number) => `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const trend = (t: number) => (t > 0 ? `+${t.toFixed(1)}%` : `${t.toFixed(1)}%`);
  const pct = (n: number) => `${n.toFixed(1)}%`;

  // ── Stripe section ──────────────────────────────────────────────────────
  const stripeSection = context.stripe.connected
    ? `--- STRIPE (Payments) ---
Gross revenue this week:      ${fmtCents(context.stripe.current7.grossRevenue)}
Gross revenue last week:      ${fmtCents(context.stripe.prev7.grossRevenue)}
Revenue trend:                ${trend(context.stripe.revenueTrend)}
Net revenue (after refunds):  ${fmtCents(context.stripe.current7.netRevenue)}
Avg transaction value (AOV):  ${fmtCents(context.stripe.current7.avgTransactionValue)}
AOV last week:                ${fmtCents(context.stripe.prev7.avgTransactionValue)}
AOV trend:                    ${trend(context.stripe.aovTrend)}
Refunds this week:            ${fmtCents(context.stripe.current7.refunds)}
Refund rate:                  ${pct(context.stripe.current7.refundRate)}
Transactions:                 ${fmt(context.stripe.current7.txCount)}
New customers:                ${fmt(context.stripe.current7.newCustomers)}
Dispute count:                ${context.stripe.current7.disputeCount}
Dispute amount:               ${fmtCents(context.stripe.current7.disputeAmount)}`
    : "--- STRIPE --- Not connected";

  // ── GA4 section ──────────────────────────────────────────────────────────
  const ga4Section = context.ga4.connected
    ? `--- GOOGLE ANALYTICS (Store Traffic & Funnel) ---
Sessions this week:           ${fmt(context.ga4.current7.sessions)}
Sessions last week:           ${fmt(context.ga4.prev7.sessions)}
Sessions trend:               ${trend(context.ga4.sessionsTrend)}
New users:                    ${fmt(context.ga4.current7.newUsers)}
Bounce rate:                  ${pct(context.ga4.current7.bounceRate)}
Add-to-cart events:           ${fmt(context.ga4.current7.addToCarts)}
Checkout initiations:         ${fmt(context.ga4.current7.checkouts)}
Completed purchases:          ${fmt(context.ga4.current7.ecommercePurchases)}
Purchase revenue (GA4):       $${context.ga4.current7.purchaseRevenue.toFixed(2)}
Cart → Checkout rate:         ${pct(context.ga4.current7.cartToCheckoutRate)}
Checkout → Purchase rate:     ${pct(context.ga4.current7.checkoutToPurchaseRate)}
Conversions (goals):          ${fmt(context.ga4.current7.conversions)}`
    : "--- GOOGLE ANALYTICS --- Not connected";

  // ── Meta Ads section ─────────────────────────────────────────────────────
  const currency = context.meta.currency;
  const fmtCurr = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const metaSection = context.meta.connected
    ? `--- META ADS (Advertising) ---
Currency:                     ${currency}
Ad spend this week:           ${fmtCurr(context.meta.current7.spend)}
Ad spend last week:           ${fmtCurr(context.meta.prev7.spend)}
Spend trend:                  ${trend(context.meta.spendTrend)}
Purchase value attributed:    ${fmtCurr(context.meta.current7.purchaseValue)}
ROAS this week:               ${context.meta.current7.roas.toFixed(2)}×
ROAS last week:               ${context.meta.prev7.roas.toFixed(2)}×
ROAS trend:                   ${trend(context.meta.roasTrend)}
CPC:                          ${fmtCurr(context.meta.current7.cpc)}
CPM:                          ${fmtCurr(context.meta.current7.cpm)}
CTR:                          ${pct(context.meta.current7.ctr)}
Cost per purchase:            ${fmtCurr(context.meta.current7.costPerPurchase)}
Add-to-cart clicks:           ${fmt(context.meta.current7.addToCartCount)}
Conversions (purchases):      ${fmt(context.meta.current7.conversions)}
Impressions:                  ${fmt(context.meta.current7.impressions)}`
    : "--- META ADS --- Not connected";

  // ── E-commerce stores section ─────────────────────────────────────────────
  const storeLines = context.ecommercePlatforms.map((ec) => `--- ${ec.platform.toUpperCase()} (E-commerce Store) ---
GMV this week:                ${fmtCents(ec.current7.grossRevenue)}
GMV last week:                ${fmtCents(ec.prev7.grossRevenue)}
Revenue trend:                ${trend(ec.revenueTrend)}
Orders this week:             ${fmt(ec.current7.orders)}
AOV:                          ${fmtCents(ec.current7.aov)}
AOV trend:                    ${trend(ec.aovTrend)}
New customers:                ${fmt(ec.current7.newCustomers)}
Refund rate:                  ${pct(ec.current7.refundRate)}
Cart abandonment rate:        ${pct(ec.current7.cartAbandonmentRate)}`).join("\n\n");

  const storeSection = storeLines || "--- E-COMMERCE STORES --- None connected";

  // ── Email section ──────────────────────────────────────────────────────────
  const emailSections = context.emailPlatforms.map((ep) =>
    `--- ${ep.platform.toUpperCase()} (Email Marketing) ---
Subscribers:   ${fmt(ep.current7.subscribers)} (${trend(ep.subscribersTrend)} WoW)
Emails sent:   ${fmt(ep.current7.sent)}
Open rate:     ${pct(ep.current7.openRate)}
Click rate:    ${pct(ep.current7.clickRate)}`
  ).join("\n\n");

  // ── Attribution ──────────────────────────────────────────────────────────
  const attr = context.attribution;
  const attrSection = attr.totalAdSpend > 0
    ? `--- CROSS-CHANNEL ATTRIBUTION ---
Total ad spend:               ${fmtCurr(attr.totalAdSpend)}
Total ad-attributed revenue:  ${fmtCurr(attr.totalAdAttributedRevenue)}
Blended ROAS:                 ${attr.blendedROAS !== null ? `${attr.blendedROAS.toFixed(2)}×` : "N/A"}
Blended CAC:                  ${attr.blendedCAC !== null ? fmtCurr(attr.blendedCAC) : "N/A"}
New customers this week:      ${fmt(attr.totalNewCustomers)}
Ad platforms contributing:    ${attr.adPlatforms.join(", ") || "none"}`
    : "";

  // ── Business profile ─────────────────────────────────────────────────────
  const { businessProfile: bp } = context;
  const profileSection = (bp.businessDescription || bp.industry)
    ? `--- BUSINESS CONTEXT ---
${bp.businessDescription ? `Description:      ${bp.businessDescription}` : ""}
${bp.industry          ? `Industry:         ${bp.industry}` : ""}
${bp.employeeCount     ? `Team size:        ${bp.employeeCount}` : ""}
${bp.monthlyRevenue    ? `Revenue range:    ${bp.monthlyRevenue}` : ""}
${bp.websiteUrl        ? `Website:          ${bp.websiteUrl}` : ""}`.replace(/\n+/g, "\n").trim()
    : "";

  return `Here is this week's e-commerce data for analysis:
${profileSection ? `\n${profileSection}\n` : ""}
${stripeSection}

${storeSection}

${ga4Section}

${metaSection}
${emailSections ? `\n${emailSections}` : ""}
${attrSection ? `\n${attrSection}` : ""}

Generate the daily digest based on this data. Focus on actionable e-commerce insights.`;
}
