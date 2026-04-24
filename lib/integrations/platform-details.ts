// ─────────────────────────────────────────────────────────────────────────────
// Platform Transparency Details
// Used by /learn/[platform] to explain exactly how each integration works,
// what data is fetched, stored, and — critically — what is never touched.
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectionMethod = "oauth2" | "api-key" | "oauth2-or-api-key";

export interface DataField {
  field: string;        // Human-readable name
  example: string;      // Concrete example value
  purpose: string;      // Why Fold uses it
}

export interface ApiEndpoint {
  label: string;        // API method / resource name
  purpose: string;      // What Fold does with it
}

export interface DataSnapshotField {
  label: string;   // What it's called in the DB
  value: string;   // A real-looking example value
}

export interface PlatformDetail {
  id: string;
  name: string;
  tagline: string;                  // One-line description for the page hero
  color: string;
  icon: string;
  category: string;
  connectMethod: ConnectionMethod;
  connectSteps: string[];           // Step-by-step connect flow
  scopesRequested: string[];        // OAuth scopes or API key permissions
  apiEndpoints: ApiEndpoint[];      // Actual API calls Fold makes
  storedFields: DataField[];        // Fields we persist in our DB
  neverStored: string[];            // Explicit "we never store" list
  neverDoes: string[];              // Write, sell, share, etc.
  howToRevoke: {
    fromFold: string;
    fromPlatform: string;
    platformRevokeUrl: string;
  };
  dataRetention: string;
  refreshFrequency: string;
  privacyNote: string;              // Platform-specific privacy callout
  faq: { q: string; a: string }[];
  // ── New richer fields ──────────────────────────────────────────────────────
  whyFoundersConnect: string;       // Human-written 2–3 sentence explainer
  sampleSnapshot: DataSnapshotField[]; // What one day's stored record actually looks like
  apiImpact: string;                // Rate limit / quota usage note
}

export const PLATFORM_DETAILS: Record<string, PlatformDetail> = {

  // ── Stripe ────────────────────────────────────────────────────────────────
  stripe: {
    id: "stripe",
    name: "Stripe",
    tagline: "Revenue, MRR, churn and subscription data — read-only.",
    color: "#635bff",
    icon: "/integrations/stripe.svg",
    category: "Payments & Revenue",
    connectMethod: "oauth2",
    connectSteps: [
      'Click "Connect Stripe" in your Fold Settings tab.',
      "You're redirected to Stripe's own login and authorization page (stripe.com).",
      'You review the exact permissions Fold is requesting and click "Allow access".',
      "Stripe issues a scoped access token to Fold. Your password is never shared.",
      "Fold performs the initial data sync and you're done.",
    ],
    scopesRequested: [
      "read_only — grants read-only access to your Stripe account data.",
      "No write scopes are requested. Fold cannot create charges, issue refunds, or modify anything.",
    ],
    apiEndpoints: [
      { label: "GET /v1/charges", purpose: "Fetch transaction volume, amounts and counts for the current period." },
      { label: "GET /v1/subscriptions", purpose: "Read active, trialing, cancelled and past-due subscription counts." },
      { label: "GET /v1/customers", purpose: "Count new and churned customers; no PII (names, emails) is stored." },
      { label: "GET /v1/invoices", purpose: "Calculate MRR, ARR and recurring vs one-time revenue split." },
      { label: "GET /v1/products + /v1/prices", purpose: "Identify revenue by product and plan for breakdown charts." },
      { label: "GET /v1/balance_transactions", purpose: "Net revenue calculation after Stripe fees." },
      { label: "GET /v1/refunds", purpose: "Track refund rate as a health metric." },
    ],
    storedFields: [
      { field: "MRR (monthly recurring revenue)", example: "$4,200", purpose: "Core revenue KPI tile and trend chart." },
      { field: "ARR (annual recurring revenue)", example: "$50,400", purpose: "Displayed on Overview and Analytics tabs." },
      { field: "Total transactions this period", example: "143", purpose: "Volume metric on Overview tile." },
      { field: "Average transaction value", example: "$29.37", purpose: "Used in AI context for benchmarking." },
      { field: "New customers count", example: "12 this month", purpose: "Growth metric on Overview tile." },
      { field: "Churned customers count", example: "3 this month", purpose: "Churn rate calculation." },
      { field: "Revenue by product/plan", example: "Pro plan: $3,800 / Starter: $400", purpose: "Plan-level breakdown chart." },
      { field: "Refund count and total", example: "2 refunds, $58", purpose: "Refund rate health metric." },
      { field: "Failed payment count", example: "5 this month", purpose: "Dunning / revenue recovery insight." },
    ],
    neverStored: [
      "Customer names, email addresses or physical addresses",
      "Card numbers, CVV codes or any payment card data",
      "Bank account details or routing numbers",
      "Individual transaction IDs or invoice IDs",
      "Customer metadata fields",
      "Stripe secret keys or restricted keys",
      "Webhook signing secrets",
    ],
    neverDoes: [
      "Create, modify or delete charges, subscriptions or invoices",
      "Issue refunds or credits",
      "Update customer records",
      "Access your Stripe Dashboard on your behalf",
      "Share your revenue data with any third party",
      "Use your data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Stripe → Disconnect. All synced Stripe data is deleted from Fold's servers immediately.",
      fromPlatform: "Log into your Stripe Dashboard → Settings → Installed apps → Fold → Remove access.",
      platformRevokeUrl: "https://dashboard.stripe.com/settings/apps/installed",
    },
    dataRetention: "Synced metrics are kept for as long as your Fold account is active. Disconnecting Stripe or deleting your account removes all Stripe-sourced data within 24 hours.",
    refreshFrequency: "Automatic sync every 24 hours. You can trigger a manual sync from the Settings tab at any time.",
    privacyNote: "Stripe is a PCI DSS Level 1 certified payment processor. Fold never has access to raw card data — that data never leaves Stripe's infrastructure. The access token Fold receives is read-only and scoped to aggregated business metrics only.",
    faq: [
      {
        q: "Can Fold see my customers' names or email addresses?",
        a: "No. We call the Stripe API with read-only scopes but we only store aggregate counts (e.g. '12 new customers this month'). We do not store any individual customer records, PII or contact information.",
      },
      {
        q: "Can Fold charge my customers or issue refunds?",
        a: "Absolutely not. We only request read_only OAuth scope. Stripe's own API enforcement prevents any write operations with our token.",
      },
      {
        q: "What if I revoke access on the Stripe side?",
        a: "Your integration will show as disconnected in Fold and syncs will stop. No data can be read after revocation. The data already synced stays in your Fold account until you disconnect from Fold's Settings tab.",
      },
      {
        q: "Is my Stripe secret key stored?",
        a: "No. Fold uses OAuth 2.0 — we never see or store your Stripe secret key. We receive a time-limited, scoped OAuth token which is stored encrypted (AES-256) in our database.",
      },
    ],
    whyFoundersConnect: "Stripe is usually the first thing a founder checks in the morning. Fold makes that check instant — your daily revenue, new customers, and refund rate land in the same view as your traffic and email metrics, so you can see whether a good traffic day actually turned into a good revenue day.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "revenue", value: "4320.00" },
      { label: "tx_count", value: "143" },
      { label: "new_customers", value: "12" },
      { label: "refund_count", value: "2" },
      { label: "refund_total", value: "58.00" },
    ],
    apiImpact: "Fold makes 7 read-only API calls per sync, all well within Stripe's default rate limit of 100 requests/second. Syncs run once daily and complete in under 5 seconds.",
  },

  // ── Google Analytics 4 ────────────────────────────────────────────────────
  ga4: {
    id: "ga4",
    name: "Google Analytics 4",
    tagline: "Website traffic, sessions, sources and conversions — read-only.",
    color: "#4285F4",
    icon: "/integrations/ga4.svg",
    category: "Web Analytics",
    connectMethod: "oauth2",
    connectSteps: [
      'Click "Connect Google Analytics" in your Fold Settings tab.',
      "You're redirected to Google's own OAuth consent screen (accounts.google.com).",
      "You select your Google account and review the exact permissions Fold is requesting.",
      'You click "Allow". Google issues a scoped access token to Fold.',
      "Fold asks you to choose which GA4 property to sync (if you have multiple).",
      "Initial sync runs and data appears in your dashboard.",
    ],
    scopesRequested: [
      "https://www.googleapis.com/auth/analytics.readonly — read-only access to your GA4 reporting data.",
      "No write scopes. Fold cannot create events, modify goals or alter your GA4 configuration.",
    ],
    apiEndpoints: [
      { label: "GA4 Data API — runReport (sessions/users)", purpose: "Fetch daily session and user counts for traffic KPI tile." },
      { label: "GA4 Data API — runReport (traffic sources)", purpose: "Break down traffic by channel: organic, paid, social, email, direct, referral." },
      { label: "GA4 Data API — runReport (bounce rate / engagement)", purpose: "Engagement rate and average session duration for quality metrics." },
      { label: "GA4 Data API — runReport (top pages)", purpose: "Top 10 pages by sessions and engagement time." },
      { label: "GA4 Data API — runReport (conversions)", purpose: "Goal completion counts for conversion rate metric." },
      { label: "GA4 Data API — runReport (device category)", purpose: "Desktop vs mobile vs tablet breakdown." },
      { label: "GA4 Data API — runReport (geo/country)", purpose: "Top countries by sessions for audience geography widget." },
    ],
    storedFields: [
      { field: "Total sessions (current period)", example: "8,420 sessions", purpose: "Traffic KPI tile and trend chart." },
      { field: "Total users", example: "5,130 users", purpose: "Audience size metric." },
      { field: "New users count", example: "3,240 new users", purpose: "Growth indicator." },
      { field: "Bounce rate / engagement rate", example: "42% engagement rate", purpose: "Traffic quality metric." },
      { field: "Sessions by traffic source", example: "Organic: 3,200 / Paid: 1,100", purpose: "Channel attribution breakdown chart." },
      { field: "Top 10 pages by sessions", example: "/pricing: 940 sessions", purpose: "Content performance widget." },
      { field: "Conversion event counts", example: "sign_up: 87 conversions", purpose: "Conversion rate KPI." },
      { field: "Device category split", example: "Desktop: 62%, Mobile: 35%", purpose: "Device breakdown chart." },
    ],
    neverStored: [
      "Individual user IDs, client IDs or user pseudonyms",
      "IP addresses",
      "Page paths with personally identifiable information (e.g. /account/user@email.com)",
      "Raw event parameters or custom dimensions containing PII",
      "User-level session logs",
      "Your GA4 measurement ID or any configuration secrets",
    ],
    neverDoes: [
      "Create, edit or delete GA4 events or conversions",
      "Modify your GA4 property configuration or data streams",
      "Access Google Search Console, Google Ads or any other Google product",
      "Share your traffic data with any third party",
      "Use your analytics data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Google Analytics 4 → Disconnect. All synced GA4 data is deleted immediately.",
      fromPlatform: "Go to your Google Account → Security → Third-party apps with account access → Fold Analytics → Remove access.",
      platformRevokeUrl: "https://myaccount.google.com/connections",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active. Disconnecting GA4 or closing your account purges all GA4-sourced data within 24 hours.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available anytime from the Settings tab.",
    privacyNote: "Fold uses the Google Analytics Data API v1 with analytics.readonly scope. We only retrieve aggregated report data — the same numbers you see in your GA4 dashboard. No user-level data, no raw event streams.",
    faq: [
      {
        q: "Can Fold see who my individual website visitors are?",
        a: "No. We use the GA4 Reporting API which returns aggregated metrics only — totals, averages and percentages. We never access user-level data or session-level logs.",
      },
      {
        q: "Does Fold access my Google Ads account?",
        a: "No. The analytics.readonly scope is strictly limited to GA4 reporting data. Google Ads is a completely separate product with separate OAuth scopes that Fold does not request.",
      },
      {
        q: "Will Fold affect my GA4 data or sampling?",
        a: "No. Read-only API calls have no impact on your GA4 data or its accuracy. Fold uses unsampled data requests where possible, but very large GA4 properties may return sampled data — consistent with what GA4's own interface shows.",
      },
      {
        q: "I have multiple GA4 properties. Which one does Fold use?",
        a: "After connecting, Fold will ask you to select the specific GA4 property you want to sync. You can change this selection from the Settings tab at any time.",
      },
    ],
    whyFoundersConnect: "GA4's own interface is powerful but slow to navigate for a quick daily check. Fold gives you the numbers that matter — sessions, new users, conversions — in a single row alongside your revenue and email metrics, making it obvious whether a traffic spike actually converted.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "sessions", value: "8420" },
      { label: "total_users", value: "5130" },
      { label: "new_users", value: "3240" },
      { label: "bounce_rate", value: "0.42" },
      { label: "avg_session_duration", value: "134" },
    ],
    apiImpact: "Fold makes 7 GA4 Data API requests per sync using batch report calls. Well within Google's default quota of 10,000 requests per day per property.",
  },

  // ── Meta Ads ──────────────────────────────────────────────────────────────
  meta: {
    id: "meta",
    name: "Meta Ads",
    tagline: "Ad spend, campaign performance and ROAS — read-only.",
    color: "#1877f2",
    icon: "/integrations/meta.svg",
    category: "Advertising",
    connectMethod: "oauth2",
    connectSteps: [
      'Click "Connect Meta Ads" in your Fold Settings tab.',
      "You're redirected to Meta's Business login page (facebook.com).",
      "You log in with your Facebook account and review the permissions Fold is requesting.",
      "You select which ad account(s) to grant access to.",
      "Meta issues a scoped access token. Fold performs an initial sync.",
    ],
    scopesRequested: [
      "ads_read — read-only access to ad account spend and performance data.",
      "read_insights — access to campaign and ad-set level insights (impressions, clicks, conversions).",
      "No write permissions. Fold cannot create, pause, edit or delete any campaign or ad.",
    ],
    apiEndpoints: [
      { label: "GET /act_{ad_account_id}/insights", purpose: "Fetch total spend, impressions, clicks and reach for the period." },
      { label: "GET /act_{ad_account_id}/campaigns?fields=insights", purpose: "Campaign-level breakdown of spend and performance." },
      { label: "GET /act_{ad_account_id}/adsets?fields=insights", purpose: "Ad-set level CPC and CTR for optimization insights." },
      { label: "GET /act_{ad_account_id}/adaccounts", purpose: "List ad accounts linked to the Meta Business account." },
    ],
    storedFields: [
      { field: "Total ad spend (period)", example: "$1,240 this month", purpose: "Ad spend KPI tile on Overview." },
      { field: "Total impressions", example: "284,000 impressions", purpose: "Reach metric." },
      { field: "Total clicks", example: "4,320 clicks", purpose: "Traffic driven by paid social." },
      { field: "Click-through rate (CTR)", example: "1.52%", purpose: "Campaign efficiency metric." },
      { field: "Cost per click (CPC)", example: "$0.29", purpose: "Ad cost efficiency metric." },
      { field: "ROAS (if conversion tracking enabled)", example: "3.2×", purpose: "Return on ad spend for AI context." },
      { field: "Spend by campaign", example: "Retargeting: $480 / Prospecting: $760", purpose: "Campaign breakdown chart." },
    ],
    neverStored: [
      "Individual user IDs, email addresses or phone numbers in your Custom Audiences",
      "Ad creative content (images, copy, videos)",
      "Pixel event data or individual website visitor information",
      "Your Facebook personal profile information",
      "Your Meta Business Manager details beyond the ad account ID",
      "Billing information or payment method details",
    ],
    neverDoes: [
      "Create, edit, pause or delete any campaign, ad set or ad",
      "Modify your audience targeting or custom audiences",
      "Access your personal Facebook profile or posts",
      "Access Facebook Pages or Instagram accounts",
      "Share your ad performance data with any third party",
      "Use your ad data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Meta Ads → Disconnect. All synced Meta data is deleted immediately.",
      fromPlatform: "Facebook → Settings & Privacy → Settings → Apps and Websites → Fold Analytics → Remove.",
      platformRevokeUrl: "https://www.facebook.com/settings?tab=applications",
    },
    dataRetention: "Synced ad metrics are retained while your Fold account is active. Disconnecting Meta or closing your account purges all Meta-sourced data within 24 hours.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "Fold only reads aggregated campaign-level metrics — the same numbers visible in your Meta Ads Manager. We have no access to the audience data, pixel data, or personal information of anyone who saw or clicked your ads.",
    faq: [
      {
        q: "Can Fold see who clicked my ads or who is in my Custom Audiences?",
        a: "No. We read aggregated performance metrics only (totals, averages). We have no access to audience membership lists, pixel event logs, or any individual user data.",
      },
      {
        q: "Can Fold pause or edit my campaigns?",
        a: "No. We only request read permissions (ads_read, read_insights). Meta's API will reject any write operation from our token.",
      },
      {
        q: "Does Fold access my Facebook personal account or Instagram?",
        a: "No. The scopes we request are strictly limited to ad account insights. We have no access to your personal profile, news feed, pages, or Instagram account.",
      },
      {
        q: "I run ads across multiple ad accounts. Which does Fold sync?",
        a: "During the connect flow, you select which ad account(s) to share with Fold. You can update this selection from Settings at any time.",
      },
    ],
    whyFoundersConnect: "Ad spend is the easiest metric to overspend on without noticing. Fold puts your daily Meta spend, clicks, and purchase conversions next to your actual revenue from Stripe or Shopify — so you can see your return on ad spend in context rather than switching between Ads Manager and your payment dashboard.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "spend", value: "1240.00" },
      { label: "impressions", value: "284000" },
      { label: "clicks", value: "4320" },
      { label: "reach", value: "192000" },
      { label: "conversions", value: "38" },
    ],
    apiImpact: "Fold makes 4 Marketing API requests per sync. Meta's API has a rate limit based on an 'app score' — our requests are minimal and will not approach any limits.",
  },

  // ── Lemon Squeezy ────────────────────────────────────────────────────────
  "lemon-squeezy": {
    id: "lemon-squeezy",
    name: "Lemon Squeezy",
    tagline: "Digital product and subscription revenue — read-only via API key.",
    color: "#FFC233",
    icon: "/integrations/lemon-squeezy.svg",
    category: "Payments & Revenue",
    connectMethod: "api-key",
    connectSteps: [
      "Go to your Lemon Squeezy dashboard → Settings → API.",
      'Create a new API key — give it a name like "Fold Analytics".',
      "Copy the key and paste it into Fold's Settings tab under the Lemon Squeezy integration.",
      "Fold validates the key and performs an initial sync.",
      "You can delete this API key from Lemon Squeezy at any time to immediately revoke access.",
    ],
    scopesRequested: [
      "Read-only API key — grants read access to orders, subscriptions and products.",
      "Lemon Squeezy does not yet offer scoped API keys (as of 2025); the key gives read access to all store data. Fold only reads the fields listed below.",
    ],
    apiEndpoints: [
      { label: "GET /v1/orders", purpose: "Fetch order counts and gross revenue for the period." },
      { label: "GET /v1/subscriptions", purpose: "Count active, cancelled and paused subscriptions; calculate MRR." },
      { label: "GET /v1/products", purpose: "Revenue breakdown by product." },
      { label: "GET /v1/subscription-invoices", purpose: "Renewal revenue and failed payment tracking." },
    ],
    storedFields: [
      { field: "Gross revenue (period)", example: "$3,100 this month", purpose: "Revenue KPI tile." },
      { field: "Net revenue after LS fees", example: "$2,790", purpose: "Actual income metric." },
      { field: "Active subscription count", example: "94 active", purpose: "MRR base metric." },
      { field: "New subscriptions (period)", example: "11 new", purpose: "Growth metric." },
      { field: "Cancelled subscriptions (period)", example: "4 cancelled", purpose: "Churn metric." },
      { field: "Revenue by product", example: "Starter: $1,200 / Pro: $1,900", purpose: "Product breakdown chart." },
      { field: "Refund count and total", example: "2 refunds, $74", purpose: "Refund rate metric." },
    ],
    neverStored: [
      "Customer names, email addresses or billing addresses",
      "Individual order IDs or invoice IDs",
      "Customer metadata or custom fields",
      "Payment method details",
      "Your Lemon Squeezy store URL or subdomain configuration",
      "Webhook secrets",
    ],
    neverDoes: [
      "Create or modify orders, subscriptions or products",
      "Issue refunds or cancellations",
      "Access your Lemon Squeezy dashboard configuration",
      "Share your revenue data with any third party",
      "Use your data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Lemon Squeezy → Disconnect. All synced data is deleted immediately.",
      fromPlatform: 'Lemon Squeezy Dashboard → Settings → API → Delete the API key named "Fold Analytics".',
      platformRevokeUrl: "https://app.lemonsqueezy.com/settings/api",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active. Disconnecting or closing your account purges all LS-sourced data within 24 hours.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "Your Lemon Squeezy API key is stored encrypted (AES-256) in our database and is never logged or transmitted in plaintext. You can rotate or delete it from Lemon Squeezy at any time.",
    faq: [
      {
        q: "Is my Lemon Squeezy API key stored securely?",
        a: "Yes. Your API key is encrypted with AES-256 before being written to our database. It is never logged, never returned via our API, and never shared with any third party.",
      },
      {
        q: "Can Fold issue refunds or cancel subscriptions on my Lemon Squeezy store?",
        a: "No. We only read data. While Lemon Squeezy's API key doesn't yet support read-only scoping, Fold's code only calls GET endpoints and never performs any write operation.",
      },
      {
        q: "Can I see my customers' details through Fold?",
        a: "No. We only store aggregate counts and totals. Individual customer names, emails, and order details are never extracted or stored by Fold.",
      },
    ],
    whyFoundersConnect: "Lemon Squeezy is popular with indie hackers selling digital products and SaaS subscriptions. Fold pulls your daily revenue, new subscriptions, and churn into a single view — without having to refresh the LS dashboard to answer the question 'did yesterday beat last week?'",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "gross_revenue", value: "3100.00" },
      { label: "net_revenue", value: "2790.00" },
      { label: "active_subscriptions", value: "94" },
      { label: "new_subscriptions", value: "11" },
      { label: "cancelled_subscriptions", value: "4" },
    ],
    apiImpact: "Fold makes 4 API requests per sync. Lemon Squeezy's API is rate-limited to 120 requests/minute — our usage is negligible.",
  },

  // ── Gumroad ───────────────────────────────────────────────────────────────
  gumroad: {
    id: "gumroad",
    name: "Gumroad",
    tagline: "Creator product sales and subscription revenue — read-only via OAuth.",
    color: "#ff90e8",
    icon: "/integrations/gumroad.svg",
    category: "Payments & Revenue",
    connectMethod: "oauth2",
    connectSteps: [
      'Click "Connect Gumroad" in your Fold Settings tab.',
      "You're redirected to Gumroad's authorization page (gumroad.com).",
      "You log in and approve the connection.",
      "Gumroad issues a scoped access token to Fold.",
      "Fold performs the initial data sync.",
    ],
    scopesRequested: [
      "view_sales — read-only access to sales data, products and subscription information.",
      "No write scopes. Fold cannot create products, modify prices or issue refunds.",
    ],
    apiEndpoints: [
      { label: "GET /sales", purpose: "Fetch total sales, revenue and unit counts for the period." },
      { label: "GET /products", purpose: "Revenue breakdown by product." },
      { label: "GET /subscribers", purpose: "Count active and cancelled membership subscribers for MRR." },
    ],
    storedFields: [
      { field: "Total sales revenue (period)", example: "$2,400 this month", purpose: "Revenue KPI tile." },
      { field: "Units sold", example: "82 units", purpose: "Sales volume metric." },
      { field: "Revenue by product", example: "Course: $1,800 / Ebook: $600", purpose: "Product breakdown chart." },
      { field: "Active subscribers (membership)", example: "34 active", purpose: "MRR base metric." },
      { field: "Cancelled subscribers (period)", example: "3 cancelled", purpose: "Churn metric." },
      { field: "Refund count", example: "2 refunds", purpose: "Refund rate metric." },
    ],
    neverStored: [
      "Buyer names, email addresses or shipping addresses",
      "Individual sale IDs or transaction references",
      "Buyer metadata or custom fields",
      "Your Gumroad profile description or personal bio",
      "Payout or banking information",
    ],
    neverDoes: [
      "Create, edit or delete products or pricing",
      "Issue refunds or cancel subscriptions",
      "Access your Gumroad profile settings",
      "Share your sales data with any third party",
      "Use your data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Gumroad → Disconnect. All synced Gumroad data is deleted immediately.",
      fromPlatform: "Gumroad → Settings → Applications → Fold Analytics → Revoke.",
      platformRevokeUrl: "https://app.gumroad.com/settings/applications",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "Fold's Gumroad integration uses the official OAuth 2.0 flow. The access token received is scoped to read-only sales data and is stored encrypted in our database.",
    faq: [
      {
        q: "Can Fold see who bought my products?",
        a: "No. We only store aggregate sales totals and product-level revenue. Individual buyer names, emails and order details are never extracted or stored.",
      },
      {
        q: "Can Fold modify my Gumroad products or prices?",
        a: "No. The view_sales OAuth scope is strictly read-only. Gumroad's API enforces this at their end.",
      },
    ],
    whyFoundersConnect: "Gumroad creators often sell across multiple products and memberships. Fold gives you a daily number — total revenue and units sold — without logging into Gumroad, so you can see at a glance whether your latest launch or email is moving the needle.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "revenue", value: "2400.00" },
      { label: "units_sold", value: "82" },
      { label: "active_subscribers", value: "34" },
      { label: "cancelled_subscribers", value: "3" },
      { label: "refund_count", value: "2" },
    ],
    apiImpact: "Fold makes 3 API requests per sync. Gumroad's API rate limit is 5,000 requests per hour — our usage is negligible.",
  },

  // ── Paddle ────────────────────────────────────────────────────────────────
  paddle: {
    id: "paddle",
    name: "Paddle",
    tagline: "SaaS billing, subscription MRR and net revenue after taxes — read-only.",
    color: "#3ddc97",
    icon: "/integrations/paddle.svg",
    category: "Payments & Revenue",
    connectMethod: "api-key",
    connectSteps: [
      "Go to your Paddle dashboard → Developer Tools → Authentication.",
      "Create a new API key with read-only permissions.",
      "Copy the key and paste it into Fold's Settings tab under the Paddle integration.",
      "Fold validates the key and performs an initial sync.",
      "You can delete or rotate the key from Paddle at any time to immediately revoke access.",
    ],
    scopesRequested: [
      "Read-only API key — scoped to transactions, subscriptions and product data.",
      "Fold requests the minimum permissions needed and never requests billing or payout access.",
    ],
    apiEndpoints: [
      { label: "GET /transactions", purpose: "Net revenue after Paddle's Merchant of Record fees and taxes." },
      { label: "GET /subscriptions", purpose: "Active, paused and cancelled subscription counts for MRR." },
      { label: "GET /products + /prices", purpose: "Revenue breakdown by product and plan." },
      { label: "GET /adjustments", purpose: "Refund and credit note tracking." },
    ],
    storedFields: [
      { field: "Net revenue (period)", example: "$5,800 this month", purpose: "Revenue KPI tile (net of Paddle fees and tax)." },
      { field: "Active subscription count", example: "201 active", purpose: "MRR calculation base." },
      { field: "New subscriptions (period)", example: "18 new", purpose: "Growth metric." },
      { field: "Churn count (period)", example: "6 cancelled", purpose: "Churn rate metric." },
      { field: "Revenue by product/plan", example: "Monthly Plan: $3,200 / Annual: $2,600", purpose: "Plan breakdown chart." },
      { field: "Refund/adjustment total", example: "$120 refunded", purpose: "Refund rate metric." },
      { field: "Revenue by country (top 5)", example: "US: $3,100 / UK: $900", purpose: "Geographic revenue breakdown." },
    ],
    neverStored: [
      "Customer names, email addresses or billing addresses",
      "Individual transaction or invoice IDs",
      "VAT/tax registration numbers",
      "Paddle payout schedules or bank account information",
      "Webhook signing secrets",
    ],
    neverDoes: [
      "Create, edit or cancel subscriptions or transactions",
      "Issue refunds or credits",
      "Access Paddle's Merchant of Record tax filing data",
      "Share your revenue data with any third party",
      "Use your data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Paddle → Disconnect. All synced Paddle data is deleted immediately.",
      fromPlatform: "Paddle Dashboard → Developer Tools → Authentication → Delete the API key.",
      platformRevokeUrl: "https://vendors.paddle.com/authentication",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "As Paddle operates as a Merchant of Record, your customer billing data (addresses, VAT numbers) is held by Paddle and is never accessible to Fold. We only see the aggregated net revenue figures Paddle reports.",
    faq: [
      {
        q: "Since Paddle is a Merchant of Record, do they share customer data with Fold?",
        a: "No. Fold only reads aggregated transaction totals and subscription counts. Customer billing details (names, addresses, VAT numbers) are owned and managed by Paddle as the Merchant of Record and are never exposed to Fold.",
      },
      {
        q: "Is my Paddle API key stored securely?",
        a: "Yes. It is encrypted with AES-256 before storage and never logged or returned via the Fold API.",
      },
    ],
    whyFoundersConnect: "Paddle acts as your Merchant of Record, which means the revenue numbers you care about (net after tax and fees) are only visible inside their dashboard. Fold syncs those net revenue figures daily so you can see your actual take-home alongside your other metrics without logging in to Paddle every morning.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "net_revenue", value: "5800.00" },
      { label: "active_subscriptions", value: "201" },
      { label: "new_subscriptions", value: "18" },
      { label: "churn_count", value: "6" },
      { label: "refund_total", value: "120.00" },
    ],
    apiImpact: "Fold makes 4 API requests per sync. Paddle's API rate limit is 500 requests/minute — our usage is well within limits.",
  },

  // ── Plausible ─────────────────────────────────────────────────────────────
  plausible: {
    id: "plausible",
    name: "Plausible",
    tagline: "Privacy-first website analytics — cookie-free, GDPR compliant, read-only.",
    color: "#5850ec",
    icon: "/integrations/plausible.svg",
    category: "Web Analytics",
    connectMethod: "api-key",
    connectSteps: [
      "Go to your Plausible dashboard → Settings → API Keys.",
      'Create a new API key — name it "Fold Analytics".',
      "Copy the key and paste it into Fold's Settings tab, along with your Plausible site domain.",
      "Fold validates the key and performs an initial sync.",
      "Delete the key from Plausible at any time to immediately revoke access.",
    ],
    scopesRequested: [
      "Stats API key — read-only access to your site's aggregated analytics data.",
      "Fold does not request access to your Plausible account settings, billing or other sites.",
    ],
    apiEndpoints: [
      { label: "GET /api/v1/stats/aggregate", purpose: "Total visitors, pageviews, bounce rate and visit duration." },
      { label: "GET /api/v1/stats/breakdown?property=visit:source", purpose: "Traffic source breakdown (organic, direct, referral, social)." },
      { label: "GET /api/v1/stats/breakdown?property=visit:page", purpose: "Top pages by visitors." },
      { label: "GET /api/v1/stats/breakdown?property=visit:device", purpose: "Desktop vs mobile vs tablet split." },
      { label: "GET /api/v1/stats/breakdown?property=visit:country", purpose: "Top countries by visitors." },
      { label: "GET /api/v1/stats/timeseries", purpose: "Daily visitor trend for the sparkline chart." },
    ],
    storedFields: [
      { field: "Unique visitors (period)", example: "4,200 visitors", purpose: "Traffic KPI tile." },
      { field: "Total pageviews", example: "12,800 pageviews", purpose: "Volume metric." },
      { field: "Bounce rate", example: "38%", purpose: "Traffic quality metric." },
      { field: "Average visit duration", example: "2m 14s", purpose: "Engagement metric." },
      { field: "Traffic by source", example: "Google: 1,800 / Direct: 900", purpose: "Channel attribution chart." },
      { field: "Top 10 pages by visitors", example: "/pricing: 620 visitors", purpose: "Content performance widget." },
      { field: "Device split", example: "Desktop: 58%, Mobile: 39%", purpose: "Device breakdown chart." },
    ],
    neverStored: [
      "Any individual visitor data — Plausible itself doesn't collect it",
      "IP addresses (Plausible doesn't log them; neither does Fold)",
      "Cookies or tracking identifiers",
      "Individual session logs",
      "Your Plausible account email or billing information",
    ],
    neverDoes: [
      "Modify your Plausible site settings or goals",
      "Access other sites in your Plausible account",
      "Add tracking scripts to your website",
      "Share your analytics data with any third party",
      "Use your data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Plausible → Disconnect. All synced Plausible data is deleted immediately.",
      fromPlatform: "Plausible Dashboard → Settings → API Keys → Delete the Fold Analytics key.",
      platformRevokeUrl: "https://plausible.io/settings",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "Plausible is a privacy-first analytics platform that does not use cookies and does not collect any personally identifiable information. Since Plausible doesn't have individual visitor data, Fold cannot access it either — the privacy guarantee is built into the platform itself.",
    faq: [
      {
        q: "Plausible is already privacy-first. Does Fold change that?",
        a: "No. Fold only reads the same aggregated statistics you see in your Plausible dashboard. Since Plausible never collects individual user data, there is none for Fold to access.",
      },
      {
        q: "Does connecting Fold add any tracking to my website?",
        a: "No. Fold reads your Plausible data via API. We add nothing to your website — no scripts, no pixels, no cookies.",
      },
      {
        q: "I have multiple Plausible sites. Which does Fold sync?",
        a: "When you connect, you enter the specific site domain you want to sync. You can update this from Settings at any time.",
      },
    ],
    whyFoundersConnect: "Plausible users tend to value privacy and simplicity — which is exactly what Fold adds on top. Instead of opening Plausible every day to check if traffic moved, Fold surfaces your visitor count alongside revenue and email metrics, making it easy to see if a traffic spike actually meant anything.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "visitors", value: "4200" },
      { label: "pageviews", value: "12800" },
      { label: "bounce_rate", value: "0.38" },
      { label: "visit_duration", value: "134" },
    ],
    apiImpact: "Fold makes 6 Stats API requests per sync. Plausible's API has a generous limit and our usage — a handful of aggregate calls per day — is negligible.",
  },

  // ── Mailchimp ─────────────────────────────────────────────────────────────
  mailchimp: {
    id: "mailchimp",
    name: "Mailchimp",
    tagline: "Email list growth, campaign performance and engagement rates — read-only.",
    color: "#FFE01B",
    icon: "/integrations/mailchimp.svg",
    category: "Email & Marketing",
    connectMethod: "oauth2",
    connectSteps: [
      'Click "Connect Mailchimp" in your Fold Settings tab.',
      "You're redirected to Mailchimp's authorization page (login.mailchimp.com).",
      "You log in and review the permissions Fold is requesting.",
      'You click "Allow". Mailchimp issues a scoped access token.',
      "Fold performs the initial sync of your list stats and campaign performance.",
    ],
    scopesRequested: [
      "OAuth 2.0 — read access to lists, campaigns and campaign reports.",
      "No write scopes. Fold cannot send emails, add/remove subscribers, or modify campaigns.",
    ],
    apiEndpoints: [
      { label: "GET /3.0/lists", purpose: "Subscriber count, growth rate and list health for the email KPI tile." },
      { label: "GET /3.0/lists/{id}/growth-history", purpose: "Subscriber growth trend over the past 30 days." },
      { label: "GET /3.0/campaigns", purpose: "List of recent campaigns to report on." },
      { label: "GET /3.0/reports/{id}", purpose: "Open rate, click rate, unsubscribe rate and bounce rate per campaign." },
    ],
    storedFields: [
      { field: "Total subscriber count", example: "4,820 subscribers", purpose: "Email KPI tile." },
      { field: "Net subscriber growth (period)", example: "+143 this month", purpose: "Growth metric." },
      { field: "Unsubscribe count (period)", example: "28 unsubscribed", purpose: "Churn metric." },
      { field: "Average open rate (last 5 campaigns)", example: "32.4%", purpose: "Engagement KPI." },
      { field: "Average click rate (last 5 campaigns)", example: "4.8%", purpose: "Engagement KPI." },
      { field: "Bounce rate (hard + soft)", example: "0.8%", purpose: "List health metric." },
    ],
    neverStored: [
      "Individual subscriber email addresses, names or profile information",
      "Subscriber tags or segment membership",
      "Email content, subject lines or campaign body text",
      "Individual open or click events per subscriber",
      "Your Mailchimp account API key",
      "Audience merge fields or custom properties",
    ],
    neverDoes: [
      "Send emails or create campaigns",
      "Add, update or remove subscribers",
      "Modify lists, segments or automations",
      "Access subscriber email addresses",
      "Share your email list data with any third party",
      "Use your email data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Mailchimp → Disconnect. All synced Mailchimp data is deleted immediately.",
      fromPlatform: "Mailchimp → Account → Extras → Registered Applications → Fold Analytics → Deauthorize.",
      platformRevokeUrl: "https://login.mailchimp.com/account/connected-sites/",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "Fold never accesses your subscriber list. We read aggregate audience statistics (total count, growth rate, open rates) — not the email addresses or personal details of any individual subscriber.",
    faq: [
      {
        q: "Can Fold see my subscribers' email addresses?",
        a: "No. We only read aggregate audience statistics — total subscriber count, growth numbers, average open rates. Individual subscriber data is never accessed or stored.",
      },
      {
        q: "Can Fold send emails or add people to my list?",
        a: "No. The OAuth token we receive is read-only. Mailchimp's API will block any write operation from our token.",
      },
      {
        q: "Will Fold affect my Mailchimp audience or campaigns?",
        a: "No. Read-only API calls have no effect on your Mailchimp account. Nothing changes when Fold syncs.",
      },
    ],
    whyFoundersConnect: "List growth is one of the most important early indicators for content-led businesses, but it's buried inside Mailchimp under three clicks. Fold surfaces your net new subscribers alongside your traffic and revenue so you can see whether the newsletter is growing in sync with everything else.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "total_subscribers", value: "4820" },
      { label: "new_subscribers", value: "143" },
      { label: "unsubscribes", value: "28" },
      { label: "avg_open_rate", value: "0.324" },
      { label: "avg_click_rate", value: "0.048" },
    ],
    apiImpact: "Fold makes 4 API requests per sync. Mailchimp's rate limit is 10 requests/second — our usage is negligible.",
  },

  // ── Klaviyo ───────────────────────────────────────────────────────────────
  klaviyo: {
    id: "klaviyo",
    name: "Klaviyo",
    tagline: "E-commerce email flows, campaign revenue and subscriber growth — read-only.",
    color: "#1F1F20",
    icon: "/integrations/klaviyo.svg",
    category: "Email & Marketing",
    connectMethod: "api-key",
    connectSteps: [
      "Go to your Klaviyo account → Settings → API Keys.",
      'Create a new Private API Key — select "Read Only" access.',
      "Copy the key and paste it into Fold's Settings tab under the Klaviyo integration.",
      "Fold validates the key and performs an initial sync.",
      "Delete or revoke the key from Klaviyo at any time.",
    ],
    scopesRequested: [
      "Read-only Private API Key — scoped to profiles (count only), campaigns, flows and metrics.",
      "Fold requests the minimum permissions needed and does not request SMS, segments or suppression data.",
    ],
    apiEndpoints: [
      { label: "GET /api/profiles/ (count only)", purpose: "Total active profile / subscriber count." },
      { label: "GET /api/campaigns/", purpose: "List recent email campaigns to pull performance on." },
      { label: "GET /api/campaign-message-assign/ (metrics)", purpose: "Open rate, click rate and revenue attributed per campaign." },
      { label: "GET /api/flows/", purpose: "Revenue attributed to automated flows (welcome series, abandoned cart, etc.)." },
      { label: "GET /api/metrics/", purpose: "Key events: placed_order, ordered_product used for revenue attribution." },
    ],
    storedFields: [
      { field: "Active profile count", example: "6,200 profiles", purpose: "Email KPI tile." },
      { field: "Net new profiles (period)", example: "+220 this month", purpose: "List growth metric." },
      { field: "Average campaign open rate", example: "29.1%", purpose: "Engagement KPI." },
      { field: "Average campaign click rate", example: "3.7%", purpose: "Engagement KPI." },
      { field: "Revenue attributed to campaigns (period)", example: "$4,100", purpose: "Email ROI metric." },
      { field: "Revenue attributed to flows (period)", example: "$2,800", purpose: "Automation ROI metric." },
    ],
    neverStored: [
      "Individual profile email addresses, names or phone numbers",
      "Individual event history per profile",
      "Segment membership or suppression lists",
      "Email content or subject lines",
      "SMS message content or opt-in records",
      "Your Klaviyo account password",
    ],
    neverDoes: [
      "Send emails or SMS messages",
      "Add, update or suppress profiles",
      "Modify flows, campaigns or segments",
      "Access individual subscriber purchase history",
      "Share your email data with any third party",
      "Use your data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Klaviyo → Disconnect. All synced Klaviyo data is deleted immediately.",
      fromPlatform: "Klaviyo → Settings → API Keys → Revoke the Fold Analytics key.",
      platformRevokeUrl: "https://www.klaviyo.com/settings/account/api-keys",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "Fold uses Klaviyo's read-only API key scoping. We count profiles and read campaign-level aggregates — we never access individual subscriber profiles, event histories, or personal data.",
    faq: [
      {
        q: "Can Fold see my customers' purchase history or email addresses?",
        a: "No. We read aggregate campaign performance metrics and profile counts. Individual profiles, event histories, and email addresses are never accessed or stored.",
      },
      {
        q: "Is my Klaviyo API key stored securely?",
        a: "Yes. Encrypted with AES-256 before storage and never logged, exposed via our API, or shared with third parties.",
      },
      {
        q: "Can Fold send emails to my Klaviyo subscribers?",
        a: "No. Read-only API keys in Klaviyo prevent any send, create, or modify operations.",
      },
    ],
    whyFoundersConnect: "Klaviyo is the engine for most DTC and e-commerce email revenue — but the dashboard is complex and slow for a quick morning check. Fold pulls your campaign performance, list growth, and attributed revenue into a single daily snapshot so you can see whether your email channel is keeping pace with your ad spend.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "active_profiles", value: "6200" },
      { label: "new_profiles", value: "220" },
      { label: "emails_sent", value: "4100" },
      { label: "opens", value: "1193" },
      { label: "clicks", value: "152" },
      { label: "attributed_revenue", value: "4100.00" },
    ],
    apiImpact: "Fold makes 5 API requests per sync. Klaviyo's API rate limit is 75 requests/second — our usage is negligible.",
  },

  // ── Beehiiv ───────────────────────────────────────────────────────────────
  beehiiv: {
    id: "beehiiv",
    name: "Beehiiv",
    tagline: "Newsletter subscriber growth, open rates and paid subscription revenue — read-only.",
    color: "#FC5200",
    icon: "/integrations/beehiiv.png",
    category: "Email & Marketing",
    connectMethod: "api-key",
    connectSteps: [
      "Go to your Beehiiv dashboard → Settings → API.",
      'Generate a new API key — name it "Fold Analytics".',
      "Copy the key and paste it into Fold's Settings tab, along with your Publication ID.",
      "Fold validates the key and performs an initial sync.",
      "Delete the key from Beehiiv at any time to immediately revoke access.",
    ],
    scopesRequested: [
      "Read-only API key — access to publication stats, subscriber counts and email performance.",
      "No write access. Fold cannot send newsletters, add subscribers or modify publication settings.",
    ],
    apiEndpoints: [
      { label: "GET /v2/publications/{id}", purpose: "Total subscriber count and publication metadata." },
      { label: "GET /v2/publications/{id}/subscriptions", purpose: "New, active and churned subscriber counts." },
      { label: "GET /v2/publications/{id}/posts", purpose: "Recent newsletters to pull performance metrics for." },
      { label: "GET /v2/publications/{id}/posts/{id}/stats", purpose: "Open rate, click rate and recipients per issue." },
      { label: "GET /v2/publications/{id}/premium_subscriptions", purpose: "Paid upgrade conversions and premium subscriber count." },
    ],
    storedFields: [
      { field: "Total subscriber count", example: "3,400 subscribers", purpose: "Email KPI tile." },
      { field: "Net new subscribers (period)", example: "+180 this month", purpose: "Growth metric." },
      { field: "Churn count (period)", example: "22 unsubscribed", purpose: "List churn metric." },
      { field: "Average open rate (last 5 issues)", example: "44.2%", purpose: "Engagement KPI." },
      { field: "Average click rate (last 5 issues)", example: "6.1%", purpose: "Engagement KPI." },
      { field: "Premium subscriber count", example: "87 premium", purpose: "Paid upgrade metric." },
      { field: "Free-to-paid conversion rate", example: "2.6%", purpose: "Monetization KPI." },
    ],
    neverStored: [
      "Individual subscriber email addresses, names or profile data",
      "Individual open or click events per subscriber",
      "Newsletter content, subject lines or post body text",
      "Subscriber referral codes or referral network data",
      "Stripe payment details linked to premium subscriptions",
      "Your Beehiiv account password",
    ],
    neverDoes: [
      "Send newsletters or create posts",
      "Add, update or remove subscribers",
      "Modify premium pricing or subscription settings",
      "Access subscriber personal information",
      "Share your newsletter data with any third party",
      "Use your data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Beehiiv → Disconnect. All synced Beehiiv data is deleted immediately.",
      fromPlatform: "Beehiiv Dashboard → Settings → API → Delete the Fold Analytics key.",
      platformRevokeUrl: "https://app.beehiiv.com/settings/integrations/api",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "Fold reads publication-level aggregate statistics — total counts, averages and rates. Individual subscriber email addresses and reading behaviour are never accessed or stored.",
    faq: [
      {
        q: "Can Fold see who my individual subscribers are?",
        a: "No. We read aggregate statistics — total subscriber counts, average open rates, paid conversion rates. We never access the subscriber list or individual subscriber profiles.",
      },
      {
        q: "Can Fold send emails to my list or publish posts?",
        a: "No. The Beehiiv API key is read-only. No write operations are possible with Fold's integration.",
      },
      {
        q: "Does Fold access my premium subscribers' payment information?",
        a: "No. We only count premium subscribers (the total number). Payment details are handled by Beehiiv and Stripe directly and are never accessible to Fold.",
      },
    ],
    whyFoundersConnect: "Newsletter businesses live and die by subscriber growth and open rates — but checking Beehiiv daily is friction that breaks your morning routine. Fold puts your subscriber count and recent open rates next to your revenue and traffic so you can see the full content-to-conversion picture without switching apps.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "total_subscribers", value: "3400" },
      { label: "new_subscribers", value: "180" },
      { label: "premium_subscribers", value: "87" },
      { label: "posts_published", value: "1" },
    ],
    apiImpact: "Fold makes 5 API requests per sync. Beehiiv's API is rate-limited to 120 requests/minute — our usage is negligible.",
  },

  // ── Shopify ───────────────────────────────────────────────────────────────
  shopify: {
    id: "shopify",
    name: "Shopify",
    tagline: "E-commerce GMV, orders, product revenue and refund tracking — read-only.",
    color: "#96bf48",
    icon: "/integrations/shopify.svg",
    category: "E-commerce",
    connectMethod: "oauth2",
    connectSteps: [
      'Click "Connect Shopify" in your Fold Settings tab.',
      "Enter your Shopify store domain (e.g. your-store.myshopify.com).",
      "You're redirected to your Shopify store's OAuth authorization page.",
      'You review the permissions and click "Install app".',
      "Shopify issues a scoped access token to Fold. Initial sync begins.",
    ],
    scopesRequested: [
      "read_orders — read-only access to order data for revenue and volume metrics.",
      "read_products — read product titles for the revenue-by-product breakdown.",
      "read_customers — count only (new vs returning customers). Customer PII is never stored.",
      "No write scopes. Fold cannot create orders, modify products or process refunds.",
    ],
    apiEndpoints: [
      { label: "GET /admin/api/orders.json", purpose: "Gross revenue, order count and average order value for the period." },
      { label: "GET /admin/api/orders.json?financial_status=refunded", purpose: "Refund count and refund total for the refund rate metric." },
      { label: "GET /admin/api/products.json", purpose: "Product names for the revenue-by-product breakdown." },
      { label: "GET /admin/api/customers/count.json", purpose: "Total customer count for new vs returning split." },
    ],
    storedFields: [
      { field: "Gross Merchandise Value (GMV)", example: "$18,400 this month", purpose: "Revenue KPI tile." },
      { field: "Net revenue (after refunds)", example: "$17,100", purpose: "Actual income metric." },
      { field: "Total order count", example: "312 orders", purpose: "Volume metric." },
      { field: "Average order value (AOV)", example: "$59.00", purpose: "Order quality metric." },
      { field: "New customers count", example: "188 new", purpose: "Acquisition metric." },
      { field: "Returning customers count", example: "124 returning", purpose: "Retention metric." },
      { field: "Revenue by top 5 products", example: "Product A: $6,200", purpose: "Product performance widget." },
      { field: "Refund count and total", example: "14 refunds, $820", purpose: "Refund rate metric." },
    ],
    neverStored: [
      "Customer names, email addresses, phone numbers or shipping addresses",
      "Individual order line items, product variants or order notes",
      "Customer browsing history or cart abandonment data",
      "Payment method or card details",
      "Shopify Payments payout details",
      "Draft orders or quote data",
    ],
    neverDoes: [
      "Create, edit or cancel orders",
      "Modify product listings, pricing or inventory",
      "Process refunds or chargebacks",
      "Access your Shopify admin settings",
      "Share your store data with any third party",
      "Use your store data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → Shopify → Disconnect. All synced Shopify data is deleted immediately.",
      fromPlatform: "Shopify Admin → Settings → Apps and sales channels → Fold Analytics → Delete.",
      platformRevokeUrl: "https://admin.shopify.com/settings/apps",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "Fold reads order and product aggregate data — totals, counts and averages. Customer personal information (names, email addresses, shipping addresses) is never read from the API or stored in our database.",
    faq: [
      {
        q: "Can Fold see my customers' names, emails or shipping addresses?",
        a: "No. We only store aggregate counts (e.g. '188 new customers this month'). Customer PII fields are excluded from our API queries.",
      },
      {
        q: "Can Fold create orders or process refunds on my Shopify store?",
        a: "No. We only request read-only scopes. Shopify's API will reject any write operation from our token.",
      },
      {
        q: "Does Fold affect my Shopify store's performance?",
        a: "No. We make lightweight, read-only API calls once per 24 hours. The API load is negligible and well within Shopify's rate limits.",
      },
      {
        q: "Will Fold install any apps or scripts on my Shopify store?",
        a: "No. Fold is an analytics read tool — it adds nothing to your storefront.",
      },
    ],
    whyFoundersConnect: "Shopify store owners tend to check their dashboard compulsively, especially during campaigns. Fold gives you your daily GMV, order count, and AOV in a single row alongside your Meta ad spend — so you can see your return on ad spend in context without any manual calculation.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "gmv", value: "18400.00" },
      { label: "net_revenue", value: "17100.00" },
      { label: "order_count", value: "312" },
      { label: "aov", value: "59.00" },
      { label: "new_customers", value: "188" },
      { label: "refund_count", value: "14" },
    ],
    apiImpact: "Fold makes 4 REST API calls per sync, all paginated with date filters. Well within Shopify's default limit of 40 requests/app/second.",
  },

  // ── WooCommerce ───────────────────────────────────────────────────────────
  woocommerce: {
    id: "woocommerce",
    name: "WooCommerce",
    tagline: "WordPress store revenue, orders and product performance — read-only via REST API.",
    color: "#7f54b3",
    icon: "/integrations/woocommerce.svg",
    category: "E-commerce",
    connectMethod: "api-key",
    connectSteps: [
      "Go to your WordPress admin → WooCommerce → Settings → Advanced → REST API.",
      'Click "Add key". Set Description to "Fold Analytics" and Permissions to "Read".',
      'Click "Generate API key". Copy the Consumer Key and Consumer Secret.',
      "Paste both values into Fold's Settings tab along with your store URL.",
      "Fold validates the credentials and performs an initial sync.",
      "Delete the API key from WooCommerce at any time to revoke access.",
    ],
    scopesRequested: [
      "Read-only WooCommerce REST API key — permissions explicitly set to Read only.",
      "Fold never requests Write or Read/Write permission levels.",
    ],
    apiEndpoints: [
      { label: "GET /wp-json/wc/v3/orders", purpose: "Revenue totals, order counts and average order value." },
      { label: "GET /wp-json/wc/v3/reports/sales", purpose: "Aggregated sales report for the period." },
      { label: "GET /wp-json/wc/v3/products/top_sellers", purpose: "Top products by units sold and revenue." },
      { label: "GET /wp-json/wc/v3/customers?role=customer", purpose: "New vs returning customer count." },
      { label: "GET /wp-json/wc/v3/reports/orders/totals", purpose: "Order status breakdown (completed, refunded, cancelled)." },
    ],
    storedFields: [
      { field: "Total sales revenue (period)", example: "$9,200 this month", purpose: "Revenue KPI tile." },
      { field: "Net revenue (after refunds)", example: "$8,760", purpose: "Actual income metric." },
      { field: "Total order count", example: "204 orders", purpose: "Volume metric." },
      { field: "Average order value (AOV)", example: "$45.10", purpose: "Order quality metric." },
      { field: "New customers count", example: "89 new", purpose: "Acquisition metric." },
      { field: "Top 5 products by revenue", example: "Widget X: $3,200", purpose: "Product performance widget." },
      { field: "Refund count and total", example: "7 refunds, $315", purpose: "Refund rate metric." },
    ],
    neverStored: [
      "Individual order details or line items beyond the order total",
      "Customer phone numbers, shipping addresses or billing addresses",
      "Customer account passwords",
      "Payment gateway credentials or transaction IDs",
      "WordPress database credentials",
      "Your WooCommerce Consumer Secret (used for authentication only, encrypted at rest, never logged)",
    ],
    neverDoes: [
      "Create, edit or delete orders, products or customers",
      "Process refunds or modify order status",
      "Access your WordPress admin or site configuration",
      "Write to your WordPress database",
      "Share your store data with any third party",
      "Use your store data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → WooCommerce → Disconnect. All synced WooCommerce data is deleted immediately.",
      fromPlatform: "WordPress Admin → WooCommerce → Settings → Advanced → REST API → Delete the Fold Analytics key.",
      platformRevokeUrl: "https://your-store.com/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "Your WooCommerce Consumer Key and Consumer Secret are stored encrypted (AES-256) and used only to authenticate API requests. They are never logged or returned via the Fold API. Fold only calls read endpoints to retrieve aggregate sales data.",
    faq: [
      {
        q: "Can Fold see my customers' names or email addresses?",
        a: "No. We only store aggregate counts and totals. Individual customer records, contact details and order notes are never accessed or stored.",
      },
      {
        q: "Is my WooCommerce Consumer Secret stored securely?",
        a: "Yes. It is encrypted with AES-256 before storage and never logged, exposed via our API, or transmitted in plaintext.",
      },
      {
        q: "My store is self-hosted. Does Fold need access to my server?",
        a: "No. Fold communicates with your store exclusively through the WooCommerce REST API over HTTPS. We never access your server directly, your WordPress admin, or your database.",
      },
      {
        q: "Can Fold modify my products or prices?",
        a: "No. The WooCommerce API key you create must be set to Read Only — this is a hard permission enforced by WooCommerce. Fold cannot perform any write operations.",
      },
    ],
    whyFoundersConnect: "Most WooCommerce store owners have no easy way to see yesterday's revenue without logging into WordPress. Fold pulls your daily sales totals, refund rate, and top products into a single view alongside your email, traffic, and ad spend — so you stop living in five separate tabs.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "revenue", value: "9240.50" },
      { label: "order_count", value: "204" },
      { label: "avg_order_value", value: "45.30" },
      { label: "new_customers", value: "89" },
      { label: "refund_count", value: "7" },
      { label: "refund_total", value: "315.00" },
    ],
    apiImpact: "Fold makes approximately 5 REST API requests per sync, well within WooCommerce's default rate limits. Syncs run once daily and take under 3 seconds.",
  },

  // ── HubSpot ───────────────────────────────────────────────────────────────
  hubspot: {
    id: "hubspot",
    name: "HubSpot",
    tagline: "CRM pipeline health, closed-won revenue and new contact growth — read-only via OAuth.",
    color: "#ff7a59",
    icon: "/integrations/hubspot.svg",
    category: "CRM & Sales",
    connectMethod: "oauth2",
    connectSteps: [
      'Click "Connect HubSpot" in your Fold Settings tab.',
      "You're redirected to HubSpot's OAuth authorization page (app.hubspot.com).",
      "You select the HubSpot account (portal) you want to connect — useful if you manage multiple.",
      "You review the exact permissions Fold is requesting and click 'Grant access'.",
      "HubSpot issues a scoped OAuth token to Fold. Your login credentials are never shared.",
      "Fold performs the initial sync and your CRM metrics appear in the dashboard.",
    ],
    scopesRequested: [
      "crm.objects.deals.read — read deal records: stage, amount, close date, owner ID.",
      "crm.objects.contacts.read — read contact records: creation date and lifecycle stage only. No personal details stored.",
      "crm.schemas.deals.read — read the deal pipeline and stage configuration to calculate pipeline value correctly.",
      "No write scopes requested. Fold cannot create, update, or delete any HubSpot records.",
    ],
    apiEndpoints: [
      { label: "POST /crm/v3/objects/deals/search (closed-won, date-filtered)", purpose: "Count deals closed-won on a given day and sum their revenue (amount field)." },
      { label: "POST /crm/v3/objects/deals/search (open deals, all stages)", purpose: "Sum the amount field of all open deals to calculate live pipeline value." },
      { label: "GET /crm/v3/objects/contacts?createdAfter={date}", purpose: "Count net-new contacts created on a given day. Contact names and emails are never extracted." },
      { label: "GET /crm/v3/pipelines/deals", purpose: "Read pipeline stage names to label the pipeline value breakdown correctly." },
    ],
    storedFields: [
      { field: "Deals closed-won (day)", example: "4 deals on 2025-04-23", purpose: "Daily sales velocity metric." },
      { field: "Closed-won revenue (day)", example: "$12,400 on 2025-04-23", purpose: "Daily CRM revenue KPI tile." },
      { field: "Open pipeline value", example: "$84,200 in pipeline", purpose: "Pipeline health widget." },
      { field: "New contacts created (day)", example: "18 new contacts", purpose: "Top-of-funnel growth metric." },
      { field: "Win rate (rolling 30 days)", example: "34%", purpose: "Sales efficiency KPI." },
    ],
    neverStored: [
      "Contact names, email addresses, phone numbers or company names",
      "Deal notes, activity logs or email threads",
      "Individual contact or deal IDs",
      "Meeting transcripts or call recordings",
      "Association data (which contact is linked to which company)",
      "Your HubSpot portal ID or API key",
    ],
    neverDoes: [
      "Create, update or delete deals, contacts, companies or activities",
      "Send emails or enroll contacts in sequences",
      "Modify pipeline stages or deal properties",
      "Access your HubSpot billing or account settings",
      "Share your CRM data with any third party",
      "Use your CRM data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → HubSpot → Disconnect. All synced HubSpot data is deleted immediately.",
      fromPlatform: "HubSpot → Settings → Integrations → Connected Apps → Fold Analytics → Uninstall.",
      platformRevokeUrl: "https://app.hubspot.com/integrations-settings/",
    },
    dataRetention: "Synced CRM snapshots are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours (yesterday's data). Manual refresh available from Settings.",
    privacyNote: "HubSpot stores significant personal data about your contacts and prospects. Fold is designed to read none of it — we only extract count and sum aggregates. Contact names, emails, company details and activity history are never extracted or stored by Fold.",
    faq: [
      {
        q: "Can Fold see my contacts' names or email addresses?",
        a: "No. We count new contacts created per day (the number 18, not who those 18 people are). Contact names, emails and phone numbers are never extracted or stored.",
      },
      {
        q: "Can Fold see the notes or emails I have logged against deals?",
        a: "No. We only read the deal amount, close date, and stage from the deal record. Notes, activity logs, email threads and meeting data are never accessed.",
      },
      {
        q: "I use HubSpot for both marketing and sales. Does Fold access the marketing side?",
        a: "No. We only request CRM scopes (deals and contacts). Marketing Hub data — emails, landing pages, workflows, social posts — is not accessible with the scopes we request.",
      },
      {
        q: "What happens to my HubSpot data if I cancel my Fold subscription?",
        a: "All synced data is deleted from Fold's servers within 24 hours of account closure. Disconnecting HubSpot from Settings → HubSpot → Disconnect will trigger immediate deletion.",
      },
    ],
    whyFoundersConnect: "If you're running a sales-led or product-led motion, your CRM is where revenue actually closes — but checking HubSpot daily just to see if you're on track is friction. Fold surfaces your closed-won revenue, pipeline value, and new-contact growth next to your marketing and product metrics, so you can see whether your top-of-funnel activity is actually converting.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "deals_closed_won", value: "4" },
      { label: "closed_revenue", value: "12400.00" },
      { label: "pipeline_value", value: "84200.00" },
      { label: "new_contacts", value: "18" },
      { label: "win_rate_30d", value: "34.0" },
    ],
    apiImpact: "Fold makes 4 API calls per sync using HubSpot's search API with date filters. This is negligible relative to HubSpot's 100 requests/10s rate limit and does not affect your portal's performance.",
  },

  // ── PostHog ───────────────────────────────────────────────────────────────
  posthog: {
    id: "posthog",
    name: "PostHog",
    tagline: "Product analytics — pageviews, sessions and unique users — read-only via HogQL.",
    color: "#f54e00",
    icon: "/integrations/posthog.svg",
    category: "Product Analytics",
    connectMethod: "api-key",
    connectSteps: [
      "Go to your PostHog project → Settings → Project API Keys.",
      'Create a new Personal API Key — name it "Fold Analytics" and select your project.',
      "Copy the key and paste it into Fold's Settings tab, along with your PostHog project ID.",
      "Fold validates the key, runs a test HogQL query, and performs an initial sync.",
      "Revoke the key from PostHog at any time to immediately stop all access.",
    ],
    scopesRequested: [
      "Personal API Key (project-scoped) — read access to PostHog query API (HogQL).",
      "Fold queries aggregate event counts only. No user-level data or session recordings are requested.",
      "No write access. Fold cannot create events, modify feature flags, or alter your PostHog project.",
    ],
    apiEndpoints: [
      {
        label: "POST /api/projects/{id}/query — HogQL: SELECT count() FROM events WHERE event='$pageview'",
        purpose: "Total pageview event count for the period.",
      },
      {
        label: "POST /api/projects/{id}/query — HogQL: SELECT count(DISTINCT distinct_id) FROM events",
        purpose: "Unique user (distinct person) count for the period.",
      },
      {
        label: "POST /api/projects/{id}/query — HogQL: SELECT count() FROM events WHERE event='$session_start'",
        purpose: "Session count (number of unique sessions started) for the period.",
      },
    ],
    storedFields: [
      { field: "Pageview count (day)", example: "3,420 pageviews on 2025-04-23", purpose: "Product traffic KPI tile." },
      { field: "Unique users (day)", example: "1,840 users on 2025-04-23", purpose: "Active user count metric." },
      { field: "Session count (day)", example: "2,110 sessions on 2025-04-23", purpose: "Engagement depth metric." },
    ],
    neverStored: [
      "Individual user distinct_id values, person profiles or person properties",
      "Session recording data or heatmaps",
      "Custom event properties or user properties",
      "Feature flag configurations or experiment results",
      "Funnel or retention data",
      "A/B test variant assignments",
      "Your PostHog project's tracking snippet or configuration",
    ],
    neverDoes: [
      "Create, modify or delete PostHog events, persons or groups",
      "Access or replay session recordings",
      "Read or modify feature flags or experiments",
      "Add or remove tracking instrumentation from your app",
      "Share your product analytics with any third party",
      "Use your product data to train AI models",
    ],
    howToRevoke: {
      fromFold: "Settings → PostHog → Disconnect. All synced PostHog data is deleted immediately.",
      fromPlatform: "PostHog → Settings → Personal API Keys → Revoke the Fold Analytics key.",
      platformRevokeUrl: "https://app.posthog.com/settings/user-api-keys",
    },
    dataRetention: "Synced metrics are retained while your Fold account is active and purged within 24 hours of disconnecting or account deletion.",
    refreshFrequency: "Automatic sync every 24 hours. Manual refresh available from Settings.",
    privacyNote: "PostHog stores rich per-user behavioural data — Fold deliberately avoids all of it. We only run 3 aggregate count queries (pageviews, unique users, sessions) that return a single number each. No person profiles, no event streams, no session recordings are ever accessed.",
    faq: [
      {
        q: "Does Fold access my PostHog user profiles or session recordings?",
        a: "No. We run 3 HogQL aggregate queries that return a single integer each — pageviews, unique users, sessions. No individual person data, properties or recordings are accessed.",
      },
      {
        q: "Can Fold read my feature flag configurations or A/B test results?",
        a: "No. The project API key we use only permits query access. Feature flags, experiments and cohorts require different API scopes that Fold does not request.",
      },
      {
        q: "I self-host PostHog. Does Fold work with self-hosted instances?",
        a: "Yes. Enter your self-hosted PostHog instance URL when connecting. Fold's HogQL queries work identically against both PostHog Cloud and self-hosted deployments.",
      },
      {
        q: "PostHog already has dashboards. Why use Fold?",
        a: "PostHog is great for deep product analysis. Fold is a daily summary layer — it puts your PostHog traffic numbers next to your Stripe revenue, your Mailchimp subscriber growth, and your Meta ad spend so you can see the full picture in one view.",
      },
    ],
    whyFoundersConnect: "PostHog gives you deep product analytics, but checking it daily just to answer 'did traffic go up or down?' is overkill. Fold pulls your daily pageview, user, and session counts into the same view as your revenue and marketing data — so you can spot correlations across channels without switching tools.",
    sampleSnapshot: [
      { label: "date", value: "2025-04-23" },
      { label: "pageviews", value: "3420" },
      { label: "unique_users", value: "1840" },
      { label: "sessions", value: "2110" },
    ],
    apiImpact: "Fold runs 3 HogQL queries per sync. Each query is a simple COUNT aggregation with a date filter and typically completes in under 500ms. This is negligible relative to PostHog's API limits.",
  },
};
