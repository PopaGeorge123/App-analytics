"use client";

import { useEffect, useRef, useState } from "react";

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

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard mockup — tabbed
// ─────────────────────────────────────────────────────────────────────────────
function DashboardMockup() {
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "website" | "ai">("overview");

  const tabs: { id: "overview" | "analytics" | "website" | "ai"; label: string; premium: boolean }[] = [
    { id: "overview",  label: "Overview",    premium: false },
    { id: "analytics", label: "Analytics",   premium: true  },
    { id: "website",   label: "Website",     premium: true  },
    { id: "ai",        label: "AI Advisor",  premium: true  },
  ];

  const activePremium = tabs.find((t) => t.id === activeTab)?.premium ?? false;

  return (
    <div className="relative w-full max-w-xl mx-auto select-none">
      <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-[#00d4aa]/6 blur-3xl" />
      <div className="relative rounded-2xl border border-[#363650] bg-[#1c1c2a]/95 shadow-2xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-0">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-[9px] tracking-widest text-[#8585aa] uppercase">fold / dashboard</span>
          <div className="ml-auto flex items-center gap-1 mr-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-mono text-[9px] text-[#00d4aa] tracking-widest">LIVE</span>
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex border-b border-[#363650] px-4 mt-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center gap-1 px-3 pb-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                activeTab === t.id
                  ? "border-[#00d4aa] text-[#00d4aa]"
                  : t.premium
                  ? "border-transparent text-[#3a3a5a] hover:text-[#6a6a8a]"
                  : "border-transparent text-[#8585aa] hover:text-[#bcbcd8]"
              }`}
            >
              {t.label}
              {t.premium && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="opacity-60 mb-0.5">
                  <path d="M12 1a5 5 0 00-5 5v3H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V11a2 2 0 00-2-2h-2V6a5 5 0 00-5-5zm3 8H9V6a3 3 0 116 0v3z"/>
                </svg>
              )}
            </button>
          ))}
        </div>
        {/* Tab content */}
        <div className="relative p-4">
          {activeTab === "overview" && <OverviewMockup />}
          {activeTab === "analytics" && <AnalyticsMockup />}
          {activeTab === "website"   && <WebsiteMockup />}
          {activeTab === "ai"        && <AiMockup />}

          {/* Premium overlay — shown over locked tabs */}
          {activePremium && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-b-2xl backdrop-blur-sm bg-[#1c1c2a]/80">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/10 mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#a78bfa]">
                  <path d="M12 1a5 5 0 00-5 5v3H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V11a2 2 0 00-2-2h-2V6a5 5 0 00-5-5zm3 8H9V6a3 3 0 116 0v3z"/>
                </svg>
              </div>
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#f8f8fc] mb-1">Premium feature</p>
              <p className="font-mono text-[10px] text-[#8585aa] mb-4 text-center px-6">Upgrade to unlock Analytics, Website Optimizer &amp; AI Advisor.</p>
              <a
                href="/signup"
                className="rounded-xl bg-[#a78bfa] px-5 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#9674f5]"
              >
                Upgrade to Premium
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewMockup() {
  const kpis = [
    { label: "Revenue (7d)", value: "$12,480", change: "+8.2%", up: true },
    { label: "Sessions", value: "9,340", change: "+14.1%", up: true },
    { label: "Ad Spend", value: "$1,920", change: "-3.4%", up: true },
    { label: "New Customers", value: "84", change: "+22%", up: true },
    { label: "Conversions", value: "312", change: "+6.7%", up: true },
    { label: "CAC", value: "$22.86", change: "-18%", up: true },
  ];
  return (
    <div className="space-y-3">
      {/* Free plan badge */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-widest text-[#00d4aa]">
          <span className="h-1 w-1 rounded-full bg-[#00d4aa]" />
          Free plan
        </span>
        <span className="font-mono text-[8px] text-[#8585aa] uppercase tracking-widest">7-day view</span>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-[#363650] bg-[#222235] p-2.5">
            <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa] mb-1">{k.label}</p>
            <p className="font-mono text-sm font-bold text-[#f8f8fc]">{k.value}</p>
            <p className={`font-mono text-[9px] ${k.up ? "text-[#00d4aa]" : "text-red-400"}`}>{k.change}</p>
          </div>
        ))}
      </div>

      {/* Revenue bar chart */}
      <div className="rounded-xl border border-[#363650] bg-[#222235] p-3">
        <p className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Revenue — last 7 days</p>
        <div className="flex items-end gap-1 h-10">
          {[45, 62, 55, 78, 70, 88, 95].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? "#00d4aa" : `rgba(0,212,170,${0.12 + i * 0.09})` }} />
          ))}
        </div>
      </div>

      {/* Premium teaser row */}
      <div className="relative rounded-xl border border-[#a78bfa]/15 bg-[#a78bfa]/5 px-3 py-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-[#a78bfa]">
              <path d="M12 1a5 5 0 00-5 5v3H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V11a2 2 0 00-2-2h-2V6a5 5 0 00-5-5zm3 8H9V6a3 3 0 116 0v3z"/>
            </svg>
            <span className="font-mono text-[8px] uppercase tracking-widest text-[#6a6a9a]">
              Analytics · Website · AI Advisor
            </span>
          </div>
          <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#a78bfa]">Premium</span>
        </div>
        {/* blurred fake bars */}
        <div className="mt-2 flex items-end gap-1 h-5 blur-sm opacity-40 pointer-events-none">
          {[30, 50, 40, 65, 55, 75, 85, 60, 70, 90].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm bg-[#a78bfa]" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsMockup() {
  const platforms = [
    { name: "Stripe", color: "#6366f1", vals: [42, 58, 54, 73, 68, 82, 91] },
    { name: "Google Analytics", color: "#f59e0b", vals: [30, 45, 50, 60, 55, 72, 80] },
    { name: "Meta Ads", color: "#f87171", vals: [20, 28, 22, 35, 30, 42, 48] },
  ];
  return (
    <div className="space-y-2.5">
      {platforms.map((p) => (
        <div key={p.name} className="rounded-xl border border-[#363650] bg-[#222235] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#bcbcd8]">{p.name}</p>
            <span className="font-mono text-[9px] text-[#00d4aa]">▲ 12%</span>
          </div>
          <div className="flex items-end gap-1 h-8">
            {p.vals.map((h, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, backgroundColor: i === 6 ? p.color : `${p.color}50` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WebsiteMockup() {
  const score = 74;
  const tasks = [
    { cat: "SEO", label: "Add meta descriptions to 12 pages", pts: 8, color: "#34d399" },
    { cat: "Performance", label: "Compress hero images (saves 1.2s)", pts: 12, color: "#60a5fa" },
    { cat: "Copy", label: "Sharpen homepage headline clarity", pts: 6, color: "#f59e0b" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-xl border border-[#363650] bg-[#222235] p-3">
        <div className="relative flex items-center justify-center shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" stroke="#363650" strokeWidth="5" />
            <circle cx="32" cy="32" r="26" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 26}`} strokeDashoffset={`${2 * Math.PI * 26 * (1 - score / 100)}`} />
          </svg>
          <span className="absolute font-mono text-base font-bold text-[#f59e0b]">{score}</span>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-0.5">Website Health</p>
          <p className="font-mono text-sm font-semibold text-[#f59e0b]">Average</p>
          <p className="font-mono text-[9px] text-[#8585aa]">3 tasks pending</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div key={t.label} className="flex items-center gap-2.5 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2">
            <span className="font-mono text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ color: t.color, backgroundColor: `${t.color}15` }}>{t.cat}</span>
            <span className="flex-1 min-w-0 font-mono text-[10px] text-[#e0e0f0] truncate">{t.label}</span>
            <span className="font-mono text-[9px] font-bold text-[#f59e0b] shrink-0">+{t.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiMockup() {
  const msgs = [
    { role: "user", text: "Why did revenue drop last Tuesday?" },
    { role: "ai", text: "Revenue dropped 18% on Tuesday because your Meta campaign paused mid-day (budget limit hit at 2pm). Sessions from paid traffic fell 42%. Consider increasing daily budget by ~$40." },
  ];
  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 p-3 mb-1">
        <p className="font-mono text-[8px] uppercase tracking-widest text-[#00d4aa] mb-1.5">Daily Insight</p>
        <p className="font-mono text-[10px] text-[#e0e0f0] leading-relaxed">
          <span className="text-[#f8f8fc] font-semibold">Revenue up 8.2%</span> this week. Highest-converting source is organic search (34% CR). CAC improved 18% — your A/B test is working.
        </p>
      </div>
      {msgs.map((m, i) => (
        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-xl px-3 py-2 font-mono text-[10px] leading-relaxed ${
            m.role === "user"
              ? "bg-[#6366f1]/15 border border-[#6366f1]/20 text-[#e0e0f0]"
              : "bg-[#222235] border border-[#363650] text-[#e0e0f0]"
          }`}>
            {m.role === "ai" && <span className="block font-mono text-[8px] uppercase tracking-widest text-[#00d4aa] mb-1">AI Advisor</span>}
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

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
  icon: React.ReactNode;
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
        <div className="flex items-end gap-1.5 mb-3">
          <span className="font-mono text-4xl font-bold text-[#f8f8fc]">{price}</span>
          {price !== "Free" && <span className="font-mono text-sm text-[#8585aa] mb-1">/ month</span>}
        </div>
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
      <a href="/signup" className={`block w-full rounded-xl py-3 text-center font-mono text-sm font-semibold uppercase tracking-wider transition-all ${
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
function Testimonial({ quote, name, role, avatar }: { quote: string; name: string; role: string; avatar: string }) {
  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6">
      <div className="mb-4 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} className="h-3.5 w-3.5 text-[#f59e0b]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      <p className="mb-5 text-sm leading-relaxed text-[#e0e0f0]">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#363650] font-mono text-sm font-bold text-[#00d4aa]">{avatar}</div>
        <div>
          <p className="font-mono text-xs font-semibold text-[#f8f8fc]">{name}</p>
          <p className="font-mono text-[10px] text-[#8585aa]">{role}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "Is my financial data safe?",
    a: "Yes. Fold connects via official OAuth — we never see or store your Stripe secret key, Google password, or Meta credentials. All data is transmitted over TLS 1.3 and stored encrypted at rest. We read-only aggregated metrics; we cannot move money or modify your accounts.",
  },
  {
    q: "What integrations do you support?",
    a: "At launch: Stripe (revenue, MRR, transactions, refunds, new customers), Google Analytics 4 (sessions, conversions, bounce rate, top pages), and Meta Ads (spend, ROAS, CPC, impressions, clicks). More integrations are on the roadmap.",
  },
  {
    q: "How is Fold different from Stripe Dashboard or GA4?",
    a: "Stripe Dashboard shows Stripe data. GA4 shows website data. Meta Ads Manager shows ad data. None of them talk to each other. Fold connects all three, normalises them into one timeline, calculates cross-platform metrics like ROAS and CAC, and adds AI that explains what it all means in plain English.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. Setup is three OAuth clicks — one for each integration. There are no API keys, no webhooks to configure, and no developer required. If you can log in to Stripe, you can set up Fold.",
  },
  {
    q: "What does the free plan include?",
    a: "The free plan gives you the full Overview dashboard — 6 KPI tiles, 7-day trends, recent activity feed, and quick actions — forever. The Premium plan unlocks deep per-platform analytics, the AI Advisor, the website optimizer, anomaly alerts, and the daily digest.",
  },
  {
    q: "How much does Premium cost?",
    a: "Premium is $29/month. There's no annual lock-in — cancel any time. We also offer a free trial so you can see the full product before committing.",
  },
  {
    q: "Can I cancel my subscription at any time?",
    a: "Yes. Cancel with one click from your account settings. You keep access until the end of your billing period. No questions, no retention loops.",
  },
  {
    q: "How often does my data update?",
    a: "Fold syncs your Stripe, GA4, and Meta data automatically every day. The overview dashboard reflects yesterday's numbers by default. You can also trigger a manual sync at any time from the settings page.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#363650] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="font-mono text-sm font-semibold text-[#f8f8fc]">{q}</span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#363650] text-[#8585aa] transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-[#bcbcd8]">{a}</p>
      )}
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
// Nav
// ─────────────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav className={`fixed top-0 z-50 w-full backdrop-blur-xl transition-all duration-300 ${
      scrolled ? "border-b border-[#363650] bg-[#13131f]/90" : "bg-[#13131f]/60 border-b border-[#363650]/40"
    }`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <img src="/fold-primary-dark.svg" alt="Fold" className="h-9 w-auto" />

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="font-mono text-xs uppercase tracking-widest text-[#8585aa] transition-colors hover:text-[#f8f8fc]">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a href="/login" className="hidden md:block font-mono text-xs uppercase tracking-widest text-[#8585aa] transition-colors hover:text-[#f8f8fc] px-3 py-2">
            Sign in
          </a>
          <a href="/signup" className="rounded-xl bg-[#00d4aa] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0]">
            Get started free
          </a>
          <button className="md:hidden p-2 text-[#8585aa] hover:text-[#f8f8fc]" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
                  <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
                  <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-[#363650] bg-[#13131f]/95 backdrop-blur-xl px-6 py-4 space-y-3">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="block font-mono text-xs uppercase tracking-widest text-[#bcbcd8] py-2 hover:text-[#f8f8fc]">
              {l.label}
            </a>
          ))}
          <a href="/login" className="block font-mono text-xs uppercase tracking-widest text-[#bcbcd8] py-2 hover:text-[#f8f8fc]">Sign in</a>
          <a href="/signup" className="block font-mono text-xs uppercase tracking-widest text-[#00d4aa] py-2 font-semibold hover:text-[#00bfa0]">Get started free</a>
        </div>
      )}
    </nav>
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
      <section className="relative overflow-hidden pt-32 pb-24 px-6" aria-label="Hero">
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

              <h1 className="mb-6 font-mono text-4xl font-bold leading-tight tracking-tight text-[#f8f8fc] sm:text-5xl lg:text-[3.4rem]">
                Stop spending Monday mornings{" "}
                <span className="text-[#00d4aa]">in spreadsheets<span className="text-white">.</span></span>
              </h1>

              <p className="mb-8 max-w-lg text-base leading-relaxed text-[#bcbcd8] sm:text-lg">
                Fold connects Stripe, Google Analytics, and Meta Ads — then tells you <strong className="text-[#f8f8fc] font-semibold">exactly what changed, why it changed, and what to do next</strong>. Before your first coffee.
              </p>

              <div className="mb-8 flex flex-wrap gap-3">
                <a href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-6 py-3.5 font-mono text-sm font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0] hover:shadow-[0_0_30px_rgba(0,212,170,0.3)]">
                  Get started free
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </a>
                <a href="/login" className="inline-flex items-center gap-2 rounded-xl border border-[#363650] px-6 py-3.5 font-mono text-sm font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-[#8585aa] hover:text-[#f8f8fc]">
                  Sign in
                </a>
              </div>

              {/* Risk-zero pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: "✓", text: "Free forever" },
                  { icon: "✓", text: "No credit card" },
                  { icon: "✓", text: "Connect in 90 seconds" },
                  { icon: "✓", text: "Disconnect anytime" },
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
              { label: "Integrations at launch", value: <AnimatedCounter target={3} />, color: "#00d4aa" },
              { label: "Founders using Fold", value: <AnimatedCounter target={200} suffix="+" />, color: "#00d4aa" },
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
              description="Link Stripe for revenue, Google Analytics for traffic, and Meta Ads for spend — no code, no CSV exports, no manual dashboards." />
            <Step n={2} title="See your unified dashboard"
              description="All your data normalized into one source of truth. KPI tiles, sparklines, and trends update automatically every day." />
            <Step n={3} title="Let AI do the heavy lifting"
              description="Fold surfaces anomalies, explains trends in plain English, analyzes your website, and gives you a prioritized action list — refreshed daily." />
          </div>

          {/* Platform OAuth trust strip */}
          <div className="mt-12 flex flex-wrap justify-center items-center gap-6 sm:gap-10">
            {[
              { name: "Stripe", color: "#635bff", sub: "Official OAuth — read-only", svg: <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" fill="currentColor" /> },
              { name: "Google", color: "#f59e0b", sub: "Google OAuth 2.0 — GA4 only", svg: <><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></> },
              { name: "Meta", color: "#1877f2", sub: "Meta Business OAuth — read-only", svg: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="currentColor" /> },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#363650] bg-[#1c1c2a]" style={{ color: p.color }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">{p.svg}</svg>
                </div>
                <div>
                  <p className="font-mono text-xs font-semibold text-[#f8f8fc]">{p.name}</p>
                  <p className="font-mono text-[9px] text-[#8585aa]">{p.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <SecurityBadges />
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
                    {["Revenue & MRR from Stripe", "Sessions & conversions from GA4", "Ad spend & CAC from Meta", "Website health score at a glance", "Quick actions & recent activity feed"].map((f) => (
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
                  <p className="text-[#bcbcd8] leading-relaxed mb-4">Full 30-day daily breakdown per platform. Sparklines, trend percentages, and per-integration deep dives — Stripe, GA4, and Meta Ads each get their own view.</p>
                  <ul className="space-y-2">
                    {["30-day daily time-series per integration", "Stripe: MRR, revenue, new customers, refunds", "GA4: sessions, bounce rate, conversions, top pages", "Meta Ads: spend, ROAS, CPC, impressions"].map((f) => (
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
                  <p className="text-[#bcbcd8] leading-relaxed mb-4">Multiple persistent conversations, each with full context of your live Stripe, GA4, and Meta data. Get a fresh daily insight generated automatically — and chat with follow-ups any time.</p>
                  <ul className="space-y-2">
                    {["Daily AI-generated insight from your live data", "Multi-conversation chat — revisit old chats anytime", "Ask anything: \"Why did revenue drop last Tuesday?\"", "AI has full context of your actual metrics", "Rename, organize, and manage chat history"].map((f) => (
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
                title: "One-Click Integrations", color: "#60a5fa",
                description: "Stripe, Google Analytics, and Meta Ads via OAuth. Your data starts flowing instantly — no API keys, no manual setup.",
              },
              {
                icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
                title: "Free & Premium Tiers", color: "#a78bfa",
                description: "Start free with the core dashboard. Upgrade to unlock deep analytics, the AI advisor, and the website optimizer.",
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
            <p className="mx-auto mt-4 max-w-xl text-[#bcbcd8]">Start free. Upgrade when you&apos;re ready for the full picture.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
            <PricingCard
              name="Free"
              price="Free"
              description="Get started with the core dashboard and see what Fold can do."
              features={[
                "Overview dashboard",
                "6 KPI tiles with 7-day trends",
                "Stripe, GA4 & Meta integrations",
                "Activity feed & quick actions",
                "Website health preview",
              ]}
              cta="Get started free"
            />
            <PricingCard
              name="Premium"
              price="$29"
              description="The full picture — deep analytics, AI, and website optimization."
              features={[
                "Everything in Free",
                "Full 30-day analytics per platform",
                "AI Advisor with multi-conversation history",
                "Daily AI-generated insight",
                "Website health score & task list",
                "Anomaly detection & alerts",
                "Priority support",
              ]}
              cta="Start free trial"
              highlight
            />
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24 border-t border-[#363650]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">Early access</p>
            <h2 className="font-mono text-3xl font-bold text-[#f8f8fc]">What early users are saying</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Testimonial
              quote="I used to spend Monday mornings pulling Stripe exports and matching them against GA4 manually. With Fold, I open one tab and it's all there, already explained."
              name="Sarah K."
              role="Founder, SaaS tool"
              avatar="SK"
            />
            <Testimonial
              quote="The AI caught a revenue anomaly I would have missed for days. It told me exactly which campaign was the problem and what to do about it. Paid for itself immediately."
              name="Marcus D."
              role="E-commerce founder"
              avatar="MD"
            />
            <Testimonial
              quote="The website optimizer is genuinely impressive. It found 14 improvements I didn't know existed and ranked them by impact. My score went from 61 to 88 in two weeks."
              name="Priya A."
              role="DTC brand owner"
              avatar="PA"
            />
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
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
          <p className="mt-6 text-center font-mono text-xs text-[#8585aa]">
            Still have questions?{" "}
            <a href="mailto:support@usefold.io" className="text-[#00d4aa] hover:underline">Email us →</a>
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
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa]">Free to start — no credit card needed</span>
          </div>
          <h2 className="mb-4 font-mono text-4xl font-bold text-[#f8f8fc] sm:text-5xl leading-tight">
            Stop guessing.
            <br />
            <span className="text-[#00d4aa]">Start knowing.</span>
          </h2>
          <p className="mb-10 text-lg text-[#bcbcd8] max-w-lg mx-auto">
            Connect your tools in minutes. Get a unified dashboard, AI-generated daily insights, and a website optimizer — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0] hover:shadow-[0_0_40px_rgba(0,212,170,0.35)]">
              Get started free
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </a>
            <a href="/login" className="font-mono text-sm text-[#8585aa] uppercase tracking-widest hover:text-[#f8f8fc] transition-colors">
              Already have an account? Sign in →
            </a>
          </div>
          <p className="mt-6 font-mono text-[10px] text-[#8585aa]">No credit card required. Free plan available forever.</p>
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
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] mb-4">Product</p>
              <ul className="space-y-3">
                {[{ l: "Features", h: "#features" }, { l: "How it works", h: "#how-it-works" }, { l: "Pricing", h: "#pricing" }, { l: "FAQ", h: "#faq" }, { l: "Sign in", h: "/login" }, { l: "Get started free", h: "/register" }].map((item) => (
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
