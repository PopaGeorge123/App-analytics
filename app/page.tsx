"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Zap,
  AlertTriangle,
  Target,
  MessageSquare,
  Layers,
} from "lucide-react";
import EmailForm from "@/components/EmailForm";
import FeatureCard from "@/components/FeatureCard";
import HowItWorksStep from "@/components/HowItWorksStep";

// ---------------------------------------------------------------------------
// Animated number counter
// ---------------------------------------------------------------------------
function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 1800,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
            else setValue(target);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dashboard mockup in hero
// ---------------------------------------------------------------------------
function DashboardMockup() {
  const metrics = [
    { label: "MRR", value: "$12,480", change: "+8.2%", up: true },
    { label: "Churn", value: "2.4%", change: "+0.3%", up: false },
    { label: "Open Rate", value: "34.1%", change: "+4.7%", up: true },
    { label: "CAC", value: "$142", change: "-11%", up: true },
  ];

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      {/* Outer glow */}
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-[#00d4aa]/5 blur-2xl" />

      {/* Dashboard card */}
      <div className="relative rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/90 p-5 backdrop-blur-sm shadow-2xl">
        {/* Window controls */}
        <div className="mb-4 flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-[10px] tracking-widest text-[#2a2a4a] uppercase">
            pulse / dashboard
          </span>
          <div className="ml-auto flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-mono text-[9px] text-[#00d4aa] tracking-widest">LIVE</span>
          </div>
        </div>

        {/* Metric tiles */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-3"
            >
              <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-[#4a4a6a]">
                {m.label}
              </p>
              <p className="font-mono text-base font-bold text-[#f0f0f5]">{m.value}</p>
              <p
                className={`mt-0.5 font-mono text-[10px] ${
                  m.up ? "text-[#00d4aa]" : "text-red-400"
                }`}
              >
                {m.change}
              </p>
            </div>
          ))}
        </div>

        {/* Mini bar chart */}
        <div className="mb-4 rounded-xl border border-[#1e1e2e] bg-[#12121a] p-3">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-[#4a4a6a]">
            Revenue — last 7 days
          </p>
          <div className="flex items-end gap-1.5 h-12">
            {[45, 62, 55, 78, 70, 88, 95].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-700"
                style={{
                  height: `${h}%`,
                  background:
                    i === 6
                      ? "#00d4aa"
                      : `rgba(0,212,170,${0.15 + i * 0.08})`,
                }}
              />
            ))}
          </div>
        </div>

        {/* AI insight card */}
        <div className="rounded-xl border border-[#00d4aa]/25 bg-[#00d4aa]/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00d4aa]/20">
              <Zap size={11} className="text-[#00d4aa]" />
            </div>
            <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
              AI Insight
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#aaaacc]">
            <span className="font-semibold text-[#f0f0f5]">Churn spiked 12% this week</span>
            {" "}— 3 customers cancelled after the price change. Consider a targeted retention email to at-risk accounts.
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[9px] text-red-400">
              ⚠ Anomaly
            </span>
            <span className="rounded-full bg-[#00d4aa]/10 px-2 py-0.5 font-mono text-[9px] text-[#00d4aa]">
              Action recommended
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------
const features = [
  {
    icon: BarChart3,
    title: "Unified Metrics",
    description:
      "MRR, churn, email open rates, ad spend, and product engagement in one place. No more tab-switching.",
  },
  {
    icon: Zap,
    title: "AI Daily Digest",
    description:
      "Every morning, Pulse tells you what changed, what matters, and what to do. Like a CFO in your inbox.",
  },
  {
    icon: AlertTriangle,
    title: "Anomaly Detection",
    description:
      "Unusual churn? Drop in engagement? Pulse catches it before it costs you — and explains why.",
  },
  {
    icon: Target,
    title: "Revenue Objectives",
    description:
      "AI-generated, prioritized action list tailored to your current data. Clarity over noise.",
  },
  {
    icon: MessageSquare,
    title: "Natural Language Chat",
    description:
      'Ask your dashboard anything. "Why did revenue drop last week?" Gets a real, data-backed answer.',
  },
  {
    icon: Layers,
    title: "Multi-Platform Intelligence",
    description:
      "Connects Stripe, Mailchimp, PostHog, Meta Ads, Google Ads — unified into one coherent view.",
  },
];

// ---------------------------------------------------------------------------
// How it works data
// ---------------------------------------------------------------------------
const steps = [
  {
    title: "Connect your tools",
    description:
      "Connect Stripe, Mailchimp, PostHog, and your ad platforms in one click. No code, no manual exports.",
  },
  {
    title: "Get your unified dashboard",
    description:
      "All your revenue, product, and marketing data normalized into a single source of truth. Updated automatically.",
  },
  {
    title: "Let AI do the analysis",
    description:
      "Pulse surfaces anomalies, explains trends in plain English, and gives you prioritized objectives to increase revenue — updated daily.",
  },
];

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-[#1e1e2e] bg-[#0a0a0f]/80 backdrop-blur-md"
          : "bg-transparent"
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <div>
          <span className="font-mono text-lg font-bold tracking-tight text-[#f0f0f5]">
            PULSE
          </span>
          <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-widest text-[#4a4a6a] sm:inline">
            AI Business Intelligence
          </span>
        </div>

        {/* CTA */}
        <a
          href="#waitlist"
          className="rounded-xl border border-[#00d4aa]/40 bg-[#00d4aa]/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-[#00d4aa] transition-all hover:bg-[#00d4aa]/20 hover:border-[#00d4aa]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa]/50"
        >
          Join waitlist
        </a>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0f0f5]">
      <Nav />

      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="relative overflow-hidden pt-36 pb-24 px-6"
        aria-label="Hero"
      >
        {/* Background glows */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-[#00d4aa]/4 blur-3xl" />
        <div className="pointer-events-none absolute top-20 left-10 h-64 w-64 rounded-full bg-[#00d4aa]/3 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            {/* Left: text */}
            <div>
              {/* Badge */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/8 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">
                  Now accepting waitlist
                </span>
              </div>

              <h1 className="mb-6 font-mono text-4xl font-bold leading-tight tracking-tight text-[#f0f0f5] sm:text-5xl lg:text-6xl">
                Your entire business,{" "}
                <span className="text-[#00d4aa]">understood</span>{" "}
                in seconds.
              </h1>

              <p className="mb-8 max-w-lg text-base leading-relaxed text-[#8888aa] sm:text-lg">
                Pulse connects to Stripe, Mailchimp, PostHog, and other
                platforms then uses AI to tell you exactly what&apos;s
                happening, what went wrong, and what to do next to grow
                revenue.
              </p>

              <div id="waitlist">
                <EmailForm size="large" />
              </div>

              {/* Integration logos (text) */}
              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#2a2a4a]">
                  Connects to:
                </span>
                {["Stripe", "Mailchimp", "PostHog", "Meta Ads", "Google Ads"].map(
                  (name) => (
                    <span
                      key={name}
                      className="font-mono text-[10px] uppercase tracking-wider text-[#4a4a6a]"
                    >
                      {name}
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Right: dashboard mockup */}
            <div className="flex items-center justify-center">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SOCIAL PROOF TICKER                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-label="Social proof"
        className="border-y border-[#1e1e2e] bg-[#0d0d16]/60"
      >
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:divide-x sm:divide-[#1e1e2e]">
            <div className="text-center sm:pr-6">
              <p className="font-mono text-xs uppercase tracking-widest text-[#4a4a6a]">
                Designed for
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-[#f0f0f5]">
                Founders, not analysts
              </p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-mono text-xs uppercase tracking-widest text-[#4a4a6a]">
                Integrations at launch
              </p>
              <p className="mt-1 font-mono text-3xl font-bold text-[#00d4aa]">
                <AnimatedCounter target={5} />
              </p>
            </div>
            <div className="text-center sm:pl-6">
              <p className="font-mono text-xs uppercase tracking-widest text-[#4a4a6a]">
                On the waitlist
              </p>
              <p className="mt-1 font-mono text-3xl font-bold text-[#00d4aa]">
                <AnimatedCounter target={200} suffix="+" />
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* HOW IT WORKS                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 py-24" aria-labelledby="how-it-works-heading">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">
              How it works
            </p>
            <h2
              id="how-it-works-heading"
              className="font-mono text-3xl font-bold text-[#f0f0f5] sm:text-4xl"
            >
              From fragmented data to clear action
            </h2>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {steps.map((step, i) => (
              <HowItWorksStep
                key={step.title}
                step={i + 1}
                title={step.title}
                description={step.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FEATURES                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="relative px-6 py-24"
        aria-labelledby="features-heading"
      >
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-[#00d4aa]/3 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">
              Features
            </p>
            <h2
              id="features-heading"
              className="font-mono text-3xl font-bold text-[#f0f0f5] sm:text-4xl"
            >
              Everything you need to stay ahead
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#8888aa]">
              All the intelligence a founder needs — in one place, always on,
              always up to date.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard
                key={f.title}
                icon={f.icon}
                title={f.title}
                description={f.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECOND CTA                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="relative overflow-hidden px-6 py-32"
        aria-labelledby="cta-heading"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-96 w-96 rounded-full bg-[#00d4aa]/6 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-2xl text-center">
          <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">
            Early access
          </p>
          <h2
            id="cta-heading"
            className="mb-4 font-mono text-4xl font-bold text-[#f0f0f5] sm:text-5xl"
          >
            Stop guessing.
            <br />
            Start knowing.
          </h2>
          <p className="mb-10 text-lg text-[#8888aa]">
            Be the first to know when Pulse launches. No commitment — just early
            access.
          </p>
          <div className="flex justify-center">
            <EmailForm size="large" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-[#1e1e2e] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            {/* Logo + description */}
            <div>
              <p className="mb-1 font-mono text-sm font-bold text-[#f0f0f5]">PULSE</p>
              <p className="text-xs text-[#4a4a6a]">
                AI-powered business intelligence for small business founders.
              </p>
            </div>

            {/* Links */}
            <nav aria-label="Footer navigation">
              <div className="flex items-center gap-6">
                <a
                  href="/privacy"
                  className="text-xs text-[#4a4a6a] transition-colors hover:text-[#8888aa]"
                >
                  Privacy Policy
                </a>
                <a
                  href="/terms"
                  className="text-xs text-[#4a4a6a] transition-colors hover:text-[#8888aa]"
                >
                  Terms
                </a>
              </div>
            </nav>
          </div>

          <div className="mt-8 border-t border-[#1e1e2e] pt-8">
            <p className="font-mono text-[11px] text-[#2a2a4a]">
              © 2026 Pulse. Built for small business founders.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
