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
  icon: string; // SVG path string — rendered via dangerouslySetInnerHTML for portability
  iconViewBox?: string;
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
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#635bff" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>`,
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    description: "Sessions, users, bounce rate & conversions",
    category: "Web Analytics",
    color: "#4285F4",
    status: "live",
    connectUrl: "/api/auth/google/url",
    iconViewBox: "0 0 24 24",
    icon: `<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.3 0-7.99 2.47-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>`,
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Ad spend, reach, clicks & ROAS",
    category: "Advertising",
    color: "#1877f2",
    status: "live",
    connectUrl: "/api/auth/meta/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#1877f2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>`,
  },

  // ── COMING SOON — Payments & Revenue ─────────────────────────────────────

  {
    id: "paypal",
    name: "PayPal",
    description: "PayPal transactions, fees & payouts",
    category: "Payments & Revenue",
    color: "#003087",
    status: "live",
    connectUrl: "/api/auth/paypal/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#003087" d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 00-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.082-8.558 6.082H9.828l-1.29 8.18h3.318c.46 0 .852-.333.924-.789l.038-.196.733-4.655.047-.256a.932.932 0 01.924-.789h.581c3.765 0 6.712-1.53 7.572-5.956.36-1.848.173-3.391-.453-4.334z"/>`,
  },
  {
    id: "paddle",
    name: "Paddle",
    description: "SaaS billing, subscriptions & tax",
    category: "Payments & Revenue",
    color: "#3ddc97",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=paddle",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#3ddc97" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.133c-.144.668-.52.835-.996.52l-2.75-2.026-1.328 1.277c-.147.147-.27.27-.552.27l.196-2.797 5.086-4.593c.221-.196-.048-.306-.342-.11L6.78 14.748l-2.716-.848c-.59-.184-.6-.59.123-.872l10.605-4.087c.49-.18.92.112.77.307z"/>`,
  },
  {
    id: "lemon-squeezy",
    name: "Lemon Squeezy",
    description: "Digital products & subscription revenue",
    category: "Payments & Revenue",
    color: "#FFC233",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=lemon-squeezy",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#FFC233"/><text x="12" y="16" text-anchor="middle" fill="#13131f" font-size="11" font-weight="bold" font-family="sans-serif">LS</text>`,
  },
  {
    id: "gumroad",
    name: "Gumroad",
    description: "Creator product sales & subscription revenue",
    category: "Payments & Revenue",
    color: "#ff90e8",
    status: "live",
    connectUrl: "/api/auth/gumroad/url",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#ff90e8"/><text x="12" y="16" text-anchor="middle" fill="#1a1a1a" font-size="11" font-weight="bold" font-family="sans-serif">G</text>`,
  },

  // ── COMING SOON — Web Analytics ───────────────────────────────────────────

  {
    id: "plausible",
    name: "Plausible",
    description: "Privacy-first traffic analytics",
    category: "Web Analytics",
    color: "#5850ec",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=plausible",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#5850ec"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="sans-serif">P</text>`,
  },
  {
    id: "mixpanel",
    name: "Mixpanel",
    description: "Event tracking, funnels & retention",
    category: "Web Analytics",
    color: "#7856ff",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=mixpanel",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#7856ff"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">MX</text>`,
  },
  {
    id: "amplitude",
    name: "Amplitude",
    description: "Product analytics & behavioral cohorts",
    category: "Web Analytics",
    color: "#1e73be",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=amplitude",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#1e73be"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">A</text>`,
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Open-source product analytics & feature flags",
    category: "Web Analytics",
    color: "#f76300",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=posthog",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#f76300"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">PH</text>`,
  },
  {
    id: "fathom",
    name: "Fathom",
    description: "Cookie-free, GDPR-compliant analytics",
    category: "Web Analytics",
    color: "#9333ea",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=fathom",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#9333ea"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="sans-serif">F</text>`,
  },

  // ── COMING SOON — Advertising ─────────────────────────────────────────────

  {
    id: "google-ads",
    name: "Google Ads",
    description: "Search, display & Shopping campaign spend",
    category: "Advertising",
    color: "#4285F4",
    status: "live",
    connectUrl: "/api/auth/google-ads/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#4285F4" d="M2.215 14.518a5.152 5.152 0 001.892 7.034 5.152 5.152 0 007.034-1.892l4.79-8.297-4.47-2.58-9.246 5.735zm18.38-11.2a5.152 5.152 0 00-7.034 1.892L8.77 13.508l4.47 2.58 4.79-8.297a5.152 5.152 0 001.566-4.473zM7.587 17.972a2.576 2.576 0 11-4.46-2.576 2.576 2.576 0 014.46 2.576z"/>`,
  },
  {
    id: "tiktok-ads",
    name: "TikTok Ads",
    description: "TikTok campaign spend, reach & conversions",
    category: "Advertising",
    color: "#010101",
    status: "live",
    connectUrl: "/api/auth/tiktok-ads/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#010101" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34v-7a8.27 8.27 0 004.84 1.55V6.41a4.85 4.85 0 01-1.07-.28v.56z"/>`,
  },
  {
    id: "twitter-ads",
    name: "X (Twitter) Ads",
    description: "Promoted posts, impressions & cost-per-click",
    category: "Advertising",
    color: "#000000",
    status: "live",
    connectUrl: "/api/auth/twitter-ads/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#000000" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`,
  },
  {
    id: "linkedin-ads",
    name: "LinkedIn Ads",
    description: "B2B campaign spend, leads & engagement",
    category: "Advertising",
    color: "#0a66c2",
    status: "live",
    connectUrl: "/api/auth/linkedin-ads/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#0a66c2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>`,
  },
  {
    id: "snapchat-ads",
    name: "Snapchat Ads",
    description: "Snap campaign spend & story impressions",
    category: "Advertising",
    color: "#FFFC00",
    status: "live",
    connectUrl: "/api/auth/snapchat-ads/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#FFFC00" d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.023.35-.032.51.45.104.92-.019 1.512-.163.229-.057.49-.122.78-.167.17-.027.34-.003.489.07a.8.8 0 01.39.4.77.77 0 01.028.57c-.12.395-.57.682-1.166.935-.114.048-.234.09-.36.13-.21.065-.442.135-.57.26-.087.085-.1.187-.046.316l.002.006.003.008.048.108c.216.473.62 1.355.61 2.397-.02 1.56-.795 2.848-2.312 3.843a7.47 7.47 0 01-1.974.917c-.056.018-.107.028-.157.028-.115 0-.23-.047-.317-.132-.065-.063-.1-.143-.1-.228v-.002c0-.11.056-.22.17-.284.55-.31 1.175-1.048 1.52-1.73l.005-.01c-.17.038-.37.066-.565.066a2.67 2.67 0 01-1.175-.262c-.284-.13-.56-.26-.84-.373-.28-.11-.562-.19-.851-.19-.59 0-1.19.23-1.53.56-.04.04-.07.09-.09.14-.13.26-.26.52-.45.74-.37.42-.87.62-1.37.62-.13 0-.27-.02-.38-.04-.78-.18-1.3-.75-1.6-1.35-.06-.12-.11-.25-.14-.38-.14-.54-.08-1.09.08-1.62a3.5 3.5 0 01.22-.57 3.1 3.1 0 01-.32.02c-.37 0-.72-.07-1.05-.2a3.7 3.7 0 01-.72-.4c-.28-.22-.52-.48-.72-.78a4.6 4.6 0 01-.49-1.1 4.7 4.7 0 01-.16-.82 4 4 0 01.02-.75 3.73 3.73 0 01.3-1 3.5 3.5 0 01.7-.94c.22-.2.47-.37.73-.5.27-.13.55-.22.84-.26.16-.02.32-.03.48-.02.18.01.37.04.55.09.27.07.52.19.75.34.13.08.25.17.37.27.05-.17.09-.35.11-.53.04-.27.04-.55.04-.83 0-.9-.19-1.81-.56-2.64A5.52 5.52 0 0012.207.793z"/>`,
  },
  {
    id: "pinterest-ads",
    name: "Pinterest Ads",
    description: "Promoted Pin spend, saves & link clicks",
    category: "Advertising",
    color: "#E60023",
    status: "live",
    connectUrl: "/api/auth/pinterest-ads/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#E60023" d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>`,
  },

  // ── COMING SOON — Email & Marketing ──────────────────────────────────────

  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Email campaigns, opens, clicks & subscribers",
    category: "Email & Marketing",
    color: "#FFE01B",
    status: "live",
    connectUrl: "/api/auth/mailchimp/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#FFE01B" d="M21.543 10.775c-.166-.51-.458-.936-.838-1.205.042-.252.06-.512.046-.773-.076-1.405-1.03-2.57-2.411-2.93-.086-.023-.173-.04-.26-.054a3.64 3.64 0 00-.305-1.42C17.24 3.14 16.012 2.4 14.64 2.4c-.504 0-1.001.116-1.458.339a3.628 3.628 0 00-2.43-.936c-1.33 0-2.526.73-3.161 1.896a3.617 3.617 0 00-1.758 1.11c-.6.7-.87 1.6-.76 2.504-.955.569-1.542 1.596-1.542 2.724 0 .373.065.74.19 1.086-.41.414-.65.98-.65 1.576 0 .664.28 1.283.77 1.727-.12.338-.18.694-.18 1.055 0 1.737 1.42 3.15 3.165 3.15.214 0 .43-.022.638-.065.477.79 1.323 1.288 2.258 1.288.412 0 .812-.1 1.177-.294.424.44.997.685 1.607.685.547 0 1.074-.192 1.491-.542.495.538 1.19.838 1.927.838 1.467 0 2.66-1.185 2.66-2.642 0-.2-.025-.399-.073-.59.485-.41.771-.992.771-1.61a2.17 2.17 0 00-.54-1.425z"/>`,
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    description: "E-commerce email flows, revenue attributed",
    category: "Email & Marketing",
    color: "#1F1F20",
    status: "live",
    connectUrl: "/api/auth/klaviyo/url",
    iconViewBox: "0 0 24 24",
    icon: `<rect width="24" height="24" rx="4" fill="#1F1F20"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">KL</text>`,
  },
  {
    id: "convertkit",
    name: "Kit (ConvertKit)",
    description: "Subscriber growth, email sequences & open rates",
    category: "Email & Marketing",
    color: "#FB6970",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=convertkit",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#FB6970"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">CK</text>`,
  },
  {
    id: "activecampaign",
    name: "ActiveCampaign",
    description: "Email automation, contacts & campaign revenue",
    category: "Email & Marketing",
    color: "#356AE6",
    status: "live",
    connectUrl: "/api/auth/activecampaign/url",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#356AE6"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">AC</text>`,
  },
  {
    id: "brevo",
    name: "Brevo (Sendinblue)",
    description: "Email campaigns, SMS & transactional stats",
    category: "Email & Marketing",
    color: "#0092FF",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=brevo",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#0092FF"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">BR</text>`,
  },
  {
    id: "beehiiv",
    name: "Beehiiv",
    description: "Newsletter subscribers, opens & paid upgrades",
    category: "Email & Marketing",
    color: "#FF6B35",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=beehiiv",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#FF6B35"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">BH</text>`,
  },

  // ── COMING SOON — E-commerce ──────────────────────────────────────────────

  {
    id: "shopify",
    name: "Shopify",
    description: "Orders, GMV, refunds & product revenue",
    category: "E-commerce",
    color: "#96bf48",
    status: "live",
    connectUrl: "/api/auth/shopify/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#96bf48" d="M15.337 23.979l7.216-1.561s-2.597-17.565-2.617-17.693c-.018-.128-.128-.211-.237-.211-.108 0-2.011-.038-2.011-.038s-1.324-1.305-1.47-1.451V23.98zM12.41.971c-.02 0-.348.108-.886.274C11.019.502 10.424 0 9.672 0c-2.342 0-3.466 2.928-3.818 4.415-.917.285-1.561.483-1.633.507-.507.16-.525.178-.592.652C3.574 6.006 1.5 22.125 1.5 22.125L14.951 24V.97c-.228 0-.38.001-.541.001zm-1.14 7.328c-.607.188-1.27.394-1.935.6.186-.716.54-1.43.973-1.904.162-.173.387-.363.65-.474.257.512.319 1.22.312 1.778zm-1.296-4.72c.214 0 .395.045.556.125-.243.125-.487.314-.716.559-.586.636-.997 1.622-1.17 2.574-.54.167-1.065.33-1.553.48.432-1.473 1.45-3.738 2.883-3.738zm2.576 10.99c.064 1.017-2.737 1.097-2.73.073.034-.598.448-1.017.96-1.017.51 0 1.735.411 1.77.944z"/>`,
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "WordPress store orders, products & revenue",
    category: "E-commerce",
    color: "#7f54b3",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=woocommerce",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#7f54b3" d="M2.2 0h19.6C23 0 24 1 24 2.2v14.1c0 1.2-1 2.2-2.2 2.2H13l1.5 3.3-5.2-3.3H2.2C1 18.5 0 17.5 0 16.3V2.2C0 1 1 0 2.2 0z"/><path fill="#fff" d="M1.4 3.2c.2-.3.5-.4.8-.4h18.4c.3 0 .6.1.8.4.2.3.2.6.1.9l-3.1 9.3c-.1.4-.5.7-1 .7H7.6c-.4 0-.8-.2-1-.6L2.4 4c-.2-.2-.2-.5 0-.8zm6.2 8.2l.7-3.1 2.3 3.1 2.3-3.7.7 3.7h1.5L14 6.4h-1.4l-2.1 3.4-2.1-3.4H7l-1 5z"/>`,
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    description: "Enterprise store orders, catalog & revenue",
    category: "E-commerce",
    color: "#34313F",
    status: "live",
    connectUrl: "/api/auth/bigcommerce/url",
    iconViewBox: "0 0 24 24",
    icon: `<rect width="24" height="24" rx="4" fill="#34313F"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold" font-family="sans-serif">BC</text>`,
  },
  {
    id: "amazon-seller",
    name: "Amazon Seller",
    description: "Marketplace sales, fees & buy box metrics",
    category: "E-commerce",
    color: "#FF9900",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=amazon-seller",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#FF9900" d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.496.1.112.15.08.33-.07.544a13.23 13.23 0 01-2.64 2.1c-1.082.678-2.276 1.096-3.578 1.262-1.303.165-2.61.098-3.923-.2-1.31-.3-2.54-.836-3.69-1.613a16.43 16.43 0 01-3.01-2.78c-.1-.12-.12-.24-.056-.34zM17.63 6.02c1.025 0 1.86.43 2.47 1.3.634.895.95 2.07.95 3.515 0 1.474-.318 2.7-.957 3.673-.64.977-1.49 1.46-2.55 1.46-1.012 0-1.844-.488-2.494-1.46-.65-.97-.977-2.2-.977-3.673 0-1.44.328-2.62.984-3.516.656-.893 1.52-1.3 2.574-1.3zm-11.175 0c1.025 0 1.863.43 2.517 1.3.655.895.98 2.07.98 3.515 0 1.474-.326 2.7-.98 3.673-.65.977-1.493 1.46-2.517 1.46-1.027 0-1.867-.488-2.52-1.46-.654-.97-.98-2.2-.98-3.673 0-1.44.326-2.62.98-3.516.65-.893 1.49-1.3 2.52-1.3z"/>`,
  },
  {
    id: "etsy",
    name: "Etsy",
    description: "Handmade shop orders, views & conversion rate",
    category: "E-commerce",
    color: "#F56400",
    status: "live",
    connectUrl: "/api/auth/etsy/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#F56400" d="M9.16 0v.23c0 1.25-.44 2.9-2.62 2.9H5.63V5.4h2.64v8.98c0 3.42 1.7 5.1 5.03 5.1 1.3 0 2.82-.37 3.8-.83l-.56-2.25c-.6.23-1.2.4-1.86.4-1.46 0-2.06-.9-2.06-2.8V5.4h4.1l.38-2.27h-4.48V0z"/>`,
  },

  // ── COMING SOON — CRM & Sales ─────────────────────────────────────────────

  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM deals, pipeline value & close rates",
    category: "CRM & Sales",
    color: "#ff7a59",
    status: "live",
    connectUrl: "/api/auth/hubspot/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#ff7a59" d="M18.164 7.93V5.084a2.198 2.198 0 10-2.196 0V7.93a6.248 6.248 0 00-2.965 1.645L6.895 5.71a2.464 2.464 0 10-.717.996l6.034 3.83A6.238 6.238 0 0011.7 12.9c0 3.454 2.8 6.254 6.254 6.254 3.455 0 6.254-2.8 6.254-6.254a6.253 6.253 0 00-6.044-6.97zm0 9.78a3.516 3.516 0 110-7.032 3.516 3.516 0 010 7.033z"/>`,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Sales pipeline, won deals & ARR",
    category: "CRM & Sales",
    color: "#00A1E0",
    status: "live",
    connectUrl: "/api/auth/salesforce/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#00A1E0" d="M10.005 4.08a4.65 4.65 0 013.285 1.373 5.705 5.705 0 012.04-.378 5.725 5.725 0 015.725 5.724 5.72 5.72 0 01-1.296 3.654 4.22 4.22 0 01.6 2.19A4.245 4.245 0 0116.12 20.9a4.23 4.23 0 01-2.485-.808 5.97 5.97 0 01-2.81.702 5.97 5.97 0 01-4.05-1.576 4.22 4.22 0 01-2.85 1.104A4.245 4.245 0 01-.32 16.077a4.22 4.22 0 011.03-2.763 5.38 5.38 0 01-.477-2.218A5.42 5.42 0 015.654 5.68c.154 0 .307.006.458.018A4.65 4.65 0 0110.005 4.08z"/>`,
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Deals won, pipeline stages & revenue forecast",
    category: "CRM & Sales",
    color: "#30a04c",
    status: "live",
    connectUrl: "/api/auth/pipedrive/url",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#30a04c"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">PD</text>`,
  },
  {
    id: "notion",
    name: "Notion",
    description: "Database tables as structured business metrics",
    category: "CRM & Sales",
    color: "#000000",
    status: "live",
    connectUrl: "/api/auth/notion/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#000" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>`,
  },

  // ── COMING SOON — Customer Support ────────────────────────────────────────

  {
    id: "intercom",
    name: "Intercom",
    description: "Support volume, resolution time & CSAT",
    category: "Customer Support",
    color: "#1f8ded",
    status: "live",
    connectUrl: "/api/auth/intercom/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#1f8ded" d="M20 0H4C1.8 0 0 1.8 0 4v16c0 2.2 1.8 4 4 4h16c2.2 0 4-1.8 4-4V4c0-2.2-1.8-4-4-4zm-2 13.8c-1.8 1.6-4.2 2.5-6 2.5s-4.2-.9-6-2.5c-.4-.3-.4-.9-.1-1.2.3-.4.9-.4 1.2-.1C8.5 13.8 10.3 14.5 12 14.5s3.5-.7 4.9-1.9c.4-.3.9-.3 1.2.1.3.3.3.9-.1 1.1z"/>`,
  },
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Ticket volume, first-response time & satisfaction",
    category: "Customer Support",
    color: "#03363D",
    status: "live",
    connectUrl: "/api/auth/zendesk/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#03363D" d="M11.155 14.025l-7.4 8.587V14.025h7.4zm1.69 0v8.587l7.4-8.587h-7.4zM2 1.388A5.768 5.768 0 017.768 7.14h-5.77V1.388zm.006 6.617L11.155 1.4v6.605H2.006zM12.845 1.4l9.149 6.605h-9.15V1.4zm9.155 5.74A5.768 5.768 0 0116.232 1.39v5.75h5.768z"/>`,
  },
  {
    id: "freshdesk",
    name: "Freshdesk",
    description: "Support tickets, SLA breaches & satisfaction",
    category: "Customer Support",
    color: "#25C16F",
    status: "live",
    connectUrl: "/api/auth/freshdesk/url",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#25C16F"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">FD</text>`,
  },

  // ── COMING SOON — Product Analytics ──────────────────────────────────────

  {
    id: "segment",
    name: "Segment",
    description: "Customer data pipeline & event tracking",
    category: "Product Analytics",
    color: "#52BD94",
    status: "live",
    connectUrl: "/api/auth/segment/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#52BD94" d="M22.06 8.36H2.1a.56.56 0 00-.56.56v1.23c0 .31.25.56.56.56h19.96c.31 0 .56-.25.56-.56V8.92a.56.56 0 00-.56-.56zm-5.42 6.93H2.1a.56.56 0 00-.56.56v1.23c0 .31.25.56.56.56h14.54c.31 0 .56-.25.56-.56v-1.23a.56.56 0 00-.56-.56zM2.1 7.53h6.85c.31 0 .56-.25.56-.56V5.74a.56.56 0 00-.56-.56H2.1a.56.56 0 00-.56.56v1.23c0 .31.25.56.56.56z"/>`,
  },
  {
    id: "heap",
    name: "Heap",
    description: "Auto-captured events, funnels & session replays",
    category: "Product Analytics",
    color: "#FF5B5B",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=heap",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#FF5B5B"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">HP</text>`,
  },
  {
    id: "fullstory",
    name: "FullStory",
    description: "Session replays, rage clicks & friction score",
    category: "Product Analytics",
    color: "#3B1D8E",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=fullstory",
    iconViewBox: "0 0 24 24",
    icon: `<circle cx="12" cy="12" r="10" fill="#3B1D8E"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="sans-serif">FS</text>`,
  },
  {
    id: "hotjar",
    name: "Hotjar",
    description: "Heatmaps, session recordings & feedback surveys",
    category: "Product Analytics",
    color: "#FD3A5C",
    status: "live",
    connectUrl: "/dashboard?tab=settings&connect=hotjar",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#FD3A5C" d="M12 0C5.375 0 0 5.375 0 12s5.375 12 12 12 12-5.375 12-12S18.625 0 12 0zm2.438 17.438c-.126.062-.563.25-1.063.25-.75 0-1.25-.437-1.25-1.312v-4.5H9.938V10h2.187V7.875l1.813-.5V10h2.187v1.875h-2.187v4.25c0 .375.062.563.375.563.187 0 .437-.063.5-.063l.625 1.313z"/>`,
  },

  // ── COMING SOON — Social Media ────────────────────────────────────────────

  {
    id: "instagram",
    name: "Instagram Insights",
    description: "Followers, reach, impressions & profile visits",
    category: "Social Media",
    color: "#E1306C",
    status: "live",
    connectUrl: "/api/auth/instagram/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#E1306C" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>`,
  },
  {
    id: "youtube",
    name: "YouTube Analytics",
    description: "Views, watch time, subscribers & revenue",
    category: "Social Media",
    color: "#FF0000",
    status: "live",
    connectUrl: "/api/auth/youtube/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#FF0000" d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>`,
  },
  {
    id: "twitter-organic",
    name: "X (Twitter) Analytics",
    description: "Organic impressions, profile clicks & followers",
    category: "Social Media",
    color: "#000000",
    status: "live",
    connectUrl: "/api/auth/twitter-organic/url",
    iconViewBox: "0 0 24 24",
    icon: `<path fill="#000" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`,
  },
];

// Helper — only live integrations (used in OverviewTab onboarding wizard)
export const LIVE_INTEGRATIONS = INTEGRATIONS_CATALOG.filter((i) => i.status === "live");

// Helper — unique categories present in the catalog
export const INTEGRATION_CATEGORIES = Array.from(
  new Set(INTEGRATIONS_CATALOG.map((i) => i.category))
) as IntegrationCategory[];
