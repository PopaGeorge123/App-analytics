import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { posts, getPost, categoryLabel, categoryColor } from "../_data/posts";
import {
  H2, H3, P, UL, LI, OL, OLI, Callout, CompareTable, PullQuote, StatRow, MidCTA,
  ArticleCTA,
  DashboardOverviewMockup, DashboardCustomersMockup, DashboardAdsMockup,
  DashboardMRRMockup, IntegrationsMockup,
} from "../_components/prose";

/* ── Static params ───────────────────────────────────────────────── */
export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

/* ── Per-page metadata ───────────────────────────────────────────── */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Fold Analytics Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://usefold.io/blog/${post.slug}`,
      siteName: "Fold Analytics",
      type: "article",
      publishedTime: post.publishedAt,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}



/* ── Article bodies ──────────────────────────────────────────────── */
function PostBody({ slug }: { slug: string }) {
  switch (slug) {
    /* ────────────────────────────────────────────────────────────────
       1. Fold vs Databox
    ──────────────────────────────────────────────────────────────── */
    case "fold-analytics-vs-databox":
      return (
        <>
          <P>Databox is a well-built BI tool with a polished drag-and-drop interface, hundreds of integrations, and a solid free tier. It's popular with marketing agencies managing multiple client dashboards. But if you're a bootstrapped founder, it might be solving the wrong problem for you.</P>
          <P>Fold was built with a specific person in mind: a solo founder or small team who is too busy to build dashboards and just wants to know <em>what's happening in my business and what I should do about it</em>.</P>

          <DashboardOverviewMockup />

          <H2>The core difference in philosophy</H2>
          <P>Databox is a <strong>dashboard builder</strong>. You choose your data sources, pick metrics, drag widgets onto a canvas, and create reports. It's flexible and powerful — but it puts the work on you.</P>
          <P>Fold is an <strong>intelligence layer</strong>. You connect your platforms, and Fold does the analysis for you: detecting anomalies, generating AI-written digests, surfacing playbooks based on what's actually happening.</P>

          <Callout>If you love building dashboards, Databox is excellent. If you'd rather <em>get answers</em> than build dashboards, Fold is built for you.</Callout>

          <H2>Feature comparison</H2>
          <CompareTable competitor="Databox" rows={[
            { feature: "Dashboard builder", fold: "Pre-built, auto-populated", other: "Fully custom drag-and-drop", winner: "other" },
            { feature: "Stripe integration", fold: "Revenue, MRR, churn, ARPU", other: "Basic metrics", winner: "fold" },
            { feature: "AI-generated insights", fold: "✅ Daily AI digest + anomaly alerts", other: "❌ No AI analysis", winner: "fold" },
            { feature: "Ad spend tracking", fold: "Meta + Google + TikTok + LinkedIn", other: "Most major ad platforms", winner: "tie" },
            { feature: "Churn analysis", fold: "✅ At-risk customers, health score", other: "❌ Not available", winner: "fold" },
            { feature: "Setup time", fold: "< 5 minutes, no code", other: "30–60 minutes to configure", winner: "fold" },
            { feature: "Free tier", fold: "7-day free trial", other: "3 data sources free", winner: "tie" },
            { feature: "Target user", fold: "Solo founders, small SaaS", other: "Marketing agencies, enterprises", winner: "fold" },
          ]} />

          <H2>Where Databox wins</H2>
          <UL>
            <LI><strong>Deep custom dashboards:</strong> If you need a very specific layout with dozens of custom KPIs, Databox gives you full control.</LI>
            <LI><strong>Agency use cases:</strong> Managing dashboards for multiple clients is where Databox shines.</LI>
            <LI><strong>Free tier depth:</strong> Databox's free plan supports 3 data sources indefinitely.</LI>
            <LI><strong>Data warehouse connections:</strong> Databox connects to BigQuery, Snowflake, and other warehouses.</LI>
          </UL>

          <H2>Where Fold wins</H2>
          <UL>
            <LI><strong>Time to insight:</strong> Connect Stripe and get your full MRR, churn rate, ARPU, and at-risk customers in under 5 minutes with zero configuration.</LI>
            <LI><strong>AI-powered diagnosis:</strong> Fold's AI reads your data and writes a plain-English summary of what happened and why — daily.</LI>
            <LI><strong>Multi-stream revenue:</strong> Selling via Stripe AND Gumroad AND Shopify? Fold aggregates all revenue into one view. Databox would require you to build that.</LI>
            <LI><strong>Actionable playbooks:</strong> Fold surfaces specific, context-aware next steps. Databox just shows you data.</LI>
          </UL>

          <H2>Pricing reality check</H2>
          <P>Databox's paid plans start at $47/month for more data sources and features. Their most popular plan is around $135/month. Fold offers a 7-day free trial and is priced for solo founders — not enterprise teams.</P>

          <H2>The verdict</H2>
          <P>If you're a solo founder who wants to understand your business without becoming a BI analyst, Fold is the clear choice. If you're managing client reporting or need complete dashboard customization, Databox is worth the investment.</P>
          <P>Most founders don't need another dashboard to build. They need a tool that tells them what their dashboards <em>mean</em>.</P>

          <ArticleCTA />

          <H2>Related reading</H2>
          <UL>
            <LI><Link href="/blog/founder-metrics-that-matter" className="text-[#00d4aa] hover:underline">The 12 Metrics Every Solo Founder Must Track</Link></LI>
            <LI><Link href="/blog/fold-analytics-vs-chartmogul" className="text-[#00d4aa] hover:underline">Fold Analytics vs ChartMogul</Link></LI>
          </UL>
        </>
      );

    /* ────────────────────────────────────────────────────────────────
       2. Fold vs ChartMogul
    ──────────────────────────────────────────────────────────────── */
    case "fold-analytics-vs-chartmogul":
      return (
        <>
          <P>ChartMogul is one of the best subscription analytics tools on the market. If you're running a pure SaaS on Stripe, it will give you deeply accurate MRR, churn cohorts, and customer lifetime value breakdowns. There's a reason it's loved by SaaS founders everywhere.</P>
          <P>But most modern founders don't run a single-stream business. They have subscriptions <em>and</em> one-time products <em>and</em> affiliate revenue <em>and</em> ad spend. ChartMogul sees only the subscription slice. Fold sees everything.</P>

          <DashboardMRRMockup />

          <H2>What ChartMogul does extremely well</H2>
          <UL>
            <LI><strong>MRR accuracy:</strong> ChartMogul's MRR calculation is the industry benchmark — it handles upgrades, downgrades, pauses, and reactivations correctly.</LI>
            <LI><strong>Cohort analysis:</strong> Best-in-class retention cohorts. If you want to know exactly which acquisition month has the worst 3-month retention, ChartMogul answers it.</LI>
            <LI><strong>Churn reason tracking:</strong> Lets you tag why customers churned and analyze patterns.</LI>
            <LI><strong>Customer segmentation:</strong> Powerful filters for slicing customers by plan, country, MRR range, and more.</LI>
          </UL>

          <H2>Where ChartMogul falls short</H2>
          <UL>
            <LI>No native ad spend tracking — you can't see whether your Meta campaigns are driving subscriptions</LI>
            <LI>Limited non-subscription revenue (PayPal, Gumroad, Shopify one-time purchases) </LI>
            <LI>No AI-generated analysis — it shows you data, you have to interpret it</LI>
            <LI>Starts at $0 up to 250 customers, then $179/month — expensive for early stage</LI>
            <LI>No website analytics — can't correlate traffic changes with revenue</LI>
          </UL>

          <H2>Feature comparison</H2>
          <CompareTable competitor="ChartMogul" rows={[
            { feature: "MRR accuracy", fold: "✅ Correct via Stripe sync", other: "✅ Industry-leading precision", winner: "other" },
            { feature: "Churn cohorts", fold: "✅ Visual cohorts + at-risk scoring", other: "✅ Best-in-class", winner: "other" },
            { feature: "Non-subscription revenue", fold: "✅ Gumroad, Shopify, PayPal, etc.", other: "⚠️ Limited", winner: "fold" },
            { feature: "Ad spend & ROAS", fold: "✅ Meta, Google, TikTok, LinkedIn", other: "❌ Not available", winner: "fold" },
            { feature: "AI insights & digest", fold: "✅ Daily AI summary + alerts", other: "❌ No AI layer", winner: "fold" },
            { feature: "Website analytics", fold: "✅ GA4, Plausible, PostHog", other: "❌ Not available", winner: "fold" },
            { feature: "Setup time", fold: "5 min, no config", other: "15–30 min, needs mapping", winner: "fold" },
            { feature: "Pricing (growth stage)", fold: "Founder-friendly pricing", other: "$179/month from 251 customers", winner: "fold" },
          ]} />

          <Callout color="#6366f1">ChartMogul is the right choice if subscriptions are 100% of your revenue and you need the deepest possible cohort analysis. Fold is the right choice if you want to see your entire business — revenue, ads, analytics — in one place with AI that explains what's happening.</Callout>

          <H2>Can you use both?</H2>
          <P>Yes. Some founders use ChartMogul for deep subscription analysis and Fold for the broader business overview. But most founders at the indie/bootstrapped stage are better served by a single tool that gives 90% of ChartMogul's depth plus everything else they need.</P>

          <H2>The verdict</H2>
          <P>If you're a subscription-only SaaS doing $10k+ MRR and you want the most accurate churn analysis possible, ChartMogul is worth the price. If you're at an earlier stage, sell across multiple channels, or want your analytics to actually <em>tell you what to do</em>, Fold covers more ground at a lower cost.</P>

          <ArticleCTA />
        </>
      );

    /* ────────────────────────────────────────────────────────────────
       3. Fold vs Baremetrics
    ──────────────────────────────────────────────────────────────── */
    case "fold-analytics-vs-baremetrics":
      return (
        <>
          <P>Baremetrics built its reputation as the real-time Stripe pulse for SaaS founders. The "Live" dashboard showing live MRR, ARR, and new subscribers as they happen became iconic. Josh Pigford, the founder, even made Baremetrics' own metrics public — a legendary product marketing move.</P>
          <P>Baremetrics and Fold both help founders understand their Stripe revenue. But they diverge significantly in scope, depth, and philosophy.</P>

          <H2>The real-time edge</H2>
          <P>Baremetrics' biggest advantage is real-time data. The moment a customer upgrades or churns, Baremetrics knows. If you're obsessed with watching your MRR tick up throughout the day, Baremetrics delivers that dopamine hit better than anyone.</P>
          <P>Fold syncs daily, which is more than enough for strategic decision-making. If you need to know your MRR changed in the last 11 minutes, Baremetrics has the edge. If you need to know <em>why</em> your MRR changed last month and what to do about it, Fold has the edge.</P>

          <H2>Feature comparison</H2>
          <CompareTable competitor="Baremetrics" rows={[
            { feature: "Real-time Stripe data", fold: "Daily sync", other: "✅ Real-time", winner: "other" },
            { feature: "Revenue forecasting", fold: "✅ 30-day trend forecasting", other: "✅ MRR forecasting", winner: "tie" },
            { feature: "Ad spend tracking", fold: "✅ Meta, Google, TikTok, LinkedIn", other: "❌ Not available", winner: "fold" },
            { feature: "Multi-source revenue", fold: "✅ Stripe + Gumroad + Shopify + more", other: "✅ Stripe + Paddle", winner: "tie" },
            { feature: "AI digest & alerts", fold: "✅ Daily AI summary", other: "❌ No AI layer", winner: "fold" },
            { feature: "Cancellation insights", fold: "✅ At-risk scoring", other: "✅ Cancellation flows", winner: "other" },
            { feature: "Website analytics", fold: "✅ Integrated", other: "❌ Not available", winner: "fold" },
            { feature: "Pricing", fold: "Founder-friendly", other: "From $129/month", winner: "fold" },
          ]} />

          <H2>Baremetrics cancellation flows</H2>
          <P>One genuinely unique feature in Baremetrics is <strong>Cancellation Insights</strong> — when a customer tries to cancel, Baremetrics can intercept with a custom flow, capture their reason, and offer a discount. This is a powerful churn-reduction tool that Fold doesn't replicate.</P>
          <P>If your churn is high and you want to automate win-back flows, Baremetrics' cancellation tooling is worth paying for specifically.</P>

          <H2>The verdict</H2>
          <P>Baremetrics at $129/month is expensive for early-stage founders, and it only covers Stripe subscriptions. Fold covers your entire business — every revenue stream, all your ad platforms, website analytics — with an AI layer that actually interprets the data.</P>
          <P>Unless real-time MRR tracking or cancellation flows are must-haves, Fold provides significantly more value for early-stage founders.</P>

          <ArticleCTA />
        </>
      );

    /* ────────────────────────────────────────────────────────────────
       4. Fold vs Google Analytics
    ──────────────────────────────────────────────────────────────── */
    case "fold-analytics-vs-google-analytics":
      return (
        <>
          <P>Google Analytics 4 is the world's most-used analytics platform — and for many founders, the default choice. It's free, widely documented, and deeply integrated with Google Ads. But there's a fundamental mismatch between what GA4 measures and what a founder actually needs to run their business.</P>
          <P>GA4 measures <strong>website traffic behaviour</strong>. Fold measures <strong>business performance</strong>. These are different things.</P>

          <H2>What GA4 tells you</H2>
          <UL>
            <LI>How many people visited your site</LI>
            <LI>Which pages they viewed and for how long</LI>
            <LI>Where your traffic came from (organic, paid, direct, social)</LI>
            <LI>Which events users triggered (button clicks, form fills, video plays)</LI>
            <LI>Conversion rates on goals you've manually configured</LI>
          </UL>

          <H2>What GA4 doesn't tell you</H2>
          <UL>
            <LI>Your actual revenue (unless you build Ecommerce tracking, which is complex)</LI>
            <LI>Whether your paying customers are about to churn</LI>
            <LI>Your MRR trend or churn rate</LI>
            <LI>Whether your ad spend is profitable</LI>
            <LI>What's actually causing a revenue dip</LI>
          </UL>

          <Callout color="#f59e0b">GA4 tells you what people do on your website. It doesn't tell you whether your business is healthy. For that, you need a revenue analytics tool.</Callout>

          <H2>The GA4 complexity problem</H2>
          <P>GA4 is notoriously complex to configure correctly. Event-based tracking requires either custom code or Google Tag Manager. Conversion goals need to be manually set up. Custom dimensions and funnels require significant time investment. Most founders set up GA4, look at pageview graphs, and never configure it deeply enough to get real value.</P>
          <P>Fold requires zero configuration. You connect your platforms and immediately see revenue, ad performance, and customer health — no events to define, no funnels to build.</P>

          <H2>Do you need both?</H2>
          <P>Yes, ideally. GA4 and Fold serve different purposes:</P>
          <UL>
            <LI><strong>GA4:</strong> Understanding your website funnel — which landing pages convert, where visitors drop off, which traffic sources send quality visitors</LI>
            <LI><strong>Fold:</strong> Understanding your business — revenue, customers, churn, ad ROI, and what to do next</LI>
          </UL>
          <P>In fact, Fold <em>integrates with</em> GA4 — pulling your sessions and conversion data into the same dashboard as your Stripe revenue, so you can see the complete picture without switching tabs.</P>

          <H2>For founders making product and growth decisions</H2>
          <P>If you're choosing between spending an hour setting up GA4 funnels or an hour understanding your revenue trends, the revenue data is almost always more valuable. You can debug a leaky funnel after you've confirmed your retention economics work.</P>

          <ArticleCTA />
        </>
      );

    /* ────────────────────────────────────────────────────────────────
       5. Best analytics tools for indie hackers
    ──────────────────────────────────────────────────────────────── */
    case "best-analytics-tools-indie-hackers":
      return (
        <>
          <P>The analytics landscape is overwhelming. There are dozens of tools, overlapping feature sets, and no single right answer. This guide cuts through the noise with honest trade-offs for each stage of your indie hacker journey.</P>

          <IntegrationsMockup />

          <H2>Stage 1: Pre-revenue (0–$0 MRR)</H2>
          <P>Before you have paying customers, you need to validate that people want your product. Your analytics needs are minimal — you need to know if people are showing up, signing up, and engaging.</P>
          <H3>Best tools at this stage</H3>
          <UL>
            <LI><strong>Plausible Analytics ($9/month):</strong> Simple, privacy-friendly pageview analytics. Zero configuration. If you want to know whether your launch post drove traffic, Plausible answers it in 30 seconds.</LI>
            <LI><strong>PostHog (free tier):</strong> Product analytics, session recording, feature flags. Excellent for understanding how users interact with your app.</LI>
            <LI><strong>Google Analytics 4 (free):</strong> Required for Google Ads, and the free tier is generous. Worth setting up even if you don't use it much yet.</LI>
          </UL>

          <H2>Stage 2: Early revenue ($1–$5k MRR)</H2>
          <P>Once money is flowing, you need to understand where it's coming from and whether customers are sticking around. This is where most indie hackers underinvest in analytics — and pay for it later.</P>
          <H3>Best tools at this stage</H3>
          <UL>
            <LI><strong>Fold Analytics (from $0 trial):</strong> Connect Stripe and immediately see MRR, churn rate, at-risk customers, and an AI daily digest. Designed specifically for founders at this stage. The fact that it also connects to your ad platforms and website analytics makes it a one-stop shop.</LI>
            <LI><strong>Stripe Dashboard (free, built-in):</strong> Stripe's native dashboard is underrated. It gives you payout history, dispute rates, and basic revenue graphs without any setup.</LI>
          </UL>

          <H2>Stage 3: Growing ($5k–$30k MRR)</H2>
          <P>At this stage you're probably running ads, have multiple pricing tiers, and want to understand which customer segments are most valuable.</P>
          <H3>Best tools at this stage</H3>
          <UL>
            <LI><strong>Fold Analytics:</strong> The ad spend integration becomes essential here. Seeing your Meta ROAS next to your Stripe MRR in one dashboard saves hours per week.</LI>
            <LI><strong>ChartMogul ($179/month above 250 customers):</strong> If subscriptions are your core model and you need best-in-class cohort retention analysis, ChartMogul is worth it.</LI>
            <LI><strong>Mixpanel (free up to 20M events):</strong> For detailed product funnel analysis and understanding which features drive retention.</LI>
          </UL>

          <H2>Stage 4: Scaling ($30k+ MRR)</H2>
          <P>At scale you might have a small team and benefit from more sophisticated tooling.</P>
          <H3>Best tools at this stage</H3>
          <UL>
            <LI><strong>Metabase or Redash:</strong> Self-hosted BI tool for custom SQL queries on your database.</LI>
            <LI><strong>Databox or Looker Studio:</strong> Custom dashboards for team reporting.</LI>
            <LI><strong>Amplitude:</strong> Enterprise-grade product analytics with powerful segmentation.</LI>
          </UL>

          <H2>The tools to skip</H2>
          <UL>
            <LI><strong>Tableau:</strong> Overkill for indie hackers. Expensive and requires a data engineer to maintain.</LI>
            <LI><strong>Adobe Analytics:</strong> Enterprise-only. Not worth considering below $1M ARR.</LI>
            <LI><strong>Hotjar (paid):</strong> Session recordings are useful, but the free tier covers most indie hacker needs. Don't pay for this before $10k MRR.</LI>
          </UL>

          <Callout>The most important rule: the best analytics tool is the one you actually look at. Start simple, add depth as your questions become more specific.</Callout>

          <ArticleCTA />
        </>
      );

    /* ────────────────────────────────────────────────────────────────
       6. How to reduce SaaS churn
    ──────────────────────────────────────────────────────────────── */
    case "how-to-reduce-churn-saas":
      return (
        <>
          <P>A 5% monthly churn rate sounds manageable. Run the math and it means you're replacing your entire customer base every 20 months just to stay flat. At 8% monthly churn, you're replacing customers faster than you're acquiring them in most growth scenarios. Churn is the silent killer of SaaS businesses, and most founders catch it too late.</P>
          <P>This guide covers how to detect churn early, diagnose its root causes, and build the retention systems that actually move the needle.</P>

          <StatRow stats={[
            { value: "5%", label: "Monthly churn", color: "#ef4444" },
            { value: "20mo", label: "Replace full base", color: "#f59e0b" },
            { value: "30%", label: "From failed payments", color: "#8585aa" },
            { value: "<2%", label: "Top quartile target", color: "#10b981" },
          ]} />

          <DashboardCustomersMockup />

          <H2>The three types of churn</H2>
          <H3>1. Voluntary churn</H3>
          <P>A customer actively cancels. This is what most founders focus on — and it's the symptom, not the disease. By the time they cancel, you've already lost.</P>
          <H3>2. Involuntary churn</H3>
          <P>Failed payments, expired cards, bank declines. This is often 20–30% of total churn and almost entirely preventable. If you're not running dunning emails, you're leaving money on the table.</P>
          <H3>3. Passive churn</H3>
          <P>Customers who have stopped using the product but haven't cancelled yet. They're about to churn — they just haven't gotten around to it. These are your most recoverable customers.</P>

          <Callout color="#ef4444">The average SaaS business loses 30% of its churn to failed payments. Before building elaborate retention playbooks, fix your dunning flow first.</Callout>

          <H2>How to detect churn before it happens</H2>
          <H3>Track last activity, not last login</H3>
          <P>Last login is a weak signal. A customer can log in out of habit without getting value. Track the actions that correlate with retention in your specific app — completed workflows, shared outputs, integrations connected.</P>
          <H3>Build a health score</H3>
          <P>A customer health score combines recency, frequency, and value signals into a single number. In Fold, we call this the "health score" — customers with a low score (under 40) are flagged as at-risk and surfaced automatically. You don't need to build a data model — you need to be notified when a valuable customer goes quiet.</P>
          <H3>Watch for warning signals</H3>
          <UL>
            <LI>No activity in the last 14 days</LI>
            <LI>Decrease in feature usage compared to previous month</LI>
            <LI>Support tickets expressing frustration</LI>
            <LI>Downgrade from a higher-tier plan</LI>
            <LI>Reduction in number of team seats</LI>
          </UL>

          <H2>The retention playbook</H2>
          <H3>Step 1: Fix involuntary churn immediately</H3>
          <OL>
            <LI>Set up card expiry reminders (7, 3, 1 day before expiry)</LI>
            <LI>Add a dunning sequence for failed payments (retry day 1, 3, 7 with escalating email urgency)</LI>
            <LI>Use Stripe's Smart Retries or a tool like Stunning.co</LI>
          </OL>

          <H3>Step 2: Identify at-risk customers before they cancel</H3>
          <OL>
            <LI>Pull your customer list sorted by last activity date</LI>
            <LI>Flag customers who haven't been active in 21+ days</LI>
            <LI>Prioritize those with the highest LTV — they're the most worth saving</LI>
          </OL>

          <H3>Step 3: Run personalised re-engagement</H3>
          <P>Don't send a generic "We miss you!" email. Reference what they were doing when they last used the product, and speak to the specific value they should be getting.</P>

          <H3>Step 4: Learn from churned customers</H3>
          <P>Send a short 3-question survey to every churned customer. Most won't respond, but the 20% who do will tell you exactly what's broken. This is your cheapest product research.</P>

          <H2>Churn benchmarks by SaaS type</H2>
          <UL>
            <LI><strong>Top quartile B2C SaaS:</strong> &lt;2% monthly churn</LI>
            <LI><strong>Median B2C SaaS:</strong> 3–5% monthly churn</LI>
            <LI><strong>Top quartile B2B SaaS:</strong> &lt;1% monthly churn</LI>
            <LI><strong>Median B2B SaaS:</strong> 2–3% monthly churn</LI>
          </UL>
          <P>If your churn is above median for your category, retention work will compound better than acquisition work — every new customer you win stays longer.</P>

          <ArticleCTA />
        </>
      );

    /* ────────────────────────────────────────────────────────────────
       7. Founder metrics that matter
    ──────────────────────────────────────────────────────────────── */
    case "founder-metrics-that-matter":
      return (
        <>
          <P>Every article about metrics tells you to track everything. The result: founders drowning in dashboards, checking 15 numbers each morning and acting on none of them. This guide does the opposite. Here are the 12 metrics that actually predict whether your business will succeed — and the 5 you can safely ignore.</P>

          <H2>The 12 metrics that matter</H2>

          <H3>1. Monthly Recurring Revenue (MRR)</H3>
          <P>The single most important number for a subscription business. Watch it weekly, understand the components: new MRR, expansion MRR, churned MRR, reactivation MRR. A flat MRR with high new MRR and high churn MRR is a warning sign even though the headline looks fine.</P>

          <H3>2. Net Revenue Retention (NRR)</H3>
          <P>NRR above 100% means your existing customers are growing their spend faster than they're churning. It's the single best leading indicator of long-term business health. World-class SaaS companies have NRR of 120%+.</P>

          <H3>3. Monthly Churn Rate</H3>
          <P>As discussed — the percentage of MRR lost each month from cancellations. Target: under 2% for B2C, under 1% for B2B. Review it monthly, not quarterly.</P>

          <H3>4. Customer Acquisition Cost (CAC)</H3>
          <P>Total marketing + sales spend divided by new customers acquired. Most founders calculate this wrong because they forget to include their own time. If you're spending 20 hours a week on content marketing, that time has a cost.</P>

          <H3>5. LTV:CAC Ratio</H3>
          <P>If it costs you $200 to acquire a customer who pays you $600 over their lifetime, your LTV:CAC is 3:1 — generally the minimum threshold for a healthy SaaS business. Under 3:1 and you're burning money on growth.</P>

          <H3>6. Payback Period</H3>
          <P>How many months does it take to recover your CAC through gross margin? Under 12 months is healthy for most SaaS businesses. Over 18 months means you need more capital to scale.</P>

          <H3>7. Daily Active Users / Monthly Active Users (DAU/MAU)</H3>
          <P>For product businesses, engagement ratio is a proxy for value delivery. If your DAU/MAU is 20% (1 in 5 monthly users are daily users), it's a strong signal of habit formation.</P>

          <H3>8. Activation Rate</H3>
          <P>Of users who sign up, what percentage reach your "aha moment"? This varies by product, but improving activation rate often has more impact than improving acquisition.</P>

          <H3>9. Revenue per Employee (if you have a team)</H3>
          <P>A useful north-star for efficiency. Top SaaS companies generate $200k–$400k+ revenue per employee. For solo founders this is automatically excellent.</P>

          <H3>10. Gross Margin</H3>
          <P>Software businesses should target 70–85% gross margin. If your gross margin is under 60%, your unit economics are concerning and you have limited room for reinvestment.</P>

          <H3>11. Ad ROAS (if you run paid ads)</H3>
          <P>Return on Ad Spend. For most bootstrapped founders, you want at least 3x ROAS to be profitable after taking into account all other costs. Below 2x and you're likely losing money on paid acquisition.</P>

          <H3>12. Cash Runway</H3>
          <P>If you're pre-profitable: how many months of operating expenses do you have in the bank? Keep at least 6 months. 12 months gives you room to experiment and pivot.</P>

          <Callout>Pick 3 of these 12 as your "weekly review" metrics. The rest you check monthly. Checking all 12 every day creates analysis paralysis, not action.</Callout>

          <H2>The 5 metrics to stop tracking</H2>
          <H3>1. Total registered users</H3>
          <P>Meaningless without activation and retention context. A million registered users with 5% activation is worse than 10,000 users with 60% activation.</P>

          <H3>2. Pageviews</H3>
          <P>Unless you're a media business. Pageviews correlate weakly with revenue for SaaS businesses.</P>

          <H3>3. Twitter/social followers</H3>
          <P>Distribution is valuable. Followers are a proxy. Track email list growth instead — that's the distribution channel you own.</P>

          <H3>4. Product Hunt / Hacker News upvotes</H3>
          <P>Great for a 24-hour dopamine hit. Essentially uncorrelated with long-term business success.</P>

          <H3>5. Revenue run rate when you have under $5k MRR</H3>
          <P>Annualising $3k MRR as "$36k ARR" is technically accurate and psychologically misleading. At early stage, work with the actual monthly number — it keeps you grounded.</P>

          <ArticleCTA />
        </>
      );

    /* ────────────────────────────────────────────────────────────────
       8. How to connect Stripe to analytics
    ──────────────────────────────────────────────────────────────── */
    case "how-to-connect-stripe-to-analytics":
      return (
        <>
          <P>Stripe is where the money lives, but Stripe's native dashboard is limited to payment data. It doesn't tell you about churn trends, customer health, ad ROI, or what's driving revenue changes. To answer those questions, you need your Stripe data flowing into an analytics platform.</P>
          <P>This guide covers every option — from the simplest to the most customisable.</P>

          <H2>Option 1: Use a purpose-built tool (easiest)</H2>
          <P>The fastest path is connecting Stripe to an analytics platform that has a native Stripe integration. Tools like Fold Analytics, ChartMogul, or Baremetrics let you OAuth into Stripe in under 2 minutes and immediately start seeing MRR, churn, ARPU, and customer analytics.</P>
          <H3>How to connect Stripe to Fold Analytics</H3>
          <OL>
            <LI>Create a Fold account at usefold.io</LI>
            <LI>Go to Settings → Integrations → Stripe</LI>
            <LI>Click "Connect" — you'll be redirected to Stripe's OAuth flow</LI>
            <LI>Authorise read-only access (Fold never writes to your Stripe account)</LI>
            <LI>Fold starts syncing your historical data immediately</LI>
          </OL>
          <P>Within 5 minutes you'll see MRR, churn rate, at-risk customers, ARPU, and an AI-generated summary of your subscription health.</P>

          <H2>Option 2: Stripe Sigma (built into Stripe)</H2>
          <P>Stripe Sigma lets you run SQL queries directly against your Stripe data from inside the Stripe dashboard. It's powerful for ad-hoc analysis — "show me all customers who downgraded in October" — but requires SQL knowledge and doesn't give you dashboards or alerts.</P>
          <P>Cost: $0.02 per query execution. Free for simple queries.</P>

          <H2>Option 3: Stripe webhooks → your own database</H2>
          <P>If you have engineering resources, Stripe's webhook system lets you receive real-time events (payment succeeded, subscription cancelled, invoice failed) and store them in your own database for custom analysis.</P>
          <H3>Key webhooks to listen for:</H3>
          <UL>
            <LI><code className="rounded bg-[#1c1c2a] px-1 text-[#00d4aa]">customer.subscription.created</code> — new subscriber</LI>
            <LI><code className="rounded bg-[#1c1c2a] px-1 text-[#00d4aa]">customer.subscription.deleted</code> — churn event</LI>
            <LI><code className="rounded bg-[#1c1c2a] px-1 text-[#00d4aa]">invoice.payment_failed</code> — involuntary churn risk</LI>
            <LI><code className="rounded bg-[#1c1c2a] px-1 text-[#00d4aa]">customer.subscription.updated</code> — upgrade or downgrade</LI>
          </UL>
          <P>This approach gives maximum flexibility but requires ongoing maintenance. Not recommended for founders without a dedicated engineering team.</P>

          <H2>Option 4: Zapier / Make automations</H2>
          <P>Tools like Zapier can pipe Stripe events into Google Sheets, Airtable, Notion, or Slack. This is useful for simple notifications ("notify Slack when a new subscriber signs up") but doesn't give you analytics — you'd still need to build charts manually in Sheets.</P>

          <H2>Option 5: Fivetran / Airbyte → data warehouse</H2>
          <P>Enterprise-grade: Fivetran or Airbyte sync all Stripe data to a data warehouse (BigQuery, Snowflake, Redshift) where your data team can run any query. This is the right approach at $1M+ ARR with a data team. Overkill before that.</P>

          <H2>What to look at once connected</H2>
          <UL>
            <LI><strong>MRR trend:</strong> Is it growing, flat, or declining? What's driving each component?</LI>
            <LI><strong>Monthly churn rate:</strong> Target under 2% for B2C, under 1% for B2B</LI>
            <LI><strong>At-risk customers:</strong> Who hasn't been active recently and is likely to cancel?</LI>
            <LI><strong>ARPU trends:</strong> Is your average revenue per user going up or down over time?</LI>
            <LI><strong>Failed payment rate:</strong> Above 3% suggests a dunning problem</LI>
          </UL>

          <ArticleCTA />
        </>
      );

    /* ────────────────────────────────────────────────────────────────
       9. Ad spend ROAS calculator guide
    ──────────────────────────────────────────────────────────────── */
    case "ad-spend-roi-calculator-guide":
      return (
        <>
          <P>Meta Ads Manager says your ROAS is 4.2x. Google Ads reports 5.8x. TikTok claims 3.1x. You made $12,000 in revenue last month — but these platforms are claiming combined attribution of $34,000. Something doesn't add up.</P>
          <P>This is the attribution problem every performance marketer faces. Platform-reported ROAS is almost always inflated. Here's how to calculate your true blended ROAS and make smarter budget decisions.</P>

          <DashboardAdsMockup />

          <H2>Why platform ROAS is wrong</H2>
          <H3>Attribution windows</H3>
          <P>Meta and Google both claim credit for any conversion that happened within their attribution window — which can be 7, 14, 28, or even 90 days after an ad click or view. One customer might be attributed to Meta (clicked an ad 3 days ago), Google (clicked a search ad yesterday), and TikTok (viewed an ad last week) simultaneously. Three platforms claiming credit for one $100 sale = $300 in claimed revenue.</P>

          <H3>View-through attribution</H3>
          <P>If you have view-through attribution enabled, a customer who saw your ad but never clicked can still be counted as a conversion. On Meta especially, this inflates reported ROAS dramatically because billions of people see ads every day.</P>

          <H3>Cross-device tracking gaps</H3>
          <P>A customer who sees your ad on mobile and converts on desktop later often shows as an unattributed conversion — deflating some platform numbers while inflating others.</P>

          <H2>How to calculate true blended ROAS</H2>
          <P>The most honest metric is <strong>blended ROAS</strong>: your total revenue divided by your total ad spend across all platforms, regardless of attribution.</P>

          <Callout color="#f59e0b">
            <strong>Blended ROAS = Total Revenue / Total Ad Spend</strong>
            <br /><br />
            Example: $12,000 revenue ÷ $4,500 total ad spend = 2.67x blended ROAS
          </Callout>

          <H2>What's a good blended ROAS?</H2>
          <UL>
            <LI><strong>Under 1x:</strong> You're losing money on ads. Stop or restructure immediately.</LI>
            <LI><strong>1x–2x:</strong> Marginal. After COGS and fixed costs, you're likely unprofitable.</LI>
            <LI><strong>2x–3x:</strong> Acceptable. Profitable for high-margin digital products; break-even for physical goods.</LI>
            <LI><strong>3x–5x:</strong> Healthy. Gives you room to scale while staying profitable.</LI>
            <LI><strong>5x+:</strong> Excellent. Consider increasing spend while this efficiency lasts.</LI>
          </UL>

          <H2>Platform-specific ROAS benchmarks</H2>
          <H3>Meta Ads</H3>
          <UL>
            <LI>Average ROAS across industries: 2.5x–4x (7-day click attribution)</LI>
            <LI>Use <strong>7-day click only</strong> attribution for the most honest comparison</LI>
            <LI>Disable view-through conversions for cleaner data</LI>
          </UL>

          <H3>Google Ads</H3>
          <UL>
            <LI>Average ROAS: 3x–5x (last-click attribution)</LI>
            <LI>Search campaigns typically have higher ROAS than display — compare them separately</LI>
            <LI>Use data-driven attribution if you have enough conversion volume</LI>
          </UL>

          <H3>TikTok Ads</H3>
          <UL>
            <LI>Average ROAS: 1.5x–3x (newer platform, less intent-based traffic)</LI>
            <LI>Works best for discovery-stage products and broad audiences</LI>
            <LI>Don't compare TikTok ROAS directly to Google Search ROAS — different funnel stages</LI>
          </UL>

          <H2>The right way to measure ad performance with Fold</H2>
          <P>Fold pulls your actual revenue from Stripe (or any other payment provider) and your actual ad spend from Meta, Google, and TikTok — and calculates your blended ROAS automatically. No manual data pulling, no spreadsheets. You see "you spent $4,500 on ads last week and brought in $12,000 in new revenue" in one number, on one screen.</P>

          <ArticleCTA />
        </>
      );

    /* ────────────────────────────────────────────────────────────────
       10. One dashboard for all revenue streams
    ──────────────────────────────────────────────────────────────── */
    case "one-dashboard-all-revenue-streams":
      return (
        <>
          <P>Here's a scene most founders know well. You open five tabs on Monday morning: Stripe for subscription revenue, Gumroad for your course sales, Shopify for physical product revenue, Meta Ads Manager to check ROAS, and GA4 to see if traffic is up. Then you copy numbers into a spreadsheet, spend 30 minutes calculating totals, and realise you've already spent an hour of your most productive time on financial bookkeeping.</P>
          <P>This is the multi-stream revenue problem. Modern founders don't run a single-channel business — and the tools haven't kept up.</P>

          <H2>Why founders end up with fragmented revenue</H2>
          <P>Product evolution is almost never linear. You start with a SaaS subscription, then launch an info product, then add a one-time setup fee option, then start a newsletter with a paid tier. Each stream makes sense individually — but tracking all of them together becomes a full-time job.</P>
          <P>The platforms themselves are incentivised to keep you inside their dashboards. Stripe doesn't show you your Gumroad revenue. Gumroad doesn't show you your ad spend. Nobody shows you the whole picture by default.</P>

          <H2>The cost of fragmented data</H2>
          <UL>
            <LI><strong>Wrong decisions:</strong> If you only see Stripe revenue declining, you might cut ad spend — not realising Gumroad revenue is up and compensating. Siloed data leads to siloed decisions.</LI>
            <LI><strong>Slow reaction time:</strong> Catching a problem on Monday that started Wednesday the previous week because you only review data weekly means losing 5 days of revenue.</LI>
            <LI><strong>Missed opportunities:</strong> Not noticing that Meta campaigns are driving Shopify sales (not Stripe subscriptions) because you check them in separate tabs.</LI>
            <LI><strong>Time waste:</strong> 30–60 minutes of manual reporting per week compounds to 25–50 hours per year — time better spent building product or talking to customers.</LI>
          </UL>

          <H2>What a unified revenue dashboard looks like</H2>
          <P>A properly unified dashboard answers these questions in under 30 seconds:</P>
          <UL>
            <LI>What's my total revenue this week/month across all platforms?</LI>
            <LI>Which platform is growing and which is declining?</LI>
            <LI>What did I spend on ads, and what return did I get?</LI>
            <LI>How many new customers did I acquire, and what's my blended CAC?</LI>
            <LI>Is my churn rate improving or worsening?</LI>
          </UL>

          <Callout color="#6366f1">The goal isn't more data — it's fewer questions that take more than 30 seconds to answer.</Callout>

          <H2>Platforms Fold connects to</H2>
          <UL>
            <LI><strong>Revenue:</strong> Stripe, Paddle, Lemon Squeezy, Gumroad, PayPal, Shopify, WooCommerce</LI>
            <LI><strong>Ads:</strong> Meta, Google Ads, TikTok Ads, LinkedIn Ads, Snapchat Ads, Twitter/X Ads</LI>
            <LI><strong>Analytics:</strong> Google Analytics 4, Plausible, PostHog, Mixpanel, Amplitude, Fathom</LI>
          </UL>

          <H2>How to build your unified dashboard in 15 minutes</H2>
          <OL>
            <LI>Sign up for Fold (free 7-day trial)</LI>
            <LI>Connect your revenue platforms — each takes under 2 minutes via OAuth</LI>
            <LI>Connect your ad platforms — same process</LI>
            <LI>Connect your analytics platform</LI>
            <LI>Fold syncs your historical data and surfaces an AI summary of your business health</LI>
          </OL>
          <P>After setup, your Monday morning routine becomes: open Fold, read the AI digest, identify one thing to act on. 5 minutes instead of 60.</P>

          <H2>The ROI of a unified view</H2>
          <P>Founders who consolidate their analytics report two main benefits: time savings (averaging 3–4 hours per week) and faster decision cycles. When the data is already there, you make decisions in the moment rather than scheduling "analytics time" once a week.</P>

          <ArticleCTA />
        </>
      );

    default:
      return <P>Article content coming soon.</P>;
  }
}

/* ── Page ────────────────────────────────────────────────────────── */
export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const color = categoryColor[post.category];
  const label = categoryLabel[post.category];
  const related = posts
    .filter((p) => p.slug !== slug && p.category === post.category)
    .slice(0, 3)
    .concat(posts.filter((p) => p.slug !== slug && p.category !== post.category).slice(0, 3 - posts.filter((p) => p.slug !== slug && p.category === post.category).slice(0, 3).length));

  // Hero gradient per category
  const heroGradient: Record<string, string> = {
    comparison: "from-[#6366f1]/20 via-[#6366f1]/5 to-transparent",
    guide:      "from-[#00d4aa]/20 via-[#00d4aa]/5 to-transparent",
    strategy:   "from-[#f59e0b]/20 via-[#f59e0b]/5 to-transparent",
    tools:      "from-[#10b981]/20 via-[#10b981]/5 to-transparent",
  };

  return (
    <main>
      {/* Hero section */}
      <div className={`bg-linear-to-b ${heroGradient[post.category] ?? heroGradient.guide} border-b border-[#363650]`}>
        <div className="mx-auto max-w-3xl px-5 py-14">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 font-mono text-[10px] text-[#58588a]">
            <Link href="/blog" className="hover:text-[#8585aa] transition-colors">← Blog</Link>
            <span>/</span>
            <span
              className="rounded-full px-2 py-0.5"
              style={{ color, background: color + "20", border: `1px solid ${color}40` }}
            >
              {label}
            </span>
          </div>

          {/* Title */}
          <h1 className="mb-5 font-mono text-3xl font-bold leading-tight text-[#f8f8fc] sm:text-4xl">
            {post.title}
          </h1>
          <p className="mb-8 max-w-2xl font-sans text-[16px] leading-relaxed text-[#8585aa]">
            {post.description}
          </p>

          {/* Author + meta */}
          <div className="flex items-center gap-4">
            <img
              src="/founder-george-popa.jpg"
              alt="George Popa"
              className="h-10 w-10 rounded-full border-2 object-cover"
              style={{ borderColor: color + "60" }}
            />
            <div>
              <p className="font-mono text-[12px] font-semibold text-[#f8f8fc]">George Popa</p>
              <div className="flex items-center gap-3 font-mono text-[10px] text-[#58588a]">
                <span>
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </span>
                <span>·</span>
                <span>{post.readMinutes} min read</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Article content */}
      <div className="mx-auto max-w-3xl px-5 py-12">
        <article>
          <PostBody slug={slug} />
        </article>

        {/* Author bio */}
        <div className="mt-14 flex items-start gap-5 rounded-2xl border border-[#363650] bg-[#1c1c2a] p-6">
          <img
            src="/founder-george-popa.jpg"
            alt="George Popa"
            className="h-14 w-14 shrink-0 rounded-full border-2 border-[#363650] object-cover"
          />
          <div>
            <p className="mb-1 font-mono text-[13px] font-bold text-[#f8f8fc]">George Popa</p>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#00d4aa]">Founder, Fold Analytics</p>
            <p className="font-sans text-[13px] leading-6 text-[#8585aa]">
              I built Fold after spending hours every week stitching together Stripe, Google Ads, and GA4 in spreadsheets.
              Now I write about analytics, metrics, and what actually moves the needle for bootstrapped founders.
            </p>
          </div>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="mt-14 border-t border-[#363650] pt-10">
            <h2 className="mb-6 font-mono text-lg font-bold text-[#f8f8fc]">Continue reading</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => {
                const rc = categoryColor[r.category];
                return (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group rounded-xl border border-[#363650] bg-[#1c1c2a] p-5 transition hover:border-[#00d4aa]/30 hover:bg-[#1c1c2a]"
                  >
                    <span
                      className="mb-3 inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest"
                      style={{ color: rc, background: rc + "20", border: `1px solid ${rc}40` }}
                    >
                      {categoryLabel[r.category]}
                    </span>
                    <p className="mb-2 font-mono text-[12px] font-semibold leading-snug text-[#d4d4f0] group-hover:text-[#00d4aa] transition-colors">
                      {r.title}
                    </p>
                    <p className="font-mono text-[10px] text-[#58588a]">{r.readMinutes} min read</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );

}
