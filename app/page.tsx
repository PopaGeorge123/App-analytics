import { AnimatedCounter, DashboardMockup, FaqSection, Nav, LiveUserCount } from "./_components/PageClientIslands";
import { LIVE_INTEGRATIONS } from "@/lib/integrations/catalog";
import type { ReactNode } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Integration pill
// ─────────────────────────────────────────────────────────────────────────────
function IntegrationPill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider"
      style={{ borderColor: `${color}35`, color, backgroundColor: `${color}10` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature card
// ─────────────────────────────────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  description,
  color = "#00d4aa",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  color?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6 transition-all duration-300 hover:border-[#00d4aa]/30 hover:shadow-[0_0_40px_rgba(0,212,170,0.06)]">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(ellipse_at_top_left,rgba(0,212,170,0.04)_0%,transparent_65%)]" />
      <div className="relative">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#363650] bg-[#222235] transition-all group-hover:border-[#00d4aa]/30" style={{ color }}>
          {icon}
        </div>
        <h3 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wide text-[#f8f8fc]">{title}</h3>
        <p className="text-sm leading-relaxed text-[#bcbcd8]">{description}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step
// ─────────────────────────────────────────────────────────────────────────────
function Step({ n, title, description }: { n: number; title: string; description: string }) {
  return (
    <div className="relative flex gap-5">
      <div className="flex flex-col items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/8 font-mono text-sm font-bold text-[#00d4aa]">
          {n}
        </div>
        {n < 3 && <div className="mt-3 flex-1 w-px bg-linear-to-b from-[#00d4aa]/20 to-transparent min-h-8" />}
      </div>
      <div className="pb-10">
        <h3 className="font-mono text-base font-bold text-[#f8f8fc] mb-2">{title}</h3>
        <p className="text-sm leading-relaxed text-[#bcbcd8]">{description}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing card
// ─────────────────────────────────────────────────────────────────────────────
function PricingCard({
  name,
  price,
  description,
  features,
  cta,
  highlight = false,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}) {
  return (
    <div className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
      highlight
        ? "border-[#00d4aa]/40 bg-[#00d4aa]/5 shadow-[0_0_60px_rgba(0,212,170,0.08)]"
        : "border-[#363650] bg-[#1c1c2a]/60"
    }`}>
      {highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full border border-[#00d4aa]/40 bg-[#13131f] px-4 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
          Most Popular
        </div>
      )}
      <div className="mb-6">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa] mb-2">{name}</p>
        {highlight ? (
          <>
            {/* Trial price tag */}
            <div className="mb-3">
              <div className="inline-flex items-baseline gap-1.5 rounded-xl border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-3.5 py-2 mb-2">
                <span className="font-mono text-4xl font-bold text-[#00d4aa]">$0</span>
                <span className="font-mono text-sm text-[#00d4aa]/70">/ 7 days</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <svg className="h-3 w-3 text-[#8585aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="font-mono text-sm text-[#8585aa]">then <span className="text-[#f8f8fc] font-semibold">{price}</span> / month</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-end gap-1.5 mb-3">
            <span className="font-mono text-4xl font-bold text-[#f8f8fc]">{price}</span>
            {price !== "Free" && <span className="font-mono text-sm text-[#8585aa] mb-1">/ month</span>}
          </div>
        )}
        <p className="text-sm text-[#bcbcd8]">{description}</p>
      </div>
      <ul className="flex-1 space-y-3 mb-8">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm text-[#e0e0f0]">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <a href={highlight ? "/api/stripe/checkout" : "/signup"} className={`block w-full rounded-xl py-3 text-center font-mono text-sm font-semibold uppercase tracking-wider transition-all ${
        highlight
          ? "bg-[#00d4aa] text-[#13131f] hover:bg-[#00bfa0]"
          : "border border-[#363650] text-[#bcbcd8] hover:border-[#00d4aa]/40 hover:text-[#00d4aa]"
      }`}>{cta}</a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Testimonial
// ─────────────────────────────────────────────────────────────────────────────
function Testimonial({ quote, name, role, avatar, avatarUrl, stars = 5 }: { quote: string; name: string; role: string; avatar: string; avatarUrl?: string; stars?: number }) {
  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6 flex flex-col">
      <div className="mb-4 flex gap-0.5">
        {Array.from({ length: stars }).map((_, i) => (
          <svg key={i} className="h-3.5 w-3.5 text-[#f59e0b]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      <p className="mb-5 flex-1 text-sm leading-relaxed text-[#e0e0f0]">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} width={36} height={36} className="h-9 w-9 rounded-full object-cover border border-[#363650]" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#363650] font-mono text-sm font-bold text-[#00d4aa]">{avatar}</div>
        )}
        <div>
          <p className="font-mono text-xs font-semibold text-[#f8f8fc]">{name}</p>
          <p className="font-mono text-[10px] text-[#8585aa]">{role}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Security trust badges
// ─────────────────────────────────────────────────────────────────────────────
function SecurityBadges() {
  const badges = [
    {
      icon: (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      label: "OAuth 2.0 only",
      sub: "No passwords stored",
    },
    {
      icon: (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      ),
      label: "TLS 1.3 encrypted",
      sub: "All data in transit",
    },
    {
      icon: (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      label: "Read-only access",
      sub: "We never write to your accounts",
    },
    {
      icon: (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      label: "Encrypted at rest",
      sub: "Supabase AES-256",
    },
    {
      icon: (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      label: "GDPR ready",
      sub: "Delete your data anytime",
    },
  ];

  return (
    <div className="mt-10 rounded-2xl border border-[#363650] bg-[#1c1c2a]/40 px-6 py-5">
      <p className="mb-4 text-center font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Security & Privacy</p>
      <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
        {badges.map((b) => (
          <div key={b.label} className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#00d4aa]/20 bg-[#00d4aa]/8 text-[#00d4aa]">
              {b.icon}
            </div>
            <div>
              <p className="font-mono text-[11px] font-semibold text-[#f8f8fc]">{b.label}</p>
              <p className="font-mono text-[9px] text-[#8585aa]">{b.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen bg-[#13131f] text-[#f8f8fc]">
      <Nav />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-24 px-4 sm:px-6" aria-label="Hero">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-125 w-225 rounded-full bg-[#00d4aa]/4 blur-3xl" />
        <div className="pointer-events-none absolute top-32 left-0 h-80 w-80 rounded-full bg-[#6366f1]/5 blur-3xl" />
        <div className="pointer-events-none absolute top-20 right-0 h-80 w-80 rounded-full bg-[#00d4aa]/3 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">Free to start — no card needed</span>
              </div>

              <h1 className="mb-6 font-mono text-[1.75rem] leading-snug font-bold tracking-tight text-[#f8f8fc] sm:text-4xl lg:text-[3.4rem] lg:leading-tight">
                Stop spending Monday mornings{" "}
                <span className="text-[#00d4aa]">in spreadsheets<span className="text-white">.</span></span>
              </h1>

              <p className="mb-8 w-full max-w-lg text-sm leading-relaxed text-[#bcbcd8] sm:text-base lg:text-lg">
                Fold connects Stripe, Google Analytics, Meta Ads, Mailchimp, Shopify, and <strong className="text-[#f8f8fc] font-semibold">{LIVE_INTEGRATIONS.length - 5} more live integrations</strong>, understand <strong className="text-[#f8f8fc] font-semibold">exactly what changed, why it changed, and what to do next</strong><br /> Before your first coffee.
              </p>

              <div className="mb-8 flex flex-wrap gap-3">
                <a href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-5 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0] hover:shadow-[0_0_30px_rgba(0,212,170,0.3)] sm:px-6 sm:py-3.5">
                  Get started free
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </a>
                <a href="/demo" className="inline-flex items-center gap-2 rounded-xl border border-[#a78bfa]/40 bg-[#a78bfa]/8 px-5 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-[#a78bfa] transition-all hover:border-[#a78bfa]/70 hover:bg-[#a78bfa]/15 sm:px-6 sm:py-3.5">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                  Live demo
                </a>
              </div>

              {/* Risk-zero pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: "✓", text: "7-day free trial" },
                  { icon: "✓", text: "No card required" },
                  { icon: "✓", text: "Connect in 90 seconds" },
                  { icon: "✓", text: "Cancel anytime" },
                ].map((pill) => (
                  <span key={pill.text} className="inline-flex items-center gap-1.5 rounded-full border border-[#363650] bg-[#1c1c2a] px-3 py-1 font-mono text-[10px] font-semibold text-[#bcbcd8]">
                    <span className="text-[#00d4aa]">{pill.icon}</span>
                    {pill.text}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── PAIN STRIP ────────────────────────────────────────────────────── */}
      <section className="border-t border-[#363650] bg-[#0f0f1a] px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <p className="mb-6 text-center font-mono text-[10px] uppercase tracking-widest text-[#58588a]">Sound familiar?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                bad: "Checking 4 different tabs every Monday morning",
                good: "One tab. Everything explained.",
              },
              {
                bad: "Exporting CSVs to compare Stripe vs. ad spend",
                good: "Automatic cross-platform view. Daily.",
              },
              {
                bad: "Guessing why revenue dropped last week",
                good: "AI tells you why. In plain English.",
              },
            ].map((item) => (
              <div key={item.bad} className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f87171]/10 text-[#f87171] font-bold text-[10px]">✕</span>
                  <p className="text-sm text-[#8585aa] leading-snug">{item.bad}</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00d4aa]/10 text-[#00d4aa] font-bold text-[10px]">✓</span>
                  <p className="text-sm font-semibold text-[#f8f8fc] leading-snug">{item.good}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ──────────────────────────────────────────────── */}
      <section className="border-y border-[#363650] bg-[#1c1c2a]/60">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:divide-x sm:divide-[#363650]">
            {[
              { label: "Live integrations", value: <AnimatedCounter target={LIVE_INTEGRATIONS.length} />, color: "#00d4aa" },
              { label: "Founders using Fold", value: <LiveUserCount  />, color: "#00d4aa" },
              { label: "Hours saved per week", value: <><AnimatedCounter target={3} suffix="." /><span>5</span></>, color: "#00d4aa" },
              { label: "Manual exports needed", value: "Zero", color: "#f87171" },
            ].map((s, i) => (
              <div key={i} className="text-center sm:px-6">
                <p className="font-mono text-xs uppercase tracking-widest text-[#8585aa]">{s.label}</p>
                <p className="mt-1 font-mono text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">How it works</p>
            <h2 className="font-mono text-3xl font-bold text-[#f8f8fc] sm:text-4xl">From fragmented data to clear action</h2>
            <p className="mx-auto mt-4 max-w-xl text-[#bcbcd8]">
              Three steps from &ldquo;I have no idea what&apos;s going on&rdquo; to &ldquo;here&apos;s exactly what I need to do today.&rdquo;
            </p>
          </div>
          <div className="mx-auto max-w-2xl">
            <Step n={1} title="Connect your tools in one click"
              description="Link Stripe for revenue, Google Analytics for traffic, Meta Ads for spend, Shopify for orders, Mailchimp for email — plus Lemon Squeezy, Gumroad, Paddle, Plausible, Beehiiv, and WooCommerce. No code, no CSV exports." />
            <Step n={2} title="See your unified dashboard"
              description="All your data normalized into one source of truth. KPI tiles, sparklines, and trends update automatically every day." />
            <Step n={3} title="Let AI do the heavy lifting"
              description="Fold surfaces anomalies, explains trends in plain English, analyzes your website, and gives you a prioritized action list — refreshed daily." />
          </div>

          {/* Platform OAuth trust strip — live integrations only */}
          {(() => {
            const subs: Record<string, string> = {
              stripe: "Payments & MRR",
              ga4: "Sessions & conversions",
              meta: "Ad spend & ROAS",
              "lemon-squeezy": "Digital product revenue",
              gumroad: "Creator sales & subs",
              paddle: "SaaS billing & tax",
              plausible: "Privacy-first traffic",
              mailchimp: "Email campaigns",
              klaviyo: "E-commerce email",
              beehiiv: "Newsletter & subscribers",
              shopify: "Orders & GMV",
              woocommerce: "WordPress store orders",
            };
            return (
              <div className="mt-12 flex flex-wrap justify-center items-center gap-6 sm:gap-8">
                {LIVE_INTEGRATIONS.map((p) => (
                  <Link
                    key={p.id}
                    href={`/learn/${p.id}`}
                    className="flex items-center gap-3 group rounded-xl px-3 py-2 transition-colors hover:bg-[#1c1c2a] border border-transparent hover:border-[#363650]"
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#363650] bg-[#1c1c2a] overflow-hidden transition-colors group-hover:border-[#00d4aa]/40"
                      style={{ backgroundColor: `${p.color}12` }}
                    >
                      <img
                        src={p.icon}
                        alt={p.name}
                        width={22}
                        height={22}
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-semibold text-[#f8f8fc] group-hover:text-[#00d4aa] transition-colors">{p.name}</p>
                      <p className="font-mono text-[9px] text-[#8585aa]">{subs[p.id] ?? p.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            );
          })()}

          <SecurityBadges />

          {/* Learn more link */}
          <div className="mt-8 text-center">
            <a
              href="/learn"
              className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa] transition-colors hover:text-[#00d4aa]"
            >
              See every feature & integration explained in detail
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-150 w-150 rounded-full bg-[#00d4aa]/3 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">Features</p>
            <h2 className="font-mono text-3xl font-bold text-[#f8f8fc] sm:text-4xl">Everything you need to stay ahead</h2>
            <p className="mx-auto mt-4 max-w-xl text-[#bcbcd8]">Four powerful modules. One dashboard. Always on.</p>
          </div>

          {/* Module deep-dives */}
          <div className="space-y-6 mb-10">

            {/* Overview */}
            <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1">
                  <div className="mb-3 inline-flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00d4aa]/20 bg-[#00d4aa]/8 text-[#00d4aa]">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                    </div>
                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">Overview Dashboard</span>
                  </div>
                  <h3 className="font-mono text-xl font-bold text-[#f8f8fc] mb-3">6 KPIs. One glance.</h3>
                  <p className="text-[#bcbcd8] leading-relaxed mb-4">Revenue, sessions, ad spend, new customers, conversions, and customer acquisition cost — all with 7-day trends and comparisons to the prior period.</p>
                  <ul className="space-y-2">
                    {["Revenue & MRR from Stripe", "Sessions & conversions from GA4", "Ad spend & CAC from Meta Ads", "E-commerce orders from Shopify", "Website health score at a glance", "Quick actions & recent activity feed"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#e0e0f0]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:w-56 shrink-0">
                  <div className="rounded-xl border border-[#363650] bg-[#222235] p-4">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[{ l: "Revenue", v: "$12.4k", up: true }, { l: "Sessions", v: "9,340", up: true }, { l: "Ad Spend", v: "$1,920", up: false }, { l: "CAC", v: "$22.86", up: true }].map((k) => (
                        <div key={k.l} className="rounded-lg border border-[#363650] bg-[#1c1c2a] p-2">
                          <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">{k.l}</p>
                          <p className="font-mono text-sm font-bold text-[#f8f8fc]">{k.v}</p>
                          <p className={`font-mono text-[9px] ${k.up ? "text-[#00d4aa]" : "text-red-400"}`}>{k.up ? "▲ 8.2%" : "▼ 3.4%"}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-end gap-1 h-8 px-1">
                      {[45, 62, 55, 78, 70, 88, 95].map((h, i) => (
                        <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? "#00d4aa" : `rgba(0,212,170,${0.1 + i * 0.1})` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6 md:p-8">
              <div className="flex flex-col md:flex-row-reverse md:items-center gap-8">
                <div className="flex-1">
                  <div className="mb-3 inline-flex items-center gap-2 flex-wrap">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#6366f1]/20 bg-[#6366f1]/8 text-[#6366f1]">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                    </div>
                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#6366f1]">Analytics</span>
                    <span className="font-mono text-[8px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/8">Premium</span>
                  </div>
                  <h3 className="font-mono text-xl font-bold text-[#f8f8fc] mb-3">Deep-dive into every metric.</h3>
                  <p className="text-[#bcbcd8] leading-relaxed mb-4">Full 30-day daily breakdown per platform. Sparklines, trend percentages, and per-integration deep dives — Stripe, GA4, Meta Ads, Shopify, and all your other connected tools each get their own view.</p>
                  <ul className="space-y-2">
                    {["30-day daily time-series per integration", "Stripe: MRR, revenue, new customers, refunds", "GA4: sessions, bounce rate, conversions, top pages", "Meta Ads: spend, ROAS, CPC, impressions", "Shopify, Mailchimp & more"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#e0e0f0]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#6366f1] shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:w-56 shrink-0 space-y-2">
                  {[{ n: "Stripe", c: "#6366f1", bars: [40, 55, 48, 70, 65, 80, 88] },
                    { n: "GA4", c: "#f59e0b", bars: [30, 45, 42, 58, 52, 68, 76] },
                    { n: "Meta", c: "#f87171", bars: [20, 30, 25, 38, 32, 28, 35] }].map((pl) => (
                    <div key={pl.n} className="rounded-xl border border-[#363650] bg-[#222235] p-3">
                      <div className="flex justify-between mb-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: pl.c }}>{pl.n}</span>
                        <span className="font-mono text-[9px] font-bold text-[#00d4aa]">▲ 12%</span>
                      </div>
                      <div className="flex items-end gap-0.5 h-6">
                        {pl.bars.map((h, i) => (
                          <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, backgroundColor: i === 6 ? pl.c : `${pl.c}50` }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Website Optimizer */}
            <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1">
                  <div className="mb-3 inline-flex items-center gap-2 flex-wrap">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#34d399]/20 bg-[#34d399]/8 text-[#34d399]">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                    </div>
                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#34d399]">Website Optimizer</span>
                    <span className="font-mono text-[8px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/8">Premium</span>
                  </div>
                  <h3 className="font-mono text-xl font-bold text-[#f8f8fc] mb-3">AI scores your website. Then fixes it.</h3>
                  <p className="text-[#bcbcd8] leading-relaxed mb-4">AI crawls your website, assigns a health score out of 100, and generates a prioritized task list across UX, SEO, performance, copy, conversion, and accessibility.</p>
                  <ul className="space-y-2">
                    {["AI-generated health score 0–100", "Tasks ranked by impact score", "6 categories: UX, SEO, Performance, Copy, Conversion, Accessibility", "Mark tasks complete — score updates live", "Re-analyze anytime with one click"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#e0e0f0]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#34d399] shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:w-56 shrink-0">
                  <div className="rounded-xl border border-[#363650] bg-[#222235] p-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="relative flex items-center justify-center">
                        <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
                          <circle cx="30" cy="30" r="24" fill="none" stroke="#363650" strokeWidth="5" />
                          <circle cx="30" cy="30" r="24" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 24}`} strokeDashoffset={`${2 * Math.PI * 24 * 0.26}`} />
                        </svg>
                        <span className="absolute font-mono text-base font-bold text-[#f59e0b]">74</span>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Health Score</p>
                        <p className="font-mono text-sm font-semibold text-[#f59e0b]">Average</p>
                      </div>
                    </div>
                    {[{ c: "SEO", l: "Add meta descriptions", pts: 8, color: "#34d399" }, { c: "Perf", l: "Compress hero images", pts: 12, color: "#60a5fa" }, { c: "Copy", l: "Sharpen headline", pts: 6, color: "#f59e0b" }].map((t) => (
                      <div key={t.c} className="flex items-center gap-2 rounded-lg border border-[#363650] bg-[#1c1c2a] px-2.5 py-2">
                        <span className="font-mono text-[8px] font-bold px-1.5 rounded" style={{ color: t.color, backgroundColor: `${t.color}18` }}>{t.c}</span>
                        <span className="flex-1 min-w-0 font-mono text-[9px] text-[#bcbcd8] truncate">{t.l}</span>
                        <span className="font-mono text-[9px] font-bold text-[#f59e0b]">+{t.pts}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Advisor */}
            <div className="rounded-2xl border border-[#00d4aa]/15 bg-[#00d4aa]/3 p-6 md:p-8">
              <div className="flex flex-col md:flex-row-reverse md:items-center gap-8">
                <div className="flex-1">
                  <div className="mb-3 inline-flex items-center gap-2 flex-wrap">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00d4aa]/20 bg-[#00d4aa]/8 text-[#00d4aa]">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
                    </div>
                    <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">AI Advisor</span>
                    <span className="font-mono text-[8px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/8">Premium</span>
                  </div>
                  <h3 className="font-mono text-xl font-bold text-[#f8f8fc] mb-3">Ask your data anything.</h3>
                  <p className="text-[#bcbcd8] leading-relaxed mb-4">Multiple persistent conversations, each with full context of your live data across all connected integrations. Get a fresh daily insight generated automatically — and chat with follow-ups any time.</p>
                  <ul className="space-y-2">
                    {["Daily AI-generated insight from your live data", "Multi-conversation chat — revisit old chats anytime", "Ask anything: \"Why did revenue drop last Tuesday?\"", "AI has full context of all your connected integrations", "Rename, organize, and manage chat history"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#e0e0f0]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:w-56 shrink-0 space-y-2">
                  <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 p-3">
                    <p className="font-mono text-[8px] uppercase tracking-widest text-[#00d4aa] mb-1.5">Daily Insight</p>
                    <p className="font-mono text-[10px] text-[#e0e0f0] leading-relaxed"><span className="text-[#f8f8fc] font-semibold">Revenue up 8.2%</span> this week. Highest-converting source is organic search (34% CR). CAC improved 18% — your last A/B test is working.</p>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[90%] rounded-xl bg-[#6366f1]/12 border border-[#6366f1]/20 px-3 py-2 font-mono text-[10px] text-[#e0e0f0]">
                      Why did revenue drop last Tuesday?
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#363650] bg-[#222235] px-3 py-2">
                    <p className="font-mono text-[8px] uppercase tracking-widest text-[#00d4aa] mb-1">AI Advisor</p>
                    <p className="font-mono text-[10px] text-[#e0e0f0] leading-relaxed">Revenue dropped 18% because your Meta campaign hit its budget cap at 2pm. Paid sessions fell 42%. Increase daily budget by ~$40 to fix it.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
                title: "Anomaly Alerts", color: "#f87171",
                description: "Unusual churn? Sudden drop in sessions? Fold catches it before it costs you — and explains why in plain English.",
              },
              {
                icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                title: "Daily Digest", color: "#f59e0b",
                description: "Every morning, your AI-generated summary tells you what changed, what matters, and what to do — before your first coffee.",
              },
              {
                icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>,
                title: "Trend Comparisons", color: "#00d4aa",
                description: "7-day vs prior 7-day comparisons across all metrics. Know immediately whether you're improving or declining.",
              },
              {
                icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>,
                title: `${LIVE_INTEGRATIONS.length} Live Integrations`, color: "#60a5fa",
                description: `${LIVE_INTEGRATIONS.slice(0, 6).map(i => i.name).join(", ")}, and ${LIVE_INTEGRATIONS.length - 6} more — all via OAuth. Your data starts flowing instantly, no API keys needed.`,
              },
              {
                icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
                title: "7-Day Free Trial", color: "#a78bfa",
                description: "Try every feature fully unlocked for 7 days. No card required — just sign up and you're in. Cancel any time and you'll never pay a cent.",
              },
              {
                icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 010 1.9A3.745 3.745 0 0117.34 19.06a3.745 3.745 0 01-1.9 0A3.745 3.745 0 0112 21a3.745 3.745 0 01-3.068-1.593 3.745 3.745 0 010-1.9A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 010-1.9A3.745 3.745 0 017.661 4.94a3.745 3.745 0 011.9 0A3.746 3.746 0 0112 3a3.746 3.746 0 013.068 1.593 3.746 3.746 0 011.9 0 3.745 3.745 0 013.068 3.068 3.746 3.746 0 010 1.9A3.745 3.745 0 0121 12z" /></svg>,
                title: "Built for Founders", color: "#34d399",
                description: "No jargon, no analyst required. Plain-English explanations, opinionated defaults, and actionable outputs only.",
              },
            ].map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} color={f.color} />
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="relative px-6 py-24 border-t border-[#363650]">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-125 w-125 rounded-full bg-[#6366f1]/4 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">Pricing</p>
            <h2 className="font-mono text-3xl font-bold text-[#f8f8fc] sm:text-4xl">Simple, transparent pricing</h2>
            <p className="mx-auto mt-4 max-w-xl text-[#bcbcd8]">Try every feature free for 7 days. No card required — upgrade to Pro when you&apos;re ready. Cancel anytime.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
            {/* Free Trial card */}
            <div className="relative flex flex-col rounded-2xl border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-8">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full border border-[#a78bfa]/40 bg-[#13131f] px-4 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#a78bfa]">
                Start here
              </div>
              <div className="mb-6">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#8585aa] mb-2">Free Trial</p>
                <div className="inline-flex items-baseline gap-1.5 rounded-xl border border-[#a78bfa]/25 bg-[#a78bfa]/8 px-3.5 py-2 mb-3">
                  <span className="font-mono text-4xl font-bold text-[#a78bfa]">$0</span>
                  <span className="font-mono text-sm text-[#a78bfa]/70">/ 7 days</span>
                </div>
                <p className="text-sm text-[#bcbcd8]">Every Premium feature. Fully unlocked. No restrictions — no card required for the trial, upgrade to $29/mo whenever you&apos;re ready.</p>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {[
                  "All Premium features included",
                  "Unified KPI dashboard",
                  "Full analytics per platform",
                  "AI Advisor & daily insights",
                  "Website health score & tasks",
                  "Cancel anytime — no charge",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-[#e0e0f0]">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#a78bfa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/signup" className="block w-full rounded-xl py-3 text-center font-mono text-sm font-semibold uppercase tracking-wider transition-all border border-[#a78bfa]/40 text-[#a78bfa] hover:border-[#a78bfa]/80 hover:bg-[#a78bfa]/10">
                Start free trial
              </a>
            </div>

            {/* Premium card */}
            <PricingCard
              name="Premium"
              price="$29"
              description="Full access to every feature. Starts with a 7-day free trial — no card required. $29/month after the trial, cancel anytime."
              features={[
                "Unified KPI dashboard with 7-day trends",
                "Full 30-day analytics per platform",
                "AI Advisor with multi-conversation history",
                "Daily AI-generated insight",
                "Website health score & full task list",
                "Anomaly detection & alerts",
                "Priority support",
                "7-day free trial · cancel before day 8",
              ]}
              cta="Start 7-day free trial"
              highlight
            />
          </div>
          <p className="mt-5 text-center font-mono text-[11px] text-[#8585aa]">
            Not ready to commit?{" "}
            <a href="/signup" className="text-[#00d4aa] hover:underline">Create a free account</a>
            {" "}to explore the app — you can start your trial any time from inside the dashboard.
          </p>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-[#363650]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">Real users</p>
            <h2 className="font-mono text-3xl font-bold text-[#f8f8fc]">What founders are saying</h2>
            <p className="mt-3 text-[#8585aa] text-sm">From solo bootstrappers to growing DTC brands.</p>
          </div>

          {/* Row 1 — large featured */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
            <Testimonial
              quote="I used to spend Monday mornings pulling Stripe exports and matching them against GA4 manually. With Fold, I open one tab and it's all there, already explained. I actually look forward to Mondays now."
              name="Sarah K."
              role="Founder, SaaS productivity tool"
              avatar="SK"
              avatarUrl="https://i.pravatar.cc/150?u=sarah-k-fold"
            />
            <Testimonial
              quote="The AI caught a revenue anomaly I would have missed for days. It told me exactly which campaign was the problem and what to do about it. Paid for itself in the first week."
              name="Marcus D."
              role="E-commerce founder · $2.4M ARR"
              avatar="MD"
              avatarUrl="https://i.pravatar.cc/150?u=marcus-d-fold"
            />
            <Testimonial
              quote="The website optimizer found 14 improvements I didn't know existed and ranked them by impact. My site score went from 61 to 88 in two weeks. Conversion rate is up 18%."
              name="Priya A."
              role="DTC brand owner"
              avatar="PA"
              avatarUrl="https://i.pravatar.cc/150?u=priya-a-fold"
            />
          </div>

          {/* Row 2 — medium */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
            <Testimonial
              quote="I connected Beehiiv and Stripe and immediately saw that my Thursday newsletter drives 3x more paid conversions than Friday. Changed my whole publishing schedule."
              name="Tom R."
              role="Newsletter founder · 28k subscribers"
              avatar="TR"
              avatarUrl="https://i.pravatar.cc/150?u=tom-r-fold"
            />
            <Testimonial
              quote="Fold replaced three different dashboards I was paying for. One place for Shopify, Klaviyo, and Meta Ads. The anomaly alerts alone are worth the price."
              name="Leila M."
              role="Shopify brand · $800k/yr"
              avatar="LM"
              avatarUrl="https://i.pravatar.cc/150?u=leila-m-fold"
            />
            <Testimonial
              quote="Setup took 4 minutes. I connected GA4 and Plausible and finally stopped arguing with myself about which analytics tool to trust. Fold just shows me both, reconciled."
              name="James O."
              role="Indie hacker · 3 products"
              avatar="JO"
              avatarUrl="https://i.pravatar.cc/150?u=james-o-fold"
            />
          </div>

          {/* Row 3 — compact */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Testimonial
              quote="The daily digest email is the only morning report I actually read. It's two paragraphs and tells me exactly what moved and why."
              name="Nadia V."
              role="B2B SaaS founder"
              avatar="NV"
              avatarUrl="https://i.pravatar.cc/150?u=nadia-v-fold"
              stars={5}
            />
            <Testimonial
              quote="Connecting HubSpot took 30 seconds. Now I can see deal pipeline value next to Stripe MRR in the same view. This is what I always wanted."
              name="Chris B."
              role="Sales-led SaaS · Series A"
              avatar="CB"
              avatarUrl="https://i.pravatar.cc/150?u=chris-b-fold"
              stars={5}
            />
            <Testimonial
              quote="I was skeptical about another analytics tool, but Fold is different — it tells you what to do, not just what happened. That's the gap everything else misses."
              name="Amara F."
              role="Founder & solo developer"
              avatar="AF"
              avatarUrl="https://i.pravatar.cc/150?u=amara-f-fold"
              stars={5}
            />
          </div>
        </div>
      </section>

      {/* ── FOUNDER ───────────────────────────────────────────────────────── */}
      <section className="border-t border-[#363650] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-10 md:flex-row md:items-start md:gap-14">
            {/* Photo */}
            <div className="shrink-0">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-[#00d4aa]/10 blur-xl" />
                <img
                  src="/founder-george-popa.jpg"
                  alt="George Popa — Founder of Fold"
                  className="relative h-48 w-48 rounded-2xl object-cover object-top border border-[#363650] shadow-xl"
                />
              </div>
              <div className="mt-3 text-center">
                <p className="font-mono text-sm font-bold text-[#f8f8fc]">George Popa</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#00d4aa]">Founder &amp; CEO</p>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 space-y-5">
              <div>
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">Why I built Fold</p>
                <h2 className="font-mono text-2xl font-bold text-[#f8f8fc] sm:text-3xl leading-snug">
                  Built by a founder,<br className="hidden sm:block" /> for founders.
                </h2>
              </div>

              <p className="text-[#bcbcd8] leading-relaxed">
                I ran a small SaaS and every Monday I'd open five browser tabs, Stripe, Google Analytics, Mailchimp, Meta Ads, Shopify, just to piece together what happened last week. It took 40 minutes and I still wasn't sure I had the full picture.
              </p>
              <p className="text-[#bcbcd8] leading-relaxed">
                Fold is the dashboard I wish existed. Every metric you care about, in one place, with a plain-English summary that tells you <em className="text-[#f8f8fc] not-italic font-medium">why</em> things moved, not just that they did. No data science degree required.
              </p>

              {/* Credibility bar */}
              <div className="flex flex-wrap gap-3 pt-1">
                {[
                  { label: "Bootstrapped" },
                  { label: "No VC pressure" },
                  { label: "Built in public" },
                  { label: "Shipping weekly" },
                ].map(({ label }) => (
                  <span
                    key={label}
                    className="rounded-lg border border-[#1e1e30] bg-[#13131f] px-3 py-1.5 font-mono text-[10px] text-[#8585aa]"
                  >
                    {label}
                  </span>
                ))}
              </div>

              <p className="font-mono text-sm text-[#58588a] pt-1">
                Questions? I personally reply to every email —{" "}
                <a href="mailto:info@usefold.io" className="text-[#00d4aa] hover:underline underline-offset-2">
                  info@usefold.io
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="px-6 py-24 border-t border-[#363650]">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">FAQ</p>
            <h2 className="font-mono text-3xl font-bold text-[#f8f8fc] sm:text-4xl">Common questions</h2>
            <p className="mx-auto mt-4 max-w-lg text-[#bcbcd8]">Everything you need to know before you connect your first integration.</p>
          </div>
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 px-6 divide-y-0">
            <FaqSection />
          </div>
          <p className="mt-6 text-center font-mono text-xs text-[#8585aa]">
            Still have questions?{" "}
            <a href="mailto:info@usefold.io" className="text-[#00d4aa] hover:underline">Email us →</a>
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 py-32 border-t border-[#363650]">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-125 w-125 rounded-full bg-[#00d4aa]/5 blur-3xl" />
        </div>
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-64 w-150 rounded-full bg-[#00d4aa]/4 blur-3xl" />
        <div className="relative mx-auto max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">7-day free trial · No card required · $29/mo after</span>
          </div>
          <h2 className="mb-4 font-mono text-4xl font-bold text-[#f8f8fc] sm:text-5xl leading-tight">
            Stop guessing.
            <br />
            <span className="text-[#00d4aa]">Start knowing.</span>
          </h2>
          <p className="mb-10 text-lg text-[#bcbcd8] max-w-lg mx-auto">
            Connect your live integrations in minutes. Get a unified dashboard, AI-generated daily insights, and a website optimizer — all your data, all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/api/stripe/checkout" className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0] hover:shadow-[0_0_40px_rgba(0,212,170,0.35)]">
              Start 7-day free trial
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </a>
            <a href="/login" className="font-mono text-sm text-[#8585aa] uppercase tracking-widest hover:text-[#f8f8fc] transition-colors">
              Already have an account? Sign in →
            </a>
          </div>
          <p className="mt-6 font-mono text-[10px] text-[#8585aa]">7 days free · no card required · $29/month after · cancel anytime</p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#363650] px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            <div>
              <img src="/fold-primary-dark.svg" alt="Fold" className="h-9 w-auto mb-3" />
              <p className="text-sm text-[#8585aa] leading-relaxed max-w-xs">
                AI-powered business intelligence for small business founders. Know what&apos;s happening. Know what to do.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <IntegrationPill name="Stripe" color="#6366f1" />
                <IntegrationPill name="GA4" color="#f59e0b" />
                <IntegrationPill name="Meta" color="#f87171" />
                <IntegrationPill name="Shopify" color="#96bf48" />
                <IntegrationPill name="Mailchimp" color="#f59e0b" />
                <IntegrationPill name="50+ more" color="#00d4aa" />
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] mb-4">Product</p>
              <ul className="space-y-3">
                {[{ l: "Features", h: "#features" }, { l: "How it works", h: "#how-it-works" }, { l: "Pricing", h: "#pricing" }, { l: "FAQ", h: "#faq" }, { l: "Sign in", h: "/login" }, { l: "Get started free", h: "/signup" }].map((item) => (
                  <li key={item.l}><a href={item.h} className="text-sm text-[#8585aa] hover:text-[#f8f8fc] transition-colors">{item.l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] mb-4">Legal</p>
              <ul className="space-y-3">
                {[{ l: "Privacy Policy", h: "/privacy" }, { l: "Terms of Service", h: "/terms" }].map((item) => (
                  <li key={item.l}><a href={item.h} className="text-sm text-[#8585aa] hover:text-[#f8f8fc] transition-colors">{item.l}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[#363650] pt-8">
            <p className="font-mono text-[11px] text-[#8585aa]">© 2026 Fold. Built for founders who want clarity, not complexity.</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
              <span className="font-mono text-[10px] text-[#00d4aa]">Systems nominal</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
