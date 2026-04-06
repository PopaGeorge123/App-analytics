"use client";

/**
 * PageClientIslands.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * All interactive client components used by the marketing landing page
 * (app/page.tsx). Keeping them here lets page.tsx be a pure Server Component,
 * which means the full HTML is SSR'd by Next.js — essential for SEO.
 *
 * Exported:  Nav, AnimatedCounter, DashboardMockup, FaqSection
 */

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Animated number counter
// ─────────────────────────────────────────────────────────────────────────────
export function AnimatedCounter({
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
// Dashboard mockup — tabbed hero demo
// ─────────────────────────────────────────────────────────────────────────────

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
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/8 px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-widest text-[#00d4aa]">
          <span className="h-1 w-1 rounded-full bg-[#00d4aa]" />
          Free plan
        </span>
        <span className="font-mono text-[8px] text-[#8585aa] uppercase tracking-widest">7-day view</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-[#363650] bg-[#222235] p-2.5">
            <p className="font-mono text-[8px] uppercase tracking-widest text-[#8585aa] mb-1">{k.label}</p>
            <p className="font-mono text-sm font-bold text-[#f8f8fc]">{k.value}</p>
            <p className={`font-mono text-[9px] ${k.up ? "text-[#00d4aa]" : "text-red-400"}`}>{k.change}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#363650] bg-[#222235] p-3">
        <p className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#8585aa]">Revenue — last 7 days</p>
        <div className="flex items-end gap-1 h-10">
          {[45, 62, 55, 78, 70, 88, 95].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? "#00d4aa" : `rgba(0,212,170,${0.12 + i * 0.09})` }} />
          ))}
        </div>
      </div>
      <div className="relative rounded-xl border border-[#a78bfa]/15 bg-[#a78bfa]/5 px-3 py-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-[#a78bfa]">
              <path d="M12 1a5 5 0 00-5 5v3H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V11a2 2 0 00-2-2h-2V6a5 5 0 00-5-5zm3 8H9V6a3 3 0 116 0v3z"/>
            </svg>
            <span className="font-mono text-[8px] uppercase tracking-widest text-[#6a6a9a]">Analytics · Website · AI Advisor</span>
          </div>
          <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#a78bfa]">Premium</span>
        </div>
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

export function DashboardMockup() {
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
        <div className="relative p-4">
          {activeTab === "overview" && <OverviewMockup />}
          {activeTab === "analytics" && <AnalyticsMockup />}
          {activeTab === "website"   && <WebsiteMockup />}
          {activeTab === "ai"        && <AiMockup />}
          {activePremium && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-b-2xl backdrop-blur-sm bg-[#1c1c2a]/80">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/10 mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#a78bfa]">
                  <path d="M12 1a5 5 0 00-5 5v3H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V11a2 2 0 00-2-2h-2V6a5 5 0 00-5-5zm3 8H9V6a3 3 0 116 0v3z"/>
                </svg>
              </div>
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#f8f8fc] mb-1">Premium feature</p>
              <p className="font-mono text-[10px] text-[#8585aa] mb-4 text-center px-6">Upgrade to unlock Analytics, Website Optimizer &amp; AI Advisor.</p>
              <a href="/signup" className="rounded-xl bg-[#a78bfa] px-5 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#9674f5]">
                Upgrade to Premium
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ section (accordion items need client state)
// ─────────────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "Is my financial data safe?", a: "Yes. Fold connects via official OAuth — we never see or store your Stripe secret key, Google password, Meta credentials, or any other platform password. All data is transmitted over TLS 1.3 and stored encrypted at rest. We use read-only access; we cannot move money or modify your accounts." },
  { q: "What integrations do you support?", a: "Fold has 11 live integrations today: Stripe, Google Analytics 4, Meta Ads, Lemon Squeezy, Gumroad, Paddle, Plausible, Mailchimp, Klaviyo, Beehiiv, Shopify, and WooCommerce. More are being added continuously." },
  { q: "How is Fold different from Stripe Dashboard or GA4?", a: "Stripe Dashboard shows Stripe data. GA4 shows website data. Meta Ads Manager shows ad data. Shopify shows store data. None of them talk to each other. Fold connects all your tools, normalises them into one unified timeline, calculates cross-platform metrics like ROAS and CAC, and adds AI that explains what it all means in plain English." },
  { q: "Do I need to know how to code?", a: "No. Setup is a few OAuth clicks — one for each integration. There are no API keys, no webhooks to configure, and no developer required. If you can log in to Stripe or Shopify, you can set up Fold." },
  { q: "Is there a free plan?", a: "There's no ongoing free tier — the full dashboard requires Premium. However, you can create a free account to explore the app, and start your 3-day free trial at any time from within the dashboard. The trial gives you complete access to every feature. A card is required to start; you won't be charged until day 4." },
  { q: "How much does Premium cost?", a: "Premium is $29/month with no annual lock-in — cancel any time. New accounts get a 3-day free trial with full access to all premium features. A credit card is required to start the trial; you won't be charged until day 4. Cancel before then and you'll never pay a cent." },
  { q: "Can I cancel my subscription at any time?", a: "Yes. Cancel with one click from your account settings. You keep access until the end of your billing period. No questions, no retention loops." },
  { q: "How often does my data update?", a: "Fold syncs your connected integrations automatically every day. The overview dashboard reflects yesterday's numbers by default. You can also trigger a manual sync at any time from the settings page." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#363650] last:border-0">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 py-5 text-left">
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
      {open && <p className="pb-5 text-sm leading-relaxed text-[#bcbcd8]">{a}</p>}
    </div>
  );
}

export function FaqSection() {
  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 px-6 divide-y-0">
      {FAQ_ITEMS.map((item) => (
        <FaqItem key={item.q} q={item.q} a={item.a} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav — scroll-aware + mobile hamburger
// ─────────────────────────────────────────────────────────────────────────────
export function Nav() {
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
          <a href="/login" className="hidden md:block font-mono text-xs uppercase tracking-widest text-[#8585aa] transition-colors hover:text-[#f8f8fc] px-3 py-2">Sign in</a>
          <a href="/signup" className="rounded-xl bg-[#00d4aa] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0]">Get started free</a>
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
