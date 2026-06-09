"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Integration } from "@/lib/integrations/catalog";
import OnboardingFlow from "./OnboardingFlow";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WizardProps {
  liveIntegrations: Integration[];
  userEmail: string;
  oauthError?: string | null;
  initialStep?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step progress bar
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Your website" },
  { n: 2, label: "Business profile" },
  { n: 3, label: "Connect data" },
];

function StepBar({ current, onGoTo }: { current: number; onGoTo: (n: 1 | 2 | 3) => void }) {
  return (
    <div className="flex items-center gap-0 w-full max-w-sm">
      {STEPS.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        const clickable = done; // can only go back to completed steps
        return (
          <React.Fragment key={s.n}>
            <div
              className="flex flex-col items-center gap-1"
              onClick={() => clickable && onGoTo(s.n as 1 | 2 | 3)}
              style={{ cursor: clickable ? "pointer" : "default" }}
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-all"
                style={{
                  backgroundColor: done ? "#00d4aa" : active ? "#00d4aa18" : "#3a3a5e",
                  border: active ? "1px solid #00d4aa" : done ? "none" : "1px solid #505070",
                  color: done ? "#f8f8fc" : active ? "#00d4aa" : "#7070a0",
                }}
              >
                {done ? (
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : s.n}
              </div>
              <span
                className="font-mono text-[9px] whitespace-nowrap"
                style={{ color: active ? "#00d4aa" : done ? "#5aaa90" : "#7070a0" }}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-4 transition-all"
                style={{ backgroundColor: current > s.n ? "#00d4aa40" : "#3a3a58" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Website + AI description
// ─────────────────────────────────────────────────────────────────────────────

interface Step1Data {
  websiteUrl: string;
  businessName: string;
  description: string;
  industry: string;
}

function Step1({
  onNext,
  initialData,
}: {
  onNext: (data: Step1Data) => void;
  initialData?: { websiteUrl: string; description: string; industry: string };
}) {
  const [url, setUrl] = useState(initialData?.websiteUrl ?? "");
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [industry, setIndustry] = useState(initialData?.industry ?? "");
  const [saving, setSaving] = useState(false);

  // When navigating back, pre-show the saved description box without re-extracting
  useEffect(() => {
    if (initialData?.description) setExtracted(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExtract() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setExtracting(true);
    setExtractError("");
    setExtracted(false);
    try {
      const res = await fetch("/api/onboarding/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExtractError(data.error ?? "Could not extract info.");
      } else {
        setBusinessName(data.businessName ?? "");
        setDescription(data.description ?? "");
        setIndustry(data.industry ?? "");
        setExtracted(true);
      }
    } catch {
      setExtractError("Network error — please try again.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleNext() {
    setSaving(true);
    await fetch("/api/onboarding/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteUrl: url.trim(),
        businessDescription: description.trim(),
        businessIndustry: industry,
        onboardingStep: 2,
      }),
    });
    setSaving(false);
    onNext({ websiteUrl: url.trim(), businessName, description, industry });
  }

  async function handleSkip() {
    await fetch("/api/onboarding/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingStep: 2 }),
    });
    onNext({ websiteUrl: "", businessName: "", description: "", industry: "" });
  }

  const canContinue = description.trim().length > 0 || extracted;

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      {/* ── Left panel — decorative / context ──────────────────────────── */}
      <aside className="hidden lg:flex w-105 shrink-0 flex-col justify-between border-r border-[#c8c8ec] bg-[#f2f2fc] px-10 py-14">
        <div>
          <div className="mb-10 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/8">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
              <path d="M3.6 9h16.8M3.6 15h16.8M12 3c-2.4 4-3 8-3 9s.6 5 3 9M12 3c2.4 4 3 8 3 9s-.6 5-3 9" />
            </svg>
          </div>
          <h1 className="mb-3 text-2xl font-semibold tracking-tight text-[#464646]">
            Start with your Store
          </h1>
          <p className="text-[15px] leading-relaxed text-[#8888b0]">
            Paste your URL and our AI will read your site in seconds extracting your store name, what you sell, and your niche.
          </p>

          <div className="mt-10 space-y-5">
            {[
              { icon: "✦", title: "Smarter AI insights", body: "Your description is used by the AI advisor to give context-aware recommendations." },
              { icon: "✦", title: "Personalised benchmarks", body: "Industry and size help us surface the metrics that matter most to businesses like yours." },
              { icon: "✦", title: "Fully private", body: "This data never leaves your account. It's never sold, shared, or used for advertising." },
            ].map((item) => (
              <div key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 shrink-0 font-mono text-[11px] text-[#00d4aa]/60">{item.icon}</span>
                <div>
                  <p className="mb-0.5 text-[13px] font-medium text-[#3a3a5a]">{item.title}</p>
                  <p className="text-[12px] leading-relaxed text-[#7878a8]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="font-mono text-[10px] text-[#5858a0]">Step 1 of 3</p>
      </aside>

      {/* ── Right panel — form ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-start px-5 py-12 sm:px-8 overflow-y-auto">
        <div className="w-full max-w-lg">

          {/* Mobile-only heading */}
          <div className="mb-8 lg:hidden">
            <h2 className="text-xl font-semibold text-[#4a4a4a]">Start with your website</h2>
            <p className="mt-1 text-sm text-[#8888b0]">We'll scan it and generate a description of your business.</p>
          </div>

          {/* URL card */}
          <div className="rounded-2xl border border-[#d0d0ec] bg-[#f4f4fc] p-6">
            <label className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-[#7878a8]">
              Store URL
            </label>
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#5a5a80" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setExtracted(false); setExtractError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && !extracting && handleExtract()}
                  placeholder="https://yourwebsite.com"
                  className="w-full rounded-xl border border-[#c8c8ec] bg-[#f2f2fc] pl-10 pr-4 py-3 text-sm text-[#6d6d6d] placeholder-[#9d9d9d] outline-none transition focus:border-[#00d4aa]/40 focus:ring-2 focus:ring-[#00d4aa]/10"
                />
              </div>
              <button
                onClick={handleExtract}
                disabled={!url.trim() || extracting}
                className="shrink-0 flex items-center gap-2 rounded-xl border border-[#00d4aa]/25 bg-[#00d4aa]/10 px-4 py-3 text-[12px] font-semibold text-[#00d4aa] transition hover:bg-[#00d4aa]/16 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {extracting ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="animate-spin">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <span>Scanning…</span>
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <span>Analyse</span>
                  </>
                )}
              </button>
            </div>

            {extractError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3.5 py-2.5">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2} className="shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-[12px] text-red-400">{extractError}</p>
              </div>
            )}

            {/* Scanning skeleton */}
            {extracting && (
              <div className="mt-4 space-y-2.5">
                {[80, 60, 90].map((w, i) => (
                  <div key={i} className="h-3 rounded-full bg-[#e8e8f5] animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
          </div>

          {/* Extracted results card */}
          {(extracted || description) && !extracting && (
            <div className="mt-4 rounded-2xl border border-[#00d4aa]/15 bg-[#f0f8f4] p-6 space-y-5">
              {/* Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00d4aa]/15">
                    <svg width="10" height="10" fill="#00d4aa" viewBox="0 0 24 24">
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold text-[#00d4aa]">AI extracted · edit freely</span>
                </div>
                <button
                  onClick={() => { setExtracted(false); setDescription(""); setBusinessName(""); setIndustry(""); }}
                  className="text-[11px] text-[#5aafa8] hover:text-[#7acfc8] transition"
                >
                  Clear
                </button>
              </div>

              {businessName && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#5aafa8]">Business name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-xl border border-[#4e4e4e] bg-[#f0f8f6] px-4 py-2.5 text-sm text-[#4c4c4c] placeholder-[#4a7a74] outline-none transition focus:border-[#00d4aa]/35 focus:ring-2 focus:ring-[#00d4aa]/8"
                  />
                </div>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[13px] font-medium text-[#5aafa8]">Business description</label>
                  <span className="text-[10px] text-[#4a9090]">{description.length} chars</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-[#4e4e4e] bg-[#f0f8f6] px-4 py-3 text-sm text-[#4c4c4c] placeholder-[#4a7a74] outline-none transition focus:border-[#00d4aa]/35 focus:ring-2 focus:ring-[#00d4aa]/8 leading-relaxed"
                  placeholder="Describe what your business does, who your customers are, and what problem you solve…"
                />
                {/* <p className="mt-1.5 text-[11px] text-[#4a9090]">
                  Used privately by the AI advisor. Never shared or sold.
                </p> */}
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-medium text-[#5aafa8]">Niche</label>
                <div className="flex flex-wrap gap-1.5">
                  {["Health and Wellness", "Beauty and Cosmetics", "Pet Supplies", "Home and Kitchen", "Apparel and Fashion Accessories", " Gadgets and Technology Accessories", "Gaming and Electronics", "Hobbies and Crafts", " Baby and Maternity Products", "Other"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setIndustry(opt)}
                      className="rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all"
                      style={{
                        backgroundColor: industry === opt ? "#00d4aa15" : "#f0f8f4",
                        borderColor:     industry === opt ? "#00d4aa35" : "#eaf8f8",
                        color:           industry === opt ? "#00d4aa" : "#5aafa8",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Manual entry prompt — only shown when URL is empty and no extraction */}
          {!extracted && !description && !extracting && (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-[#e8e8f5]" />
              <button
                onClick={() => { setExtracted(true); }}
                className="shrink-0 text-[11px] text-[#5858a0] transition hover:text-[#8888b0]"
              >
                Skip scan — enter description manually
              </button>
              <div className="h-px flex-1 bg-[#e8e8f5]" />
            </div>
          )}

          {/* Action row */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleNext}
              disabled={!canContinue || saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00d4aa] px-6 py-3.5 text-[13px] font-semibold text-[#f4faf8] transition hover:bg-[#00c49d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {saving ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="animate-spin">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  Continue
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
            <button
              onClick={handleSkip}
              className="rounded-xl border border-[#d0d0ec] px-4 py-3.5 text-[12px] text-[#6070a0] transition hover:border-[#e8e8f4] hover:text-[#a0a0c8]"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Business profile
// ─────────────────────────────────────────────────────────────────────────────

interface Step2Data {
  industry: string;
  employeeCount: string;
  monthlyRevenue: string;
  referralSource: string;
}

const EMPLOYEE_OPTIONS = [
  { value: "just-me", label: "Just me" },
  { value: "2-5", label: "2–5" },
  { value: "6-20", label: "6–20" },
  { value: "21-100", label: "21–100" },
  { value: "100+", label: "100+" },
];

const REVENUE_OPTIONS = [
  { value: "pre-revenue", label: "Pre-revenue" },
  { value: "<1k", label: "< $1k / mo" },
  { value: "1k-10k", label: "$1k – $10k / mo" },
  { value: "10k-50k", label: "$10k – $50k / mo" },
  { value: "50k-200k", label: "$50k – $200k / mo" },
  { value: "200k+", label: "$200k+ / mo" },
];

const REFERRAL_OPTIONS = [
  { value: "twitter-x", label: "Twitter / X" },
  { value: "product-hunt", label: "Product Hunt" },
  { value: "google", label: "Google search" },
  { value: "friend", label: "Friend or colleague" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "newsletter", label: "Newsletter" },
  { value: "reddit", label: "Reddit" },
  { value: "other", label: "Other" },
];

const INDUSTRY_OPTIONS = [
  "Health and Wellness",
  "Beauty and Cosmetics",
  "Pet Supplies",
  "Home and Kitchen",
  "Apparel and Fashion Accessories",
  "Gadgets and Technology Accessories",
  "Gaming and Electronics",
  "Hobbies and Crafts",
  "Baby and Maternity Products",
  "Other",
];

function Step2({
  prefillIndustry,
  onNext,
  onBack,
  initialData,
}: {
  prefillIndustry?: string;
  onNext: (data: Step2Data) => void;
  onBack: () => void;
  initialData?: { industry: string; employeeCount: string; monthlyRevenue: string; referralSource: string };
}) {
  const [industry, setIndustry] = useState(initialData?.industry || prefillIndustry || "");
  const [employeeCount, setEmployeeCount] = useState(initialData?.employeeCount ?? "");
  const [monthlyRevenue, setMonthlyRevenue] = useState(initialData?.monthlyRevenue ?? "");
  const [referralSource, setReferralSource] = useState(initialData?.referralSource ?? "");
  const [saving, setSaving] = useState(false);

  const canContinue = industry && employeeCount && monthlyRevenue;

  async function handleNext() {
    setSaving(true);
    await fetch("/api/onboarding/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessIndustry: industry,
        employeeCount,
        monthlyRevenue,
        referralSource,
        onboardingStep: 3,
      }),
    });
    setSaving(false);
    onNext({ industry, employeeCount, monthlyRevenue, referralSource });
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-105 shrink-0 flex-col justify-between border-r border-[#c8c8ec] bg-[#f2f2fc] px-10 py-14">
        <div>
          <div className="mb-10 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/8">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#818cf8" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <h1 className="mb-3 text-2xl font-semibold tracking-tight text-[#f0f0fa]">
            Your business profile
          </h1>
          <p className="text-[15px] leading-relaxed text-[#8888b0]">
            A few quick answers help us show the right metrics, benchmarks, and AI recommendations for your stage and industry.
          </p>

          <div className="mt-10 space-y-5">
            {[
              { icon: "✦", title: "Relevant benchmarks", body: "We compare your numbers against businesses of similar size and industry." },
              { icon: "✦", title: "Tailored AI advice", body: "Revenue stage lets the AI give recommendations that are actually actionable for you." },
              { icon: "✦", title: "Completely private", body: "This data stays in your account. It's never sold or used outside of Fold." },
            ].map((item) => (
              <div key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 shrink-0 text-[11px] text-[#6366f1]/50">✦</span>
                <div>
                  <p className="mb-0.5 text-[13px] font-medium text-[#3a3a5a]">{item.title}</p>
                  <p className="text-[12px] leading-relaxed text-[#7878a8]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="font-mono text-[10px] text-[#5858a0]">Step 2 of 3</p>
      </aside>

      {/* ── Right panel — form ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-start overflow-y-auto px-5 py-12 sm:px-8">
        <div className="w-full max-w-lg">

          {/* Mobile-only heading */}
          <div className="mb-8 lg:hidden">
            <h2 className="text-xl font-semibold text-[#f0f0fa]">Your business profile</h2>
            <p className="mt-1 text-sm text-[#8888b0]">Helps us tailor benchmarks and AI recommendations.</p>
          </div>

          <div className="space-y-5">
            {/* Industry */}
            <div className="rounded-2xl border border-[#d0d0ec] bg-[#f4f4fc] p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-[#7878a8]">
                  Industry <span className="text-[#ef4444] normal-case tracking-normal font-normal">required</span>
                </label>
                {industry && <span className="rounded-md bg-[#6366f1]/10 px-2 py-0.5 text-[11px] text-[#818cf8]">{industry}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {INDUSTRY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIndustry(opt)}
                    className="rounded-xl border px-3.5 py-2 text-[12px] font-medium transition-all active:scale-[0.97]"
                    style={{
                      backgroundColor: industry === opt ? "#6366f115" : "#f2f2fc",
                      borderColor:     industry === opt ? "#6366f140" : "#e8e8f5",
                      color:           industry === opt ? "#818cf8" : "#8888b0",
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Team size */}
            <div className="rounded-2xl border border-[#d0d0ec] bg-[#f4f4fc] p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-[#7878a8]">
                  Team size <span className="text-[#ef4444] normal-case tracking-normal font-normal">required</span>
                </label>
                {employeeCount && (
                  <span className="rounded-md bg-[#6366f1]/10 px-2 py-0.5 text-[11px] text-[#818cf8]">
                    {EMPLOYEE_OPTIONS.find(o => o.value === employeeCount)?.label}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {EMPLOYEE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEmployeeCount(opt.value)}
                    className="rounded-xl border px-4 py-2.5 text-[12px] font-medium transition-all active:scale-[0.97]"
                    style={{
                      backgroundColor: employeeCount === opt.value ? "#6366f115" : "#f2f2fc",
                      borderColor:     employeeCount === opt.value ? "#6366f140" : "#e8e8f5",
                      color:           employeeCount === opt.value ? "#818cf8" : "#8888b0",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly revenue */}
            <div className="rounded-2xl border border-[#d0d0ec] bg-[#f4f4fc] p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-[#7878a8]">
                  Monthly revenue <span className="text-[#ef4444] normal-case tracking-normal font-normal">required</span>
                </label>
                {monthlyRevenue && (
                  <span className="rounded-md bg-[#6366f1]/10 px-2 py-0.5 text-[11px] text-[#818cf8]">
                    {REVENUE_OPTIONS.find(o => o.value === monthlyRevenue)?.label}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {REVENUE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMonthlyRevenue(opt.value)}
                    className="rounded-xl border px-3.5 py-2 text-[12px] font-medium transition-all active:scale-[0.97]"
                    style={{
                      backgroundColor: monthlyRevenue === opt.value ? "#6366f115" : "#f2f2fc",
                      borderColor:     monthlyRevenue === opt.value ? "#6366f140" : "#e8e8f5",
                      color:           monthlyRevenue === opt.value ? "#818cf8" : "#8888b0",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Referral source */}
            {/* <div className="rounded-2xl border border-[#d0d0ec] bg-[#f4f4fc] p-5">
              <div className="mb-3 flex items-center gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-[#7878a8]">How did you hear about Fold?</label>
                <span className="text-[10px] text-[#5858a0]">optional</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {REFERRAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReferralSource(referralSource === opt.value ? "" : opt.value)}
                    className="rounded-xl border px-3.5 py-2 text-[12px] font-medium transition-all active:scale-[0.97]"
                    style={{
                      backgroundColor: referralSource === opt.value ? "#6366f115" : "#f2f2fc",
                      borderColor:     referralSource === opt.value ? "#6366f140" : "#e8e8f5",
                      color:           referralSource === opt.value ? "#818cf8" : "#8888b0",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div> */}
          </div>

          {/* Action row */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-xl border border-[#d0d0ec] px-4 py-3.5 text-[12px] text-[#6070a0] transition hover:border-[#c0c0e8] hover:text-[#a0a0c8]"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!canContinue || saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-6 py-3.5 text-[13px] font-semibold text-[#1a1a2e] transition hover:bg-[#5558e8] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {saving ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="animate-spin">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  Continue to connect your data
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
          {/* <p className="mt-3 text-center text-[11px] text-[#7070a0]">
            This data is private — never shared or used for ads
          </p> */}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved profile shape
// ─────────────────────────────────────────────────────────────────────────────

interface SavedProfile {
  websiteUrl: string;
  businessDescription: string;
  businessIndustry: string;
  employeeCount: string;
  monthlyRevenue: string;
  referralSource: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingWizard({
  liveIntegrations,
  userEmail,
  oauthError,
  initialStep = 1,
}: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(
    oauthError ? 3 : (Math.min(Math.max(initialStep, 1), 3) as 1 | 2 | 3)
  );

  // Persisted profile data fetched once on mount
  const [profile, setProfile] = useState<SavedProfile>({
    websiteUrl: "",
    businessDescription: "",
    businessIndustry: "",
    employeeCount: "",
    monthlyRevenue: "",
    referralSource: "",
  });

  useEffect(() => {
    fetch("/api/onboarding/profile")
      .then((r) => r.json())
      .then((data: SavedProfile & { onboardingStep?: number }) => {
        setProfile({
          websiteUrl:          data.websiteUrl          ?? "",
          businessDescription: data.businessDescription ?? "",
          businessIndustry:    data.businessIndustry    ?? "",
          employeeCount:       data.employeeCount       ?? "",
          monthlyRevenue:      data.monthlyRevenue      ?? "",
          referralSource:      data.referralSource      ?? "",
        });
      })
      .catch(() => {/* silently ignore — profile will just be empty */});
  }, []);

  // Fire Meta Pixel "Started free trial" Lead event exactly once per user.
  // localStorage key ensures it never fires again even if the user refreshes
  // or navigates back to this page.
  useEffect(() => {
    const PIXEL_KEY = "fold_trial_pixel_fired";
    try {
      if (localStorage.getItem(PIXEL_KEY)) return;
      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
      if (typeof fbq !== "function") return;
      fbq("track", "Lead", { content_name: "Started free trial" });
      localStorage.setItem(PIXEL_KEY, "1");
    } catch {
      // localStorage or fbq unavailable — skip silently
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStep1Next(data: Step1Data) {
    // Keep local profile in sync so Step 2 gets latest industry from extraction
    setProfile((p) => ({
      ...p,
      websiteUrl:          data.websiteUrl,
      businessDescription: data.description,
      businessIndustry:    data.industry || p.businessIndustry,
    }));
    setStep(2);
  }

  function handleStep2Next(data: Step2Data) {
    setProfile((p) => ({
      ...p,
      businessIndustry: data.industry,
      employeeCount:    data.employeeCount,
      monthlyRevenue:   data.monthlyRevenue,
      referralSource:   data.referralSource,
    }));
    setStep(3);
  }

  function skipToDashboard() {
    document.cookie = "onboarding_skipped=1; path=/; max-age=86400; SameSite=Lax";
    try {
      const payload = JSON.stringify({ event: 'onboarding_skip', ts: Date.now() });
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        navigator.sendBeacon('/api/beacon', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/beacon', { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(()=>{});
      }
    } catch (e) {
      // ignore
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#f4f4fc] text-[#1a1a2e]">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="border-b border-[#3a3a58] bg-[#f2f2f8]/90 backdrop-blur-sm px-6 py-3.5 sticky top-0 z-30">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <a href="/">
            <img src="/fold-mono-teal.svg" alt="Fold" className="h-7 w-auto" />
          </a>
          <StepBar current={step} onGoTo={(n) => setStep(n)} />
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] text-[#6070a0] sm:block truncate max-w-40">
              {userEmail}
            </span>
            <button
              onClick={skipToDashboard}
              className="font-mono text-[10px] text-[#505070] hover:text-[#4a4a6a] transition underline-offset-2 hover:underline"
            >
              Skip
            </button>
          </div>
        </div>
      </header>

      {/* ── Steps ─────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <Step1
          onNext={handleStep1Next}
          initialData={{
            websiteUrl:  profile.websiteUrl,
            description: profile.businessDescription,
            industry:    profile.businessIndustry,
          }}
        />
      )}

      {step === 2 && (
        <Step2
          prefillIndustry={profile.businessIndustry}
          onNext={handleStep2Next}
          onBack={() => setStep(1)}
          initialData={{
            industry:      profile.businessIndustry,
            employeeCount: profile.employeeCount,
            monthlyRevenue: profile.monthlyRevenue,
            referralSource: profile.referralSource,
          }}
        />
      )}

      {step === 3 && (
        <OnboardingFlow
          liveIntegrations={liveIntegrations}
          userEmail={userEmail}
          oauthError={oauthError}
          hideHeader
        />
      )}
    </div>
  );
}
