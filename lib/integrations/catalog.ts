// ─────────────────────────────────────────────────────────────────────────────
// Integration Catalog  (e-commerce focused)
// "live" = OAuth/API connection is implemented and syncs data
// "soon" = UI card only, connection not yet built
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrationStatus = "live" | "soon";

export type IntegrationCategory =
  | "E-commerce Stores"
  | "Payments & Checkout"
  | "Advertising"
  | "Web & Store Analytics"
  | "Email & SMS Marketing"
  | "Inventory & Operations";

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
  // ═══════════════════════════════════════════════════════════════════════════
  // E-COMMERCE STORES — primary revenue data sources
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "shopify",
    name: "Shopify",
    description: "GMV, orders, AOV, refund rate & top products",
    category: "E-commerce Stores",
    color: "#96bf48",
    status: "live",
    connectUrl: "/api/auth/shopify/url",
    icon: "/integrations/shopify.svg",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "WordPress store orders, products & revenue",
    category: "E-commerce Stores",
    color: "#7f54b3",
    status: "live",
    connectUrl: "/api/auth/woocommerce/url",
    icon: "/integrations/woocommerce.svg",
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    description: "Multi-channel store orders, catalog & revenue",
    category: "E-commerce Stores",
    color: "#34313F",
    status: "soon",
    connectUrl: "/api/auth/bigcommerce/url",
    icon: "/integrations/bigcommerce.svg",
  },
  {
    id: "amazon-seller",
    name: "Amazon Seller",
    description: "Marketplace sales, fees, returns & buy-box rate",
    category: "E-commerce Stores",
    color: "#FF9900",
    status: "soon",
    connectUrl: "/api/auth/amazon-seller/url",
    icon: "/integrations/amazon-seller.svg",
  },
  {
    id: "etsy",
    name: "Etsy",
    description: "Shop orders, views, conversion rate & top listings",
    category: "E-commerce Stores",
    color: "#F56400",
    status: "soon",
    connectUrl: "/api/auth/etsy/url",
    icon: "/integrations/etsy.svg",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADVERTISING — paid traffic & ROAS tracking
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "meta",
    name: "Meta Ads",
    description: "Ad spend, ROAS, CPP, add-to-carts & campaign breakdown",
    category: "Advertising",
    color: "#1877f2",
    status: "live",
    connectUrl: "/api/auth/meta/url",
    icon: "/integrations/meta.svg",
  },
  {
    id: "google-ads",
    name: "Google Ads",
    description: "Shopping, Search & Display spend with purchase ROAS",
    category: "Advertising",
    color: "#4285F4",
    status: "soon",
    connectUrl: "/api/auth/google-ads/url",
    icon: "/integrations/google-ads.svg",
  },
  {
    id: "tiktok-ads",
    name: "TikTok Ads",
    description: "TikTok campaign spend, video views & purchase ROAS",
    category: "Advertising",
    color: "#010101",
    status: "soon",
    connectUrl: "/api/auth/tiktok-ads/url",
    icon: "/integrations/tiktok-ads.svg",
  },
  {
    id: "pinterest-ads",
    name: "Pinterest Ads",
    description: "Promoted Pin spend, saves, checkouts & ROAS",
    category: "Advertising",
    color: "#E60023",
    status: "soon",
    connectUrl: "/api/auth/pinterest-ads/url",
    icon: "/integrations/pinterest-ads.svg",
  },
  {
    id: "snapchat-ads",
    name: "Snapchat Ads",
    description: "Snap campaign spend, swipe-ups & purchase events",
    category: "Advertising",
    color: "#FFFC00",
    status: "soon",
    connectUrl: "/api/auth/snapchat-ads/url",
    icon: "/integrations/snapchat-ads.svg",
  },
  {
    id: "twitter-ads",
    name: "X (Twitter) Ads",
    description: "Promoted post spend, clicks & conversion tracking",
    category: "Advertising",
    color: "#000000",
    status: "soon",
    connectUrl: "/api/auth/twitter-ads/url",
    icon: "/integrations/twitter-ads.svg",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB & STORE ANALYTICS — traffic, funnel & on-site behavior
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "ga4",
    name: "Google Analytics 4",
    description: "Sessions, add-to-carts, checkout funnel & purchase revenue",
    category: "Web & Store Analytics",
    color: "#4285F4",
    status: "live",
    connectUrl: "/api/auth/google/url",
    icon: "/integrations/ga4.svg",
  },
  {
    id: "plausible",
    name: "Plausible",
    description: "Privacy-first store traffic, referrers & goal events",
    category: "Web & Store Analytics",
    color: "#5850ec",
    status: "live",
    connectUrl: "/dashboard?tab=data-sources&connect=plausible",
    icon: "/integrations/plausible.svg",
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Session replays, funnel analysis & heatmaps",
    category: "Web & Store Analytics",
    color: "#f76300",
    status: "live",
    connectUrl: "/dashboard?tab=data-sources&connect=posthog",
    icon: "/integrations/posthog.svg",
  },
  {
    id: "fathom",
    name: "Fathom",
    description: "Cookie-free, GDPR-compliant store analytics",
    category: "Web & Store Analytics",
    color: "#9333ea",
    status: "soon",
    connectUrl: "/api/auth/fathom/url",
    icon: "/integrations/fathom.svg",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EMAIL & SMS MARKETING — owned channel performance & attribution
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "klaviyo",
    name: "Klaviyo",
    description: "Email & SMS flows, attributed revenue & list growth",
    category: "Email & SMS Marketing",
    color: "#46B37D",
    status: "live",
    connectUrl: "/api/auth/klaviyo/url",
    icon: "/integrations/klaviyo.svg",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Email campaigns, opens, clicks & e-commerce revenue",
    category: "Email & SMS Marketing",
    color: "#FFE01B",
    status: "live",
    connectUrl: "/api/auth/mailchimp/url",
    icon: "/integrations/mailchimp.svg",
  },
  {
    id: "activecampaign",
    name: "ActiveCampaign",
    description: "Email automation, SMS & attributed purchase revenue",
    category: "Email & SMS Marketing",
    color: "#356AE6",
    status: "soon",
    connectUrl: "/api/auth/activecampaign/url",
    icon: "/integrations/activecampaign.svg",
  },
  {
    id: "brevo",
    name: "Brevo",
    description: "Email, SMS & WhatsApp campaigns with revenue tracking",
    category: "Email & SMS Marketing",
    color: "#0092FF",
    status: "soon",
    connectUrl: "/dashboard?tab=data-sources&connect=brevo",
    icon: "/integrations/brevo.svg",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS & CHECKOUT — transaction-level revenue data
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "stripe",
    name: "Stripe",
    description: "Gross revenue, AOV, refund rate & dispute tracking",
    category: "Payments & Checkout",
    color: "#635bff",
    status: "live",
    connectUrl: "/api/auth/stripe/url",
    icon: "/integrations/stripe.svg",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "PayPal checkout revenue, fees & dispute rate",
    category: "Payments & Checkout",
    color: "#003087",
    status: "soon",
    connectUrl: "/api/auth/paypal/url",
    icon: "/integrations/paypal.svg",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INVENTORY & OPERATIONS — supply chain & fulfillment health
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "shipstation",
    name: "ShipStation",
    description: "Fulfillment speed, shipping costs & carrier performance",
    category: "Inventory & Operations",
    color: "#4B94D8",
    status: "soon",
    connectUrl: "/api/auth/shipstation/url",
    icon: "/integrations/shipstation.svg",
  },
  {
    id: "gorgias",
    name: "Gorgias",
    description: "Support ticket volume, CSAT & revenue from support",
    category: "Inventory & Operations",
    color: "#6E45E2",
    status: "soon",
    connectUrl: "/api/auth/gorgias/url",
    icon: "/integrations/gorgias.svg",
  },
  {
    id: "recharge",
    name: "Recharge",
    description: "Subscription box orders, churn & LTV",
    category: "Inventory & Operations",
    color: "#F4A01C",
    status: "soon",
    connectUrl: "/api/auth/recharge/url",
    icon: "/integrations/recharge.svg",
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
// Revenue providers → SUM revenue across all (additive; you earned $X from each).
// Analytics providers → use PRIMARY source (sessions can't be summed — double-counts).
// Ads providers → SUM spend across all (genuinely additive; you spent $X on each).

export const REVENUE_PROVIDERS: string[] = INTEGRATIONS_CATALOG
  .filter((i) => i.category === "Payments & Checkout" || i.category === "E-commerce Stores")
  .map((i) => i.id);

export const ANALYTICS_PROVIDERS: string[] = INTEGRATIONS_CATALOG
  .filter((i) => i.category === "Web & Store Analytics")
  .map((i) => i.id);

export const ADS_PROVIDERS: string[] = INTEGRATIONS_CATALOG
  .filter((i) => i.category === "Advertising")
  .map((i) => i.id);
