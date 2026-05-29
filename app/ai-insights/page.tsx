import { Nav } from "@/app/_components/PageClientIslands";
import Link from "next/link";

export const metadata = {
  title: "AI Insights — Automated Revenue Monitoring | Fold",
  description: "Automated revenue anomaly detection, conversion leak audits, and growth playbooks tailored to your data. Stop checking dashboards manually.",
};

export default function AiInsightsPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f8]">
      <Nav />
      
      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/40 bg-[#00d4aa]/10 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">
              AI-Powered Analytics
            </span>
          </div>
          <h1 className="font-mono text-5xl font-bold text-[#1a1a2e] mb-6">
            Stop checking dashboards.
            <br />
            <span className="text-[#00d4aa]">Let AI check them for you.</span>
          </h1>
          <p className="text-lg text-[#4a4a6a] mb-8 max-w-2xl mx-auto">
            Fold's AI monitors your Stripe, GA4, Meta, and website 24/7 — catches revenue drops within 
            minutes, audits your funnel for conversion leaks, and tells you exactly what to fix.
          </p>
          <Link 
            href="/signup" 
            className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-8 py-4 font-mono text-sm font-bold text-white transition-all hover:bg-[#00bfa0]"
          >
            Start free 7-day trial
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Anomaly Detection */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#d4d4e8]">
              <div className="w-12 h-12 rounded-xl bg-[#f87171]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#f87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-mono text-xl font-bold text-[#1a1a2e] mb-3">
                Revenue Anomaly Detection
              </h3>
              <p className="text-[#4a4a6a] mb-4">
                AI compares today's metrics to your 30-day average and alerts you within minutes when 
                revenue, conversions, or traffic deviate significantly.
              </p>
              <ul className="space-y-2 text-sm text-[#4a4a6a]">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Real-time alerts via email, Slack, or SMS</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Context-aware thresholds (understands seasonality)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Root cause analysis across all platforms</span>
                </li>
              </ul>
            </div>

            {/* Website Audit */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#d4d4e8]">
              <div className="w-12 h-12 rounded-xl bg-[#00d4aa]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-mono text-xl font-bold text-[#1a1a2e] mb-3">
                Website Conversion Audit
              </h3>
              <p className="text-[#4a4a6a] mb-4">
                AI crawls your site, scores it 0-100 on UX/conversion optimization, and generates a 
                prioritized fix-list ranked by revenue impact.
              </p>
              <ul className="space-y-2 text-sm text-[#4a4a6a]">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Identifies unclear CTAs, slow pages, trust issues</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Estimates $$ value of each fix</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Re-scans after changes to track improvement</span>
                </li>
              </ul>
            </div>

            {/* True Attribution */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#d4d4e8]">
              <div className="w-12 h-12 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-mono text-xl font-bold text-[#1a1a2e] mb-3">
                True Ad Attribution
              </h3>
              <p className="text-[#4a4a6a] mb-4">
                Meta and Google inflate their conversion numbers. Fold links every ad dollar to actual 
                Stripe revenue to show your REAL CAC and ROAS.
              </p>
              <ul className="space-y-2 text-sm text-[#4a4a6a]">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Cross-platform ROAS (not single-platform lies)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Paid vs organic revenue split</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Know which campaigns to kill before burning $$</span>
                </li>
              </ul>
            </div>

            {/* Growth Playbooks */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#d4d4e8]">
              <div className="w-12 h-12 rounded-xl bg-[#a78bfa]/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#a78bfa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-mono text-xl font-bold text-[#1a1a2e] mb-3">
                AI Growth Playbooks
              </h3>
              <p className="text-[#4a4a6a] mb-4">
                Set a goal ("Grow MRR", "Reduce Churn", "Scale Ads") and AI generates a step-by-step 
                action plan tailored to YOUR metrics—not generic blog advice.
              </p>
              <ul className="space-y-2 text-sm text-[#4a4a6a]">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Prioritized by effort vs impact</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Context-aware (knows your stage, industry, revenue)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#00d4aa] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Learns from your feedback (what worked/didn't)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison: DIY vs Fold */}
      <section className="py-24 px-6 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">
              DIY Dashboard vs AI Analyst
            </p>
            <h2 className="font-mono text-3xl font-bold text-[#1a1a2e] sm:text-4xl">
              What "I can code this myself" actually costs
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* DIY Dashboard */}
            <div className="rounded-2xl bg-[#f87171]/5 border border-[#f87171]/20 p-8">
              <h3 className="mb-4 font-mono text-lg font-bold text-[#1a1a2e]">
                DIY Dashboard (10 hours)
              </h3>
              <ul className="space-y-3 text-sm text-[#4a4a6a]">
                <li className="flex items-start gap-2">
                  <span className="text-[#f87171] mt-1">▪</span>
                  <span>Shows you data you already have</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f87171] mt-1">▪</span>
                  <span>You still check it manually every day</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f87171] mt-1">▪</span>
                  <span>Spot problems 2-5 days late (costs $$$$)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f87171] mt-1">▪</span>
                  <span>No idea WHAT to do with the data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f87171] mt-1">▪</span>
                  <span>OAuth breaks every 60 days (token refresh hell)</span>
                </li>
              </ul>
            </div>

            {/* Fold AI */}
            <div className="rounded-2xl bg-[#00d4aa]/5 border-2 border-[#00d4aa]/30 p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00d4aa] px-4 py-1 rounded-full font-mono text-[9px] font-bold text-white uppercase tracking-wider">
                What You Actually Get
              </div>
              <h3 className="mb-4 font-mono text-lg font-bold text-[#1a1a2e]">
                Fold AI Analyst ($19/mo)
              </h3>
              <ul className="space-y-3 text-sm text-[#1a1a2e]">
                <li className="flex items-start gap-2">
                  <span className="text-[#00d4aa] mt-1">✓</span>
                  <span><strong>Watches for problems 24/7</strong> — alerts you within minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00d4aa] mt-1">✓</span>
                  <span><strong>Tells you WHY</strong> revenue dropped and how to fix it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00d4aa] mt-1">✓</span>
                  <span><strong>Audits your website</strong> for conversion leaks (worth $2K-10K/mo)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00d4aa] mt-1">✓</span>
                  <span><strong>True ad attribution</strong> — stops you from scaling losing campaigns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00d4aa] mt-1">✓</span>
                  <span><strong>Growth playbooks</strong> — step-by-step plans tailored to YOUR data</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-linear-to-b from-white to-[#f5f5f8]">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-mono text-3xl font-bold text-[#1a1a2e] mb-4">
            Try it free for 7 days
          </h2>
          <p className="text-[#4a4a6a] mb-8">
            No card required. Connect your first integration and get your first AI insight in under 2 minutes.
          </p>
          <Link 
            href="/signup" 
            className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-8 py-4 font-mono text-sm font-bold text-white transition-all hover:bg-[#00bfa0]"
          >
            Start free trial
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
