export interface Post {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date string
  readMinutes: number;
  category: "comparison" | "guide" | "strategy" | "tools";
}

export const posts: Post[] = [
  {
    slug: "fold-analytics-vs-databox",
    title: "Fold Analytics vs Databox: Which Is Better for Bootstrapped Founders?",
    description:
      "Databox is a polished BI tool built for marketing teams. Fold is built for solo founders who need answers, not dashboards. Here's an honest breakdown of what each does best.",
    publishedAt: "2025-09-01",
    readMinutes: 7,
    category: "comparison",
  },
  {
    slug: "fold-analytics-vs-chartmogul",
    title: "Fold Analytics vs ChartMogul: Beyond SaaS Metrics",
    description:
      "ChartMogul is the gold standard for subscription analytics. But if you sell more than just subscriptions, you need a tool that sees the whole picture. That's where Fold wins.",
    publishedAt: "2025-09-08",
    readMinutes: 6,
    category: "comparison",
  },
  {
    slug: "fold-analytics-vs-baremetrics",
    title: "Fold Analytics vs Baremetrics: Real-Time Pulse vs Deep Subscription Intel",
    description:
      "Baremetrics is powerful if your entire business runs on Stripe subscriptions. Fold connects every revenue stream and tells you what the numbers mean — not just what they are.",
    publishedAt: "2025-09-15",
    readMinutes: 6,
    category: "comparison",
  },
  {
    slug: "fold-analytics-vs-google-analytics",
    title: "Why Fold Analytics Replaces Google Analytics for SaaS Founders",
    description:
      "GA4 tracks pageviews. Fold tracks revenue. If you're a founder making product decisions, you need to know what drives money — not just traffic.",
    publishedAt: "2025-09-22",
    readMinutes: 8,
    category: "comparison",
  },
  {
    slug: "best-analytics-tools-indie-hackers",
    title: "The 7 Best Analytics Tools for Indie Hackers (2025 Edition)",
    description:
      "A no-BS roundup of the analytics stack indie hackers actually use — from free GA4 to paid BI tools — with honest trade-offs for each stage of growth.",
    publishedAt: "2025-10-01",
    readMinutes: 10,
    category: "tools",
  },
  {
    slug: "how-to-reduce-churn-saas",
    title: "How to Reduce SaaS Churn Before It Kills Your MRR",
    description:
      "Churn above 5% is a silent killer. Here's a playbook for identifying at-risk customers early, diagnosing root causes, and building retention loops that actually stick.",
    publishedAt: "2025-10-12",
    readMinutes: 9,
    category: "strategy",
  },
  {
    slug: "founder-metrics-that-matter",
    title: "The 12 Metrics Every Solo Founder Must Track (And 5 to Ignore)",
    description:
      "Vanity metrics feel good but don't pay the bills. This guide cuts through the noise and shows you exactly which numbers predict whether your business will succeed.",
    publishedAt: "2025-10-20",
    readMinutes: 8,
    category: "guide",
  },
  {
    slug: "how-to-connect-stripe-to-analytics",
    title: "How to Connect Stripe to Your Analytics Dashboard (Without Writing Code)",
    description:
      "Step-by-step guide to getting Stripe revenue data into an analytics platform — covering native options, third-party connectors, and what to do once the data flows.",
    publishedAt: "2025-11-03",
    readMinutes: 6,
    category: "guide",
  },
  {
    slug: "ad-spend-roi-calculator-guide",
    title: "How to Calculate True ROAS Across Meta, Google, and TikTok Ads",
    description:
      "Platform-reported ROAS is almost always inflated. Learn how to calculate blended ROAS yourself, avoid double attribution, and make smarter budget decisions.",
    publishedAt: "2025-11-15",
    readMinutes: 7,
    category: "strategy",
  },
  {
    slug: "one-dashboard-all-revenue-streams",
    title: "Why Every Founder Needs One Dashboard That Shows All Revenue Streams",
    description:
      "Running Stripe, Gumroad, and Shopify side by side means you're always stitching data in spreadsheets. Here's how to unify everything into a single real-time view.",
    publishedAt: "2025-12-01",
    readMinutes: 6,
    category: "strategy",
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export const categoryLabel: Record<Post["category"], string> = {
  comparison: "Comparison",
  guide: "Guide",
  strategy: "Strategy",
  tools: "Tools",
};

export const categoryColor: Record<Post["category"], string> = {
  comparison: "#6366f1",
  guide: "#00d4aa",
  strategy: "#f59e0b",
  tools: "#f87171",
};
