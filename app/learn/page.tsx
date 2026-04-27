import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/app/_components/PageClientIslands";
import { INTEGRATIONS_CATALOG } from "@/lib/integrations/catalog";
import { PLATFORM_DETAILS } from "@/lib/integrations/platform-details";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How Fold Works — Every Feature, Every Integration Explained",
  description:
    "The complete guide to Fold Analytics. Understand exactly what Fold does, how it pulls your data, how the AI works, and why it saves indie founders 3+ hours every week.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-mono text-3xl font-bold text-[#f8f8fc] sm:text-4xl">
      {children}
    </h2>
  );
}

function SectionSub({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-4 max-w-2xl text-[#bcbcd8] leading-relaxed">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-20 border-t border-[#363650]" />;
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-[#e0e0f0]">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-[#00d4aa]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Tag({ children, color = "#00d4aa" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
      style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
    >
      {children}
    </span>
  );
}

function ModuleCard({
  icon,
  color,
  label,
  title,
  description,
  bullets,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-7 md:p-9">
      <div className="flex items-start gap-5 mb-6">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
          style={{ color, backgroundColor: `${color}12`, borderColor: `${color}30` }}
        >
          {icon}
        </div>
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color }}>
            {label}
          </p>
          <h3 className="font-mono text-xl font-bold text-[#f8f8fc]">{title}</h3>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-[#bcbcd8] mb-5">{description}</p>
      <ul className="space-y-2.5">
        {bullets.map((b) => (
          <Check key={b}>{b}</Check>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const liveIntegrations = INTEGRATIONS_CATALOG.filter((i) => i.status === "live");
  const soonIntegrations = INTEGRATIONS_CATALOG.filter((i) => i.status === "soon");

  const integrationDetails: Record<string, { what: string; metrics: string[] }> = {
    stripe: {
      what: "Fold connects via OAuth to your Stripe account and pulls your complete billing data.",
      metrics: [
        "Monthly Recurring Revenue (MRR) and Annual Recurring Revenue (ARR)",
        "New customers, churned customers, net growth this period",
        "Transaction volume, average transaction value",
        "Failed payments and recovery rate",
        "Revenue by product / price plan",
      ],
    },
    ga4: {
      what: "Fold reads your Google Analytics 4 data through the official Reporting API — no sampling.",
      metrics: [
        "Sessions, users, new vs returning",
        "Bounce rate and average session duration",
        "Top pages by traffic and engagement",
        "Traffic sources: organic, paid, direct, referral, social",
        "Goal completions and conversion events",
      ],
    },
    meta: {
      what: "Connected via Meta Marketing API. Fold reads your ad account spend and performance.",
      metrics: [
        "Total ad spend across all campaigns",
        "Impressions, reach, click-through rate",
        "Cost per click (CPC) and cost per result",
        "Return on Ad Spend (ROAS)",
        "Campaign-level breakdown",
      ],
    },
    "lemon-squeezy": {
      what: "Fold connects using your Lemon Squeezy API key and reads your store data.",
      metrics: [
        "Gross revenue and net revenue (after fees)",
        "New subscriptions, renewals and cancellations",
        "Revenue by product",
        "Refund rate",
        "Subscription status breakdown (active, paused, cancelled)",
      ],
    },
    gumroad: {
      what: "Fold uses the Gumroad OAuth API to pull creator sales data in real time.",
      metrics: [
        "Total sales revenue and units sold",
        "Sales by product",
        "New customers vs returning customers",
        "Subscription MRR from membership products",
        "Refunds issued",
      ],
    },
    paddle: {
      what: "Fold connects using your Paddle API credentials and reads transactions and subscriptions.",
      metrics: [
        "Net revenue after Paddle's Merchant of Record fees and taxes",
        "MRR, new subscriptions and churn",
        "Transaction volume by country",
        "Refund and dispute metrics",
        "Plan-level revenue breakdown",
      ],
    },
    mailchimp: {
      what: "Connected via Mailchimp OAuth. Fold reads your email list and campaign performance.",
      metrics: [
        "Total subscriber count, growth rate",
        "Open rate, click rate, unsubscribe rate per campaign",
        "List health: bounces and spam complaints",
        "Revenue attributed to email campaigns (if e-commerce tracking enabled)",
        "Audience growth trend over time",
      ],
    },
    klaviyo: {
      what: "Fold connects via the Klaviyo API to read email, SMS and automation performance.",
      metrics: [
        "Email campaign open rates and click rates",
        "Revenue attributed to flows and campaigns",
        "Active profiles and list growth",
        "Unsubscribe and bounce rates",
        "SMS send and response stats",
      ],
    },
    beehiiv: {
      what: "Fold connects to the Beehiiv API to track your newsletter growth and monetization.",
      metrics: [
        "Total subscribers and net growth this period",
        "Open rate and click rate per issue",
        "Paid upgrade conversions (free → paid subscribers)",
        "Premium subscription revenue",
        "Subscriber churn rate",
      ],
    },
    plausible: {
      what: "Fold connects via Plausible's Stats API — privacy-first, no cookies, GDPR compliant.",
      metrics: [
        "Unique visitors and total pageviews",
        "Sessions and pages per session",
        "Bounce rate",
        "Traffic sources breakdown",
        "Top pages by visits",
      ],
    },
    shopify: {
      what: "Fold uses Shopify's Admin API to pull your store orders and product data.",
      metrics: [
        "Gross Merchandise Value (GMV) and net revenue",
        "Total orders, average order value (AOV)",
        "New vs returning customer revenue split",
        "Refund rate",
        "Best-selling products by revenue",
      ],
    },
    woocommerce: {
      what: "Fold connects to your WooCommerce REST API endpoint to read store data.",
      metrics: [
        "Total sales and order count",
        "Average order value",
        "New customer vs returning customer split",
        "Top products by revenue",
        "Refund and cancellation stats",
      ],
    },
  };

  const categories = [
    ...new Set(INTEGRATIONS_CATALOG.map((i) => i.category)),
  ];

  return (
    <div className="min-h-screen bg-[#13131f] text-[#f8f8fc]">
      <Nav />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-36 pb-20 px-6">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-125 w-200 rounded-full bg-[#00d4aa]/4 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa]" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">
              Complete product guide
            </span>
          </div>
          <h1 className="font-mono text-4xl font-bold tracking-tight text-[#f8f8fc] sm:text-5xl lg:text-6xl mb-6">
            Everything Fold does{" "}
            <span className="text-[#00d4aa]">explained</span>
          </h1>
          <p className="text-lg text-[#bcbcd8] max-w-2xl mx-auto leading-relaxed">
            This page covers every feature, every integration, every data point, and every AI
            capability that Fold offers. If you&apos;re on the fence, read this first.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0] hover:shadow-[0_0_30px_rgba(0,212,170,0.3)]"
            >
              Start free — 7 day trial
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
            <a
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-[#a78bfa]/40 bg-[#a78bfa]/8 px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-[#a78bfa] transition-all hover:border-[#a78bfa]/70"
            >
              See live demo
            </a>
          </div>
        </div>
      </section>

      {/* ── TABLE OF CONTENTS ─────────────────────────────────────────────── */}
      <section className="border-y border-[#363650] bg-[#1c1c2a]/40 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] mb-4 text-center">
            On this page
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
            {[
              { label: "The problem Fold solves", href: "#problem" },
              { label: "Who it's for", href: "#who" },
              { label: "The 4 dashboard modules", href: "#modules" },
              { label: "All integrations", href: "#integrations" },
              { label: "How the AI works", href: "#ai" },
              { label: "Data & security", href: "#security" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="font-mono text-xs text-[#8585aa] hover:text-[#00d4aa] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-20 space-y-0">

        {/* ── PROBLEM ─────────────────────────────────────────────────────── */}
        <section id="problem">
          <div className="text-center mb-14">
            <SectionLabel>The problem</SectionLabel>
            <SectionHeading>Founders are drowning in tabs, not insights</SectionHeading>
            <SectionSub>
              If you run any kind of online business — SaaS, e-commerce, newsletter, creator business —
              your data lives in a dozen different places. None of them talk to each other. You end up
              spending hours every week just gathering numbers before you can even start thinking.
            </SectionSub>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-10">
            {[
              {
                title: "The typical founder's Monday morning",
                items: [
                  "Open Stripe to check MRR",
                  "Open Google Analytics to check traffic",
                  "Open Meta Ads Manager to check ad spend",
                  "Open Mailchimp to see email open rates",
                  "Open Shopify to see order volume",
                  "Copy everything into a spreadsheet",
                  "Try to figure out if the numbers are good or bad",
                  "Run out of time. Skip the analysis.",
                ],
                bad: true,
              },
              {
                title: "With Fold",
                items: [
                  "Open one dashboard. Everything is there.",
                  "Read one AI summary that explains what changed",
                  "Understand exactly why revenue went up or down",
                  "Get a prioritized list of what to focus on today",
                  "Done. Close the laptop.",
                ],
                bad: false,
              },
            ].map((col) => (
              <div
                key={col.title}
                className={`rounded-2xl border p-6 ${
                  col.bad
                    ? "border-[#f87171]/20 bg-[#f87171]/4"
                    : "border-[#00d4aa]/25 bg-[#00d4aa]/4"
                }`}
              >
                <p
                  className={`font-mono text-xs font-semibold uppercase tracking-widest mb-4 ${
                    col.bad ? "text-[#f87171]" : "text-[#00d4aa]"
                  }`}
                >
                  {col.title}
                </p>
                <ul className="space-y-2.5">
                  {col.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[#e0e0f0]">
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-bold text-[9px] ${
                          col.bad
                            ? "bg-[#f87171]/15 text-[#f87171]"
                            : "bg-[#00d4aa]/15 text-[#00d4aa]"
                        }`}
                      >
                        {col.bad ? "✕" : "✓"}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
            <p className="text-sm text-[#bcbcd8] leading-relaxed">
              <strong className="text-[#f8f8fc]">The core insight behind Fold:</strong> The problem
              isn&apos;t that founders don&apos;t care about their data. The problem is that gathering
              and interpreting data takes so long that most founders skip it. Fold eliminates the
              gathering and the interpreting — so you can act on your data instead of drowning in it.
            </p>
          </div>
        </section>

        <Divider />

        {/* ── WHO IT'S FOR ─────────────────────────────────────────────────── */}
        <section id="who">
          <div className="text-center mb-14">
            <SectionLabel>Who it&apos;s for</SectionLabel>
            <SectionHeading>Built for founders running real businesses</SectionHeading>
            <SectionSub>
              Fold is not an enterprise BI tool. It&apos;s not built for data analysts. It&apos;s
              built for the founder who is also the marketer, the developer, the customer support,
              and the finance team — all in one person.
            </SectionSub>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {[
              {
                title: "SaaS founders",
                description:
                  "Track MRR, churn, new subscriptions, trial conversions and the traffic that drives them — all in one place.",
                tags: ["Stripe", "GA4", "Meta Ads"],
              },
              {
                title: "E-commerce founders",
                description:
                  "Connect Shopify or WooCommerce with your email (Klaviyo/Mailchimp) and ad spend to see true ROI per channel.",
                tags: ["Shopify", "Klaviyo", "Meta Ads"],
              },
              {
                title: "Newsletter creators",
                description:
                  "See subscriber growth, open rates, and paid upgrade conversions next to the traffic sources driving your growth.",
                tags: ["Beehiiv", "GA4", "Stripe"],
              },
              {
                title: "Digital product sellers",
                description:
                  "Track Gumroad or Lemon Squeezy revenue, see which channels convert, and optimize your ad spend daily.",
                tags: ["Gumroad", "Lemon Squeezy", "Meta Ads"],
              },
              {
                title: "Indie hackers",
                description:
                  "Get the business intelligence of a funded startup without hiring an analyst or building internal dashboards.",
                tags: ["Multiple tools", "AI insights"],
              },
              {
                title: "Agency & freelance owners",
                description:
                  "Understand which client channels perform, track retainer revenue and get a clear weekly business snapshot.",
                tags: ["Stripe", "GA4"],
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5"
              >
                <h3 className="font-mono text-sm font-bold text-[#f8f8fc] mb-2">{card.title}</h3>
                <p className="text-sm text-[#bcbcd8] leading-relaxed mb-3">{card.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {card.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa] mb-3">
              Fold is probably NOT right for you if…
            </p>
            <ul className="space-y-2">
              {[
                "You need a custom BI tool with SQL queries and raw data access — consider Metabase or Redash instead.",
                "You're a data analyst building reports for a large team — consider Looker or Tableau.",
                "You haven't launched yet and have zero metrics — come back once you have real data to look at.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#8585aa]">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#8585aa]/10 text-[#8585aa] font-bold text-[9px]">
                    →
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Divider />

        {/* ── MODULES ──────────────────────────────────────────────────────── */}
        <section id="modules">
          <div className="text-center mb-14">
            <SectionLabel>Dashboard modules</SectionLabel>
            <SectionHeading>Four views. Complete business intelligence.</SectionHeading>
            <SectionSub>
              Fold&apos;s dashboard is organized into four purpose-built modules. Each one answers
              a different question about your business. Together, they give you the full picture.
            </SectionSub>
          </div>

          <div className="space-y-5">
            <ModuleCard
              color="#00d4aa"
              label="Module 1 · Overview"
              title="Your entire business at a glance"
              icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              }
              description="The Overview tab is the first thing you see when you log in. It shows a unified view of your most important KPIs from every connected integration — all on one screen, all updated automatically."
              bullets={[
                "Revenue KPI tile — current period vs previous period, % change, trend sparkline",
                "Traffic KPI tile — sessions, users, bounce rate from GA4 or Plausible",
                "Ad spend KPI tile — total spend across Meta Ads (and more as you connect)",
                "Email KPI tile — subscribers, open rate, click rate from Mailchimp / Klaviyo / Beehiiv",
                "Each tile shows the current value, the delta vs the previous period, and a 7-day sparkline so you spot trends instantly",
                "Tiles only appear for integrations you've connected — no empty noise",
                "Data refreshes automatically every 24 hours",
                "Designed to answer: 'Is my business healthy right now?'",
              ]}
            />

            <ModuleCard
              color="#a78bfa"
              label="Module 2 · AI Insights"
              title="Your business analyst, always on"
              icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              }
              description="The AI tab is Fold's most powerful feature. It's a conversational AI assistant that has full access to all your connected data and can answer questions, surface anomalies, and give you actionable recommendations — in plain English, no data skills required."
              bullets={[
                "Daily AI insight: every morning, Fold generates a 2-3 sentence summary of what changed in your business yesterday and why",
                "Anomaly detection: Fold flags unexpected drops or spikes and explains the likely cause",
                "Ask anything: type any question — 'Why did revenue drop last Tuesday?' or 'Which ad channel has the best ROI?' — and get a specific, data-backed answer",
                "Web analysis: paste any URL and Fold will analyze that page and give you specific conversion optimization suggestions",
                "Prioritized action list: every day, Fold gives you 3-5 specific things to do based on your actual data",
                "Context-aware: the AI sees all your connected integrations simultaneously — so it can correlate ad spend spikes with traffic drops with revenue changes",
                "Powered by GPT-4 with your live data injected as context",
              ]}
            />

            <ModuleCard
              color="#60a5fa"
              label="Module 3 · Web Analytics"
              title="Deep dive into your website traffic"
              icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              }
              description="The Web tab gives you a full breakdown of your website traffic from Google Analytics 4 or Plausible. Not just the top-line numbers — but the details that help you understand where your visitors come from, which pages they read, and what makes them convert."
              bullets={[
                "Session and user trends over the last 7, 30, or 90 days",
                "Traffic source breakdown: organic search, paid search, social, email, direct, referral",
                "Top landing pages by visits and engagement time",
                "Bounce rate and pages-per-session for each traffic source",
                "New vs returning visitor split",
                "Device breakdown: desktop vs mobile vs tablet",
                "Geographic distribution of your audience",
                "Conversion events and goal completions (GA4)",
                "Designed to answer: 'Where is my traffic coming from and what's converting?'",
              ]}
            />

            <ModuleCard
              color="#f59e0b"
              label="Module 4 · Integrations & Settings"
              title="Connect, manage, and control your data"
              icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              }
              description="The Settings tab is where you connect and manage all your integrations. Every integration is one click to connect via OAuth or API key — no code, no webhooks, no spreadsheet exports."
              bullets={[
                "Integration catalog: browse all available integrations organized by category",
                "One-click OAuth connect for most integrations (Stripe, GA4, Meta Ads, Mailchimp, Gumroad, Shopify)",
                "API key connect for integrations that use key-based auth (Lemon Squeezy, Beehiiv, Plausible, Klaviyo, WooCommerce)",
                "Connection status: see last sync time and whether each integration is healthy",
                "Disconnect any integration in one click — your data is deleted from our servers immediately",
                "Account settings: update email, password, and billing details",
                "Upgrade / downgrade plan from inside the dashboard",
              ]}
            />
          </div>
        </section>

        <Divider />

        {/* ── INTEGRATIONS ─────────────────────────────────────────────────── */}
        <section id="integrations">
          <div className="text-center mb-14">
            <SectionLabel>Integrations</SectionLabel>
            <SectionHeading>Every tool. Every data point. Explained.</SectionHeading>
            <SectionSub>
              Fold currently has{" "}
              <strong className="text-[#f8f8fc]">{liveIntegrations.length} live integrations</strong>{" "}
              and{" "}
              <strong className="text-[#f8f8fc]">{soonIntegrations.length} more in development</strong>.
              Here&apos;s exactly what each one pulls and how it connects.
            </SectionSub>
          </div>

          {/* Live integrations detail */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-2 w-2 rounded-full bg-[#00d4aa]" />
              <p className="font-mono text-sm font-semibold uppercase tracking-widest text-[#00d4aa]">
                Live now — {liveIntegrations.length} integrations
              </p>
            </div>
            <div className="space-y-4">
              {liveIntegrations.map((integration) => {
                const detail = integrationDetails[integration.id];
                return (
                  <div
                    key={integration.id}
                    className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border overflow-hidden"
                        style={{
                          backgroundColor: `${integration.color}15`,
                          borderColor: `${integration.color}30`,
                        }}
                      >
                        <img
                          src={integration.icon}
                          alt={integration.name}
                          width={22}
                          height={22}
                          className="object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-mono text-base font-bold text-[#f8f8fc]">
                            {integration.name}
                          </h3>
                          <Tag color={integration.color}>{integration.category}</Tag>
                          <Tag color="#00d4aa">Live</Tag>
                        </div>
                        <p className="text-sm text-[#bcbcd8]">{integration.description}</p>
                      </div>
                    </div>
                    {detail ? (
                      <>
                        <p className="text-sm text-[#bcbcd8] mb-3 leading-relaxed">{detail.what}</p>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] mb-2">
                          Metrics pulled:
                        </p>
                        <ul className="space-y-1.5">
                          {detail.metrics.map((m) => (
                            <Check key={m}>{m}</Check>
                          ))}
                        </ul>
                        {PLATFORM_DETAILS[integration.id] && (
                          <div className="mt-5 pt-4 border-t border-[#363650]">
                            <Link
                              href={`/learn/${integration.id}`}
                              className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#00d4aa] hover:underline underline-offset-2"
                            >
                              See full data breakdown — what we store, what we never touch, how to revoke
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </Link>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-[#8585aa]">{integration.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coming soon integrations */}
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
              <p className="font-mono text-sm font-semibold uppercase tracking-widest text-[#f59e0b]">
                Coming soon — {soonIntegrations.length} more
              </p>
            </div>
            <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/40 p-6">
              <p className="text-sm text-[#bcbcd8] mb-5 leading-relaxed">
                These integrations are in development. They appear as cards in your dashboard so you
                can see what&apos;s coming, but they don&apos;t connect yet. We ship new integrations
                every 2-4 weeks based on founder demand.
              </p>
              <div className="flex flex-wrap gap-3">
                {soonIntegrations.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center gap-2 rounded-lg border border-[#363650] bg-[#222235] px-3 py-2"
                  >
                    <div
                      className="h-6 w-6 flex items-center justify-center rounded overflow-hidden"
                      style={{ backgroundColor: `${i.color}15` }}
                    >
                      <img
                        src={i.icon}
                        alt={i.name}
                        width={14}
                        height={14}
                        className="object-contain"
                      />
                    </div>
                    <span className="font-mono text-xs text-[#bcbcd8]">{i.name}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-[10px] text-[#8585aa]">
                Missing an integration you need?{" "}
                <a
                  href="mailto:info@usefold.io"
                  className="text-[#00d4aa] underline underline-offset-2 hover:no-underline"
                >
                  Email us
                </a>{" "}
                — we prioritize based on founder requests.
              </p>
            </div>
          </div>

          {/* Categories summary */}
          <div className="mt-10 rounded-2xl border border-[#363650] bg-[#1c1c2a]/40 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] mb-4 text-center">
              Integration categories
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((cat) => {
                const count = INTEGRATIONS_CATALOG.filter((i) => i.category === cat).length;
                const liveCount = INTEGRATIONS_CATALOG.filter(
                  (i) => i.category === cat && i.status === "live"
                ).length;
                return (
                  <div
                    key={cat}
                    className="rounded-lg border border-[#363650] bg-[#222235] px-3 py-2 text-center"
                  >
                    <p className="font-mono text-xs font-semibold text-[#f8f8fc]">{cat}</p>
                    <p className="font-mono text-[9px] text-[#8585aa]">
                      {liveCount} live · {count - liveCount} soon
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <Divider />

        {/* ── HOW THE AI WORKS ─────────────────────────────────────────────── */}
        <section id="ai">
          <div className="text-center mb-14">
            <SectionLabel>AI intelligence</SectionLabel>
            <SectionHeading>How Fold&apos;s AI actually works</SectionHeading>
            <SectionSub>
              The AI in Fold isn&apos;t a chatbot that knows nothing about your business. It&apos;s
              an analyst that reads your actual numbers before every response.
            </SectionSub>
          </div>

          <div className="space-y-4">
            {[
              {
                n: "01",
                title: "Data is fetched from your integrations",
                description:
                  "When you open the AI tab or trigger an analysis, Fold pulls the latest data from every integration you've connected — revenue, traffic, ad spend, email stats. This data is formatted into a structured context block.",
              },
              {
                n: "02",
                title: "Your context is injected into the AI prompt",
                description:
                  "The structured data (your actual KPIs, trends, and delta vs previous periods) is sent to GPT-4 as context. The AI doesn't guess — it reads your real numbers. It knows your MRR is $4,200, not a generic SaaS benchmark.",
              },
              {
                n: "03",
                title: "The AI explains, correlates, and recommends",
                description:
                  "GPT-4 analyzes the combined data across all your tools simultaneously. It can see that your traffic dropped 20% and your ad spend was paused on the same day. A human analyst would catch that — and now so does Fold.",
              },
              {
                n: "04",
                title: "You get plain English, not a chart",
                description:
                  "Every insight is written in clear, founder-friendly language. No jargon, no statistical noise. Just 'Your MRR dropped $340 this week — 4 customers canceled, likely after the trial ended. Your free-to-paid conversion rate is 8%, below the 15% benchmark. Consider adding an in-app onboarding nudge.'",
              },
              {
                n: "05",
                title: "You can ask follow-up questions",
                description:
                  "The AI remembers the conversation context. Ask 'which channel drove the most conversions last month?' then 'what would happen if I doubled that budget?' — it tracks the thread and gives consistent, data-backed answers.",
              },
            ].map((step) => (
              <div
                key={step.n}
                className="flex gap-5 rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#a78bfa]/30 bg-[#a78bfa]/8 font-mono text-sm font-bold text-[#a78bfa]">
                  {step.n}
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-[#f8f8fc] mb-2">{step.title}</h3>
                  <p className="text-sm text-[#bcbcd8] leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#a78bfa]/20 bg-[#a78bfa]/4 p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a78bfa] mb-3">
              Things the AI can do for you right now
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "Explain why MRR changed this week",
                "Find your highest-ROI ad channel",
                "Spot the page with the worst bounce rate",
                "Tell you which email campaign drove the most clicks",
                "Forecast next month's revenue based on current trends",
                "Analyze a landing page and suggest improvements",
                "Identify your biggest churn risk",
                "Compare this month vs last month across all tools",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 text-sm text-[#e0e0f0]"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#a78bfa]/15 text-[#a78bfa] font-mono text-[9px]">
                    AI
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <Divider />

        {/* ── SECURITY ─────────────────────────────────────────────────────── */}
        <section id="security">
          <div className="text-center mb-14">
            <SectionLabel>Data & security</SectionLabel>
            <SectionHeading>Your data is yours. We take that seriously.</SectionHeading>
            <SectionSub>
              Every integration requires you to explicitly authorize Fold. We never store your
              passwords. We never write to your accounts. Here&apos;s exactly how it works.
            </SectionSub>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {[
              {
                icon: (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
                color: "#00d4aa",
                title: "OAuth 2.0 — no passwords",
                description:
                  "Most integrations connect via OAuth 2.0. You authorize Fold on the platform's own login page. We receive a scoped access token — never your password. You can revoke access from the platform directly at any time.",
              },
              {
                icon: (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                ),
                color: "#60a5fa",
                title: "TLS 1.3 in transit",
                description:
                  "All communication between Fold and third-party APIs — and between your browser and Fold's servers — uses TLS 1.3 encryption. Your data cannot be intercepted in transit.",
              },
              {
                icon: (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ),
                color: "#a78bfa",
                title: "Read-only access only",
                description:
                  "Fold never writes to your accounts. When you connect Stripe, we can read your transactions — but we cannot create charges, issue refunds, or modify any data. The same applies to every integration.",
              },
              {
                icon: (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                ),
                color: "#f59e0b",
                title: "AES-256 encrypted at rest",
                description:
                  "All your synced data is stored in Supabase with AES-256 encryption at rest. Access tokens are encrypted before being stored. Your data is isolated per account — no shared tables.",
              },
              {
                icon: (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                ),
                color: "#f87171",
                title: "Delete everything instantly",
                description:
                  "Disconnect any integration from the Settings tab and we delete all synced data for that integration from our servers immediately. Close your account and all your data is purged within 24 hours.",
              },
              {
                icon: (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ),
                color: "#00d4aa",
                title: "GDPR compliant",
                description:
                  "Fold is built with GDPR in mind. You have the right to access, correct, and delete all data we hold about you and your business. We never sell data to third parties. Ever.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      color: item.color,
                      backgroundColor: `${item.color}12`,
                      borderColor: `${item.color}30`,
                    }}
                  >
                    {item.icon}
                  </div>
                  <h3 className="font-mono text-sm font-bold text-[#f8f8fc] mt-1.5">{item.title}</h3>
                </div>
                <p className="text-sm text-[#bcbcd8] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa] mb-3">
              Infrastructure
            </p>
            <ul className="space-y-2">
              {[
                "Hosted on Vercel (edge network, global CDN, automatic HTTPS)",
                "Database: Supabase Postgres (EU region) with row-level security enabled",
                "No third-party analytics on user data — we don't share your business metrics with anyone",
                "AI queries sent to OpenAI are not used for model training (Enterprise API agreement)",
                "API tokens are encrypted with AES-256 before storage and never logged",
              ].map((item) => (
                <Check key={item}>{item}</Check>
              ))}
            </ul>
          </div>
        </section>

        <Divider />

        {/* ── PRICING ──────────────────────────────────────────────────────── */}
        <section id="pricing">
          <div className="text-center mb-14">
            <SectionLabel>Pricing</SectionLabel>
            <SectionHeading>Simple, transparent, founder-priced</SectionHeading>
            <SectionSub>
              One plan. No seats. No usage limits. No feature gating. Connect all your integrations
              and use the full AI — from day one.
            </SectionSub>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free plan */}
            <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-8 flex flex-col">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa] mb-3">
                Free trial
              </p>
              <div className="flex items-end gap-1.5 mb-4">
                <span className="font-mono text-5xl font-bold text-[#f8f8fc]">$0</span>
                <span className="font-mono text-sm text-[#8585aa] mb-1.5">/ 7 days</span>
              </div>
              <p className="text-sm text-[#bcbcd8] mb-6">
                Full access to everything — all integrations, AI insights, web analytics. No credit
                card required to start.
              </p>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "All integrations (live ones)",
                  "Full AI insights module",
                  "Web analytics module",
                  "Overview dashboard",
                  "No credit card to start",
                ].map((f) => (
                  <Check key={f}>{f}</Check>
                ))}
              </ul>
              <a
                href="/signup"
                className="block w-full rounded-xl border border-[#363650] py-3 text-center font-mono text-sm font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-[#00d4aa]/40 hover:text-[#00d4aa]"
              >
                Start free trial
              </a>
            </div>

            {/* Pro plan */}
            <div className="relative rounded-2xl border border-[#00d4aa]/40 bg-[#00d4aa]/5 shadow-[0_0_60px_rgba(0,212,170,0.08)] p-8 flex flex-col">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full border border-[#00d4aa]/40 bg-[#13131f] px-4 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
                Pro — Full access
              </div>
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa] mb-3">
                Pro
              </p>
              <div className="mb-4">
                <div className="inline-flex items-baseline gap-1.5 rounded-xl border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-3.5 py-2 mb-2">
                  <span className="font-mono text-5xl font-bold text-[#00d4aa]">$29</span>
                  <span className="font-mono text-sm text-[#00d4aa]/70">/ month</span>
                </div>
                <p className="font-mono text-xs text-[#8585aa]">Cancel anytime. No contracts.</p>
              </div>
              <p className="text-sm text-[#bcbcd8] mb-6">
                Everything in the trial, forever. Unlimited AI queries, all integrations unlocked,
                daily auto-refresh.
              </p>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "Unlimited AI insights & chat",
                  "All live integrations (11 now, more monthly)",
                  "Daily automatic data refresh",
                  "Web analytics deep dive",
                  "Anomaly detection & alerts",
                  "Priority email support",
                  "Early access to new integrations",
                  "Cancel anytime — no lock-in",
                ].map((f) => (
                  <Check key={f}>{f}</Check>
                ))}
              </ul>
              <a
                href="/api/stripe/checkout"
                className="block w-full rounded-xl bg-[#00d4aa] py-3 text-center font-mono text-sm font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0]"
              >
                Upgrade to Pro
              </a>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#363650] bg-[#1c1c2a]/40 p-5">
            <p className="text-sm text-[#bcbcd8] text-center leading-relaxed">
              <strong className="text-[#f8f8fc]">$29/month context:</strong> If Fold saves you just
              1 hour per week of manual reporting, that&apos;s 4 hours/month. At $50/hr consulting
              rate, that&apos;s $200 in saved time — for $29. Most founders report saving 3-4
              hours/week.
            </p>
          </div>
        </section>

        <Divider />

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq">
          <div className="text-center mb-14">
            <SectionLabel>FAQ</SectionLabel>
            <SectionHeading>Every question answered</SectionHeading>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "How long does it take to set up?",
                a: "Most founders are fully connected in under 10 minutes. Each integration is one click — you're redirected to the platform's own login/authorize page, you approve, and you're done. No code, no CSV exports, no webhooks.",
              },
              {
                q: "Does Fold work if I only use one or two tools?",
                a: "Yes. You can connect just Stripe and get your full revenue dashboard. Add GA4 later when you're ready. Tiles only appear for integrations you've actually connected — there's no empty noise.",
              },
              {
                q: "How is the data refreshed?",
                a: "Data syncs automatically every 24 hours for all connected integrations. You can also manually trigger a refresh from the dashboard at any time.",
              },
              {
                q: "Does Fold store my actual business data?",
                a: "Fold stores the aggregated metrics we pull from your integrations (e.g. your MRR this month = $4,200) — not the raw underlying records (e.g. individual customer names, email addresses, transaction IDs). We sync summary-level data to power your dashboard, not your entire database.",
              },
              {
                q: "Can I cancel without losing my data?",
                a: "Yes. If you cancel your Pro subscription, your account downgrades to free. Your data stays accessible (but won't auto-refresh) until you choose to delete your account. Deleting your account wipes all data within 24 hours.",
              },
              {
                q: "Is the AI included in the free trial?",
                a: "Yes. The full AI module — including daily insights, ask-anything chat, and web page analysis — is available during the 7-day trial at no charge.",
              },
              {
                q: "Do you sell or share my business data?",
                a: "Never. Your data is yours. We don't sell it, share it, or use it to train AI models. OpenAI queries are sent via our Enterprise API, which includes a data processing agreement that prohibits using your data for training.",
              },
              {
                q: "What happens if an integration breaks?",
                a: "If a connection fails (e.g. an expired OAuth token), we'll flag it in your dashboard with a clear reconnect prompt. We also email you if a sync fails. You reconnect in one click.",
              },
              {
                q: "Is there a team or multi-user plan?",
                a: "Not yet. Fold currently supports one user per account. A team plan (shared dashboards, multiple logins) is on the roadmap and will ship based on demand — email us if this is blocking you.",
              },
              {
                q: "Can I get a refund?",
                a: "If you pay and decide Fold isn't right for you within the first 7 days, email us at info@usefold.io and we'll refund you in full. No questions, no hoops.",
              },
            ].map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6"
              >
                <h3 className="font-mono text-sm font-bold text-[#f8f8fc] mb-2">{item.q}</h3>
                <p className="text-sm text-[#bcbcd8] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
        <section>
          <div className="relative overflow-hidden rounded-3xl border border-[#00d4aa]/20 bg-[#00d4aa]/4 p-12 text-center">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-72 w-72 rounded-full bg-[#00d4aa]/8 blur-3xl" />
            </div>
            <div className="relative">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa] mb-4">
                Ready to try it?
              </p>
              <h2 className="font-mono text-3xl font-bold text-[#f8f8fc] mb-4 sm:text-4xl">
                Start your free trial today
              </h2>
              <p className="text-[#bcbcd8] mb-8 max-w-lg mx-auto">
                7 days free. Full access. No credit card required. Connect your first integration in
                under 2 minutes and see your data in a new light.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0] hover:shadow-[0_0_30px_rgba(0,212,170,0.3)]"
                >
                  Get started — it&apos;s free
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
                <a
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#f8f8fc]/20 bg-[#f8f8fc]/5 px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-wider text-[#f8f8fc] transition-all hover:border-[#f8f8fc]/40"
                >
                  See live demo first
                </a>
              </div>
              <p className="mt-6 font-mono text-[10px] text-[#8585aa]">
                Questions? Email{" "}
                <a
                  href="mailto:info@usefold.io"
                  className="text-[#00d4aa] hover:underline"
                >
                  info@usefold.io
                </a>{" "}
                — George replies personally.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#363650] mt-10 px-6 py-10">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/fold-primary-dark.svg" alt="Fold" className="h-7 w-auto" />
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { label: "Home", href: "/" },
              { label: "Demo", href: "/demo" },
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Contact", href: "mailto:info@usefold.io" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] hover:text-[#f8f8fc] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
          <p className="font-mono text-[10px] text-[#8585aa]">© 2025 Fold Analytics</p>
        </div>
      </footer>
    </div>
  );
}
