// ─────────────────────────────────────────────────────────────────────────────
// Integration Catalog
// "live" = OAuth/API connection is implemented and syncs data
// "soon" = UI card only, connection not yet built
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrationStatus = "live" | "soon";

export type IntegrationCategory =
  | "Payments & Revenue"
  | "Web Analytics"
  | "Advertising"
  | "Email & Marketing"
  | "E-commerce"
  | "CRM & Sales"
  | "Customer Support"
  | "Product Analytics"
  | "Social Media";

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  color: string;
  status: IntegrationStatus;
  connectUrl?: string; // only present when status === "live"
  icon: string; // Path to image in /public/integrations/ — rendered as <img src={icon} />
}

export const INTEGRATIONS_CATALOG: Integration[] = [
  // ── LIVE ──────────────────────────────────────────────────────────────────

  {
    id: "stripe",
    name: "Stripe",
    description: "Revenue, MRR, transactions & new customers",
    category: "Payments & Revenue",
    color: "#635bff",
    status: "live",
    connectUrl: "/api/auth/stripe/url",
    icon: "/integrations/stripe.svg",
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    description: "Sessions, users, bounce rate & conversions",
    category: "Web Analytics",
    color: "#4285F4",
    status: "live",
    connectUrl: "/api/auth/google/url",
    icon: "/integrations/ga4.svg",
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Ad spend, reach, clicks & ROAS",
    category: "Advertising",
    color: "#1877f2",
    status: "live",
    connectUrl: "/api/auth/meta/url",
    icon: "/integrations/meta.svg",
  },

  // ── LIVE — Payments & Revenue ─────────────────────────────────────────────
  // Paddle, Lemon Squeezy, Gumroad are staples for indie SaaS & creator ICPs.
  // PayPal is broadly used but leans DTC/freelance — bumped to soon.

  {
    id: "lemon-squeezy",
    name: "Lemon Squeezy",
    description: "Digital products & subscription revenue",
    category: "Payments & Revenue",
    color: "#FFC233",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=lemon-squeezy",
    icon: "/integrations/lemon-squeezy.svg",
  },
  {
    id: "gumroad",
    name: "Gumroad",
    description: "Creator product sales & subscription revenue",
    category: "Payments & Revenue",
    color: "#ff90e8",
    status: "live",
    connectUrl: "/api/auth/gumroad/url",
    icon: "/integrations/gumroad.svg",
  },
  {
    id: "paddle",
    name: "Paddle",
    description: "SaaS billing, subscriptions & tax",
    category: "Payments & Revenue",
    color: "#3ddc97",
    status: "live",  // Very common for indie SaaS founders — MoR model popular with small teams
    connectUrl: "/dashboard?tab=settings&connect=paddle",
    icon: "/integrations/paddle.svg",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "PayPal transactions, fees & payouts",
    category: "Payments & Revenue",
    color: "#003087",
    status: "soon",  // Less common for SaaS-first founders; DTC use case, lower priority
    connectUrl: "/api/auth/paypal/url",
    icon: "/integrations/paypal.svg",
  },

  // ── LIVE — Web Analytics ──────────────────────────────────────────────────
  // Plausible & Fathom are extremely popular with privacy-conscious indie founders.
  // PostHog is widely used for product-led SaaS. Mixpanel/Amplitude lean larger.

  {
    id: "plausible",
    name: "Plausible",
    description: "Privacy-first traffic analytics",
    category: "Web Analytics",
    color: "#5850ec",
    status: "live",  // Top choice for indie founders replacing GA4
    connectUrl: "/dashboard?tab=settings&connect=plausible",
    icon: "/integrations/plausible.svg",
  },
  {
    id: "fathom",
    name: "Fathom",
    description: "Cookie-free, GDPR-compliant analytics",
    category: "Web Analytics",
    color: "#9333ea",
    status: "soon",  // Very popular in indie hacker / bootstrapper circles
    connectUrl: "/api/auth/fathom/url",
    icon: "/integrations/fathom.svg",
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Open-source product analytics & feature flags",
    category: "Web Analytics",
    color: "#f76300",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=posthog",
    icon: "/integrations/posthog.svg",
  },
  {
    id: "mixpanel",
    name: "Mixpanel",
    description: "Event tracking, funnels & retention",
    category: "Web Analytics",
    color: "#7856ff",
    status: "soon",  // Leans mid-market; setup complexity deters solo founders
    connectUrl: "/dashboard?tab=settings&connect=mixpanel",
    icon: "/integrations/mixpanel.svg",
  },
  {
    id: "amplitude",
    name: "Amplitude",
    description: "Product analytics & behavioral cohorts",
    category: "Web Analytics",
    color: "#1e73be",
    status: "soon",  // Enterprise-oriented; smaller founder adoption than PostHog/Mixpanel
    connectUrl: "/dashboard?tab=settings&connect=amplitude",
    icon: "/integrations/amplitude.svg",
  },

  // ── LIVE — Advertising ────────────────────────────────────────────────────
  // Google Ads is essential. TikTok Ads is mainstream for DTC/creator founders.
  // LinkedIn Ads is B2B but expensive/niche at small scale — soon.
  // Snapchat/Pinterest serve very specific audiences — soon.

  {//need implementation
    id: "google-ads",
    name: "Google Ads",
    description: "Search, display & Shopping campaign spend",
    category: "Advertising",
    color: "#4285F4",
    status: "soon",  // Second most common paid channel after Meta for small founders
    connectUrl: "/api/auth/google-ads/url",
    icon: "/integrations/google-ads.svg",
  },
  {//need implementation
    id: "tiktok-ads",
    name: "TikTok Ads",
    description: "TikTok campaign spend, reach & conversions",
    category: "Advertising",
    color: "#010101",
    status: "soon",  // Mainstream for DTC & creator-economy founders
    connectUrl: "/api/auth/tiktok-ads/url",
    icon: "/integrations/tiktok-ads.svg",
  },
  {
    id: "twitter-ads",
    name: "X (Twitter) Ads",
    description: "Promoted posts, impressions & cost-per-click",
    category: "Advertising",
    color: "#000000",
    status: "soon",  // Declining ad platform adoption; low ROI reported by small advertisers
    connectUrl: "/api/auth/twitter-ads/url",
    icon: "/integrations/twitter-ads.svg",
  },
  {
    id: "linkedin-ads",
    name: "LinkedIn Ads",
    description: "B2B campaign spend, leads & engagement",
    category: "Advertising",
    color: "#0a66c2",
    status: "soon",  // High CPCs make it less common for bootstrapped founders
    connectUrl: "/api/auth/linkedin-ads/url",
    icon: "/integrations/linkedin-ads.svg",
  },
  {
    id: "snapchat-ads",
    name: "Snapchat Ads",
    description: "Snap campaign spend & story impressions",
    category: "Advertising",
    color: "#FFFC00",
    status: "soon",  // Niche audience; rarely a primary channel for indie founders
    connectUrl: "/api/auth/snapchat-ads/url",
    icon: "/integrations/snapchat-ads.svg",
  },
  {
    id: "pinterest-ads",
    name: "Pinterest Ads",
    description: "Promoted Pin spend, saves & link clicks",
    category: "Advertising",
    color: "#E60023",
    status: "soon",  // Primarily DTC/lifestyle; not broad enough for launch priority
    connectUrl: "/api/auth/pinterest-ads/url",
    icon: "/integrations/pinterest-ads.svg",
  },

  // ── LIVE — Email & Marketing ──────────────────────────────────────────────
  // Mailchimp & Klaviyo are the two highest-adoption tools in this category.
  // Kit (ConvertKit) is the #1 choice among indie creators/newsletter founders.
  // Beehiiv is fast-growing in the newsletter space.
  // ActiveCampaign & Brevo lean SMB/agency — soon.

  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Email campaigns, opens, clicks & subscribers",
    category: "Email & Marketing",
    color: "#FFE01B",
    status: "live",  // Most widely used email tool globally; high ICP overlap
    connectUrl: "/api/auth/mailchimp/url",
    icon: "/integrations/mailchimp.svg",
  },
  {//need implementation
    id: "klaviyo",
    name: "Klaviyo",
    description: "E-commerce email flows, revenue attributed",
    category: "Email & Marketing",
    color: "#1F1F20",
    status: "live",  // The standard for DTC/e-commerce founders — essential for Shopify users
    connectUrl: "/api/auth/klaviyo/url",
    icon: "/integrations/klaviyo.svg",
  },
  { //paid plan needed for app
    id: "convertkit",
    name: "Kit (ConvertKit)",
    description: "Subscriber growth, email sequences & open rates",
    category: "Email & Marketing",
    color: "#FB6970",
    status: "soon",  // #1 email tool for indie creators, newsletter founders & solopreneurs
    connectUrl: "/api/auth/convertkit/url",
    icon: "/integrations/convertkit.svg",
  },
  {
    id: "beehiiv",
    name: "Beehiiv",
    description: "Newsletter subscribers, opens & paid upgrades",
    category: "Email & Marketing",
    color: "#FC5200",
    status: "live",  // Fastest-growing newsletter platform; high overlap with Fold's ICP
    connectUrl: "/dashboard?tab=settings&connect=beehiiv",
    icon: "/integrations/beehiiv.png",
  },
  {
    id: "activecampaign",
    name: "ActiveCampaign",
    description: "Email automation, contacts & campaign revenue",
    category: "Email & Marketing",
    color: "#356AE6",
    status: "soon",  // More SMB/agency-oriented; less common among early-stage founders
    connectUrl: "/api/auth/activecampaign/url",
    icon: "/integrations/activecampaign.svg",
  },
  {
    id: "brevo",
    name: "Brevo (Sendinblue)",
    description: "Email campaigns, SMS & transactional stats",
    category: "Email & Marketing",
    color: "#0092FF",
    status: "soon",  // Lower brand awareness in English-speaking indie founder communities
    connectUrl: "/dashboard?tab=settings&connect=brevo",
    icon: "/integrations/brevo.svg",
  },

  // ── LIVE — E-commerce ─────────────────────────────────────────────────────
  // Shopify is the #1 e-commerce platform globally — must-have for DTC founders.
  // WooCommerce is #2 globally by install base.
  // Etsy is common for creator/handmade founders — live.
  // BigCommerce & Amazon Seller lean larger/enterprise — soon.

  { //not quite sure
    id: "shopify",
    name: "Shopify",
    description: "Orders, GMV, refunds & product revenue",
    category: "E-commerce",
    color: "#96bf48",
    status: "live",  // #1 DTC platform; critical for a large portion of Fold's ICP
    connectUrl: "/api/auth/shopify/url",
    icon: "/integrations/shopify.svg",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "WordPress store orders, products & revenue",
    category: "E-commerce",
    color: "#7f54b3",
    status: "live",  // #2 e-commerce platform globally; huge install base
    connectUrl: "/api/auth/woocommerce/url",
    icon: "/integrations/woocommerce.svg",
  },
  { //need implementation
    id: "etsy",
    name: "Etsy",
    description: "Handmade shop orders, views & conversion rate",
    category: "E-commerce",
    color: "#F56400",
    status: "soon",  // Relevant for creator/maker founders — a distinct Fold ICP segment
    connectUrl: "/api/auth/etsy/url",
    icon: "/integrations/etsy.svg",
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    description: "Enterprise store orders, catalog & revenue",
    category: "E-commerce",
    color: "#34313F",
    status: "soon",  // Targets larger merchants; low adoption among early-stage founders
    connectUrl: "/api/auth/bigcommerce/url",
    icon: "/integrations/bigcommerce.svg",
  },
  {
    id: "amazon-seller",
    name: "Amazon Seller",
    description: "Marketplace sales, fees & buy box metrics",
    category: "E-commerce",
    color: "#FF9900",
    status: "soon",  // Complex API & primarily used by dedicated Amazon sellers, not generalist founders
    connectUrl: "/api/auth/amazon-seller/url",
    icon: "/integrations/amazon-seller.svg",
  },

  // ── LIVE — CRM & Sales ────────────────────────────────────────────────────
  // Notion is used as a lightweight CRM by many indie founders — live.
  // HubSpot has a free tier with decent adoption — live (borderline).
  // Salesforce & Pipedrive are mid-market/enterprise-oriented — soon.

  {
    id: "notion",
    name: "Notion",
    description: "Database tables as structured business metrics",
    category: "CRM & Sales",
    color: "#000000",
    status: "soon",  // Ubiquitous among indie founders as a lightweight CRM/ops tool
    connectUrl: "/api/auth/notion/url",
    icon: "/integrations/notion.svg",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM deals, pipeline value & close rates",
    category: "CRM & Sales",
    color: "#ff7a59",
    status: "soon",  // Free CRM tier drives wide adoption; common among early-stage B2B founders
    connectUrl: "/api/auth/hubspot/url",
    icon: "/integrations/hubspot.svg",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Sales pipeline, won deals & ARR",
    category: "CRM & Sales",
    color: "#00A1E0",
    status: "soon",  // Enterprise CRM; almost never used by bootstrapped/early-stage founders
    connectUrl: "/api/auth/salesforce/url",
    icon: "/integrations/salesforce.svg",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Deals won, pipeline stages & revenue forecast",
    category: "CRM & Sales",
    color: "#30a04c",
    status: "soon",  // Sales-team-oriented; not typical for solo founders or small product teams
    connectUrl: "/api/auth/pipedrive/url",
    icon: "/integrations/pipedrive.svg",
  },

  // ── LIVE — Customer Support ───────────────────────────────────────────────
  // Intercom is the go-to for SaaS founders — live.
  // Zendesk & Freshdesk are more enterprise/support-team-oriented — soon.

  { 
    id: "intercom",
    name: "Intercom",
    description: "Support volume, resolution time & CSAT",
    category: "Customer Support",
    color: "#1f8ded",
    status: "soon",  // The default support tool for SaaS founders; also used for onboarding
    connectUrl: "/api/auth/intercom/url",
    icon: "/integrations/intercom.svg",
  },
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Ticket volume, first-response time & satisfaction",
    category: "Customer Support",
    color: "#03363D",
    status: "soon",  // Requires a dedicated support team to justify; not typical for solo founders
    connectUrl: "/api/auth/zendesk/url",
    icon: "/integrations/zendesk.svg",
  },
  {
    id: "freshdesk",
    name: "Freshdesk",
    description: "Support tickets, SLA breaches & satisfaction",
    category: "Customer Support",
    color: "#25C16F",
    status: "soon",  // Similar profile to Zendesk; lower adoption among early-stage founders
    connectUrl: "/api/auth/freshdesk/url",
    icon: "/integrations/freshdesk.svg",
  },

  // ── LIVE — Product Analytics ──────────────────────────────────────────────
  // Hotjar is extremely popular with indie founders (free tier, visual insights).
  // Segment, Heap, FullStory lean engineering-team-driven — soon.

  {
    id: "hotjar",
    name: "Hotjar",
    description: "Heatmaps, session recordings & feedback surveys",
    category: "Product Analytics",
    color: "#FD3A5C",
    status: "soon",  // Widely used by solo founders; free tier drives massive adoption
    connectUrl: "/dashboard?tab=settings&connect=hotjar",
    icon: "/integrations/hotjar.svg",
  },
  {
    id: "segment",
    name: "Segment",
    description: "Customer data pipeline & event tracking",
    category: "Product Analytics",
    color: "#52BD94",
    status: "soon",  // Requires engineering setup; used by teams, not solo founders
    connectUrl: "/api/auth/segment/url",
    icon: "/integrations/segment.svg",
  },
  {
    id: "heap",
    name: "Heap",
    description: "Auto-captured events, funnels & session replays",
    category: "Product Analytics",
    color: "#FF5B5B",
    status: "soon",  // Targets growth/product teams; less common for bootstrapped founders
    connectUrl: "/dashboard?tab=settings&connect=heap",
    icon: "/integrations/heap.svg",
  },
  {
    id: "fullstory",
    name: "FullStory",
    description: "Session replays, rage clicks & friction score",
    category: "Product Analytics",
    color: "#3B1D8E",
    status: "soon",  // Enterprise positioning; pricing excludes most solo founders
    connectUrl: "/dashboard?tab=settings&connect=fullstory",
    icon: "/integrations/fullstory.svg",
  },

  // ── LIVE — Social Media ───────────────────────────────────────────────────
  // Instagram & X Organic are the two most-tracked organic channels for founders.
  // YouTube is valuable but low priority at launch — keep soon.

  { //need implementation
    id: "instagram",
    name: "Instagram Insights",
    description: "Followers, reach, impressions & profile visits",
    category: "Social Media",
    color: "#E1306C",
    status: "soon",  // Primary organic social channel for DTC & creator founders
    connectUrl: "/api/auth/instagram/url",
    icon: "/integrations/instagram.svg",
  },
  {
    id: "twitter-organic",
    name: "X (Twitter) Analytics",
    description: "Organic impressions, profile clicks & followers",
    category: "Social Media",
    color: "#000000",
    status: "soon",  // X/Twitter is the primary founder community platform — high ICP usage
    connectUrl: "/api/auth/twitter-organic/url",
    icon: "/integrations/twitter-organic.svg",
  },
  {
    id: "youtube",
    name: "YouTube Analytics",
    description: "Views, watch time, subscribers & revenue",
    category: "Social Media",
    color: "#FF0000",
    status: "soon",  // Relevant for content creators but not broadly applicable at launch
    connectUrl: "/api/auth/youtube/url",
    icon: "/integrations/youtube.svg",
  },
];

// Helper — only live integrations (used in OverviewTab onboarding wizard)
export const LIVE_INTEGRATIONS = INTEGRATIONS_CATALOG.filter((i) => i.status === "live");
export const SOON_INTEGRATIONS = INTEGRATIONS_CATALOG.filter((i) => i.status === "soon");

// Helper — unique categories present in the catalog
export const INTEGRATION_CATEGORIES = Array.from(
  new Set(INTEGRATIONS_CATALOG.map((i) => i.category))
) as IntegrationCategory[];

// ── Provider groups by metric role ───────────────────────────────────────────
// Used for multi-provider aggregation in the dashboard.
// Revenue providers → SUM revenue across all (additive; you earned $X from each).
// Analytics providers → use PRIMARY source (page views can't be summed across tools
//   without double-counting the same visitor).
// Ads providers → SUM spend across all (genuinely additive; you spent $X on each).

export const REVENUE_PROVIDERS: string[] = INTEGRATIONS_CATALOG
  .filter((i) => i.category === "Payments & Revenue" || i.category === "E-commerce")
  .map((i) => i.id);

export const ANALYTICS_PROVIDERS: string[] = INTEGRATIONS_CATALOG
  .filter((i) => i.category === "Web Analytics" || i.category === "Product Analytics")
  .map((i) => i.id);

export const ADS_PROVIDERS: string[] = INTEGRATIONS_CATALOG
  .filter((i) => i.category === "Advertising")
  .map((i) => i.id);
