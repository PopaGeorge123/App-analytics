import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/app/_components/PageClientIslands";
import { PLATFORM_DETAILS } from "@/lib/integrations/platform-details";
import { INTEGRATIONS_CATALOG } from "@/lib/integrations/catalog";
import type { ReactNode } from "react";

export function generateStaticParams() {
  return Object.keys(PLATFORM_DETAILS).map((id) => ({ platform: id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>;
}): Promise<Metadata> {
  const { platform } = await params;
  const detail = PLATFORM_DETAILS[platform];
  if (!detail) return {};
  return {
    title: `${detail.name} Integration — How Fold uses your data | Fold Analytics`,
    description: `Exactly what data Fold reads from ${detail.name}, what we store, what we never touch, and how to revoke access at any time.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Design system components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-mono text-xl font-bold text-[#f8f8fc] mb-1">{children}</h2>;
}

function SectionLabel({ children, color = "#00d4aa" }: { children: ReactNode; color?: string }) {
  return (
    <p className="font-mono text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color }}>
      {children}
    </p>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-[#e0e0f0]">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Cross({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-[#e0e0f0]">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#f87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-6 ${className}`}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-10 border-t border-[#363650]" />;
}

function MethodBadge({ method }: { method: string }) {
  if (method === "oauth2") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#00d4aa]">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        OAuth 2.0 — no password shared
      </span>
    );
  }
  if (method === "api-key") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#a78bfa]">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
        API Key — stored encrypted
      </span>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function PlatformDetailPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const detail = PLATFORM_DETAILS[platform];
  if (!detail) notFound();

  const catalog = INTEGRATIONS_CATALOG.find((i) => i.id === platform);
  const liveIntegrations = INTEGRATIONS_CATALOG.filter((i) => i.status === "live" && i.id !== platform);

  return (
    <div className="min-h-screen bg-[#13131f] text-[#f8f8fc]">
      <Nav />

      {/* ── BREADCRUMB ───────────────────────────────────────────────────── */}
      <div className="border-b border-[#363650] bg-[#1c1c2a]/40 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center gap-2 font-mono text-[11px] text-[#8585aa]">
          <Link href="/learn" className="hover:text-[#00d4aa] transition-colors">How Fold works</Link>
          <span>/</span>
          <Link href="/learn#integrations" className="hover:text-[#00d4aa] transition-colors">Integrations</Link>
          <span>/</span>
          <span className="text-[#f8f8fc]">{detail.name}</span>
        </div>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-12 px-6">
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-100 w-175 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: detail.color }}
        />
        <div className="relative mx-auto max-w-4xl">
          {/* Logo + title */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border overflow-hidden"
              style={{ backgroundColor: `${detail.color}18`, borderColor: `${detail.color}35` }}
            >
              <img src={detail.icon} alt={detail.name} width={36} height={36} className="object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="font-mono text-[10px] font-semibold uppercase tracking-widest rounded-full px-2.5 py-0.5"
                  style={{ color: detail.color, backgroundColor: `${detail.color}15`, border: `1px solid ${detail.color}30` }}
                >
                  {detail.category}
                </span>
                {catalog?.status === "live" && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-widest rounded-full px-2.5 py-0.5 text-[#00d4aa] bg-[#00d4aa]/10 border border-[#00d4aa]/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa]" />
                    Live integration
                  </span>
                )}
              </div>
              <h1 className="font-mono text-3xl sm:text-4xl font-bold text-[#f8f8fc]">{detail.name}</h1>
              <p className="mt-1.5 text-[#bcbcd8] leading-relaxed">{detail.tagline}</p>
            </div>
          </div>

          {/* Auth method + read-only badges */}
          <div className="flex flex-wrap gap-3 mb-8">
            <MethodBadge method={detail.connectMethod} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#363650] bg-[#222235] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8585aa]">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              Read-only — we never write to your account
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#363650] bg-[#222235] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8585aa]">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              GDPR compliant
            </span>
          </div>

          {/* Hard guarantees — 3-col */}
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                icon: (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                ),
                label: "Your password is never shared",
              },
              {
                icon: (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                ),
                label: "We never sell your data",
              },
              {
                icon: (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <polyline points="3 6 5 6 21 6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
                  </svg>
                ),
                label: "Disconnect = data deleted instantly",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-[#363650] bg-[#1c1c2a]/60 px-4 py-3">
                <span className="text-[#00d4aa] shrink-0">{item.icon}</span>
                <span className="font-mono text-[11px] text-[#bcbcd8]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-6 pb-24 space-y-10">

        {/* ── WHY FOUNDERS CONNECT ─────────────────────────────────────── */}
        <div
          className="rounded-2xl border-l-4 pl-6 pr-6 py-5"
          style={{ borderColor: detail.color, backgroundColor: `${detail.color}06` }}
        >
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: detail.color }}>
            Why founders connect {detail.name}
          </p>
          <p className="text-[#e0e0f0] leading-relaxed text-[15px]">{detail.whyFoundersConnect}</p>
        </div>

        {/* ── DATA PIPELINE VISUAL ─────────────────────────────────────── */}
        <Card>
          <SectionLabel color="#60a5fa">How your data flows</SectionLabel>
          <SectionHeading>From {detail.name} to your Fold dashboard</SectionHeading>
          <p className="text-sm text-[#bcbcd8] mt-2 mb-8 leading-relaxed">
            This is the exact sequence every time Fold runs its daily sync. Nothing runs outside this pipeline.
          </p>

          {/* Pipeline nodes */}
          <div className="relative">
            {/* Vertical connector line (desktop) */}
            <div className="hidden sm:block absolute left-6.75 top-10 bottom-10 w-px bg-linear-to-b from-[#363650] via-[#2a2a40] to-[#363650]" />

            <div className="space-y-3">
              {[
                {
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  ),
                  color: detail.color,
                  title: `${detail.name} API`,
                  subtitle: detail.connectMethod === "oauth2" ? "OAuth 2.0 token" : "Encrypted API key",
                  desc: detail.connectMethod === "oauth2"
                    ? `You authorise Fold once via ${detail.name}'s own OAuth page. Fold receives a scoped, time-limited token — your login credentials are never seen or stored.`
                    : `Your API key is stored encrypted (AES-256) in our database. It is sent only to ${detail.name}'s API over TLS 1.3 and never logged.`,
                },
                {
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  ),
                  color: "#60a5fa",
                  title: "Read-only API requests",
                  subtitle: `${detail.apiEndpoints.length} HTTP GET call${detail.apiEndpoints.length !== 1 ? "s" : ""} per sync`,
                  desc: `Fold makes ${detail.apiEndpoints.length} read-only request${detail.apiEndpoints.length !== 1 ? "s" : ""} to ${detail.name}'s API — the exact endpoints are documented in the section below. No write requests are ever made.`,
                },
                {
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                    </svg>
                  ),
                  color: "#a78bfa",
                  title: "Filter & aggregate",
                  subtitle: "Personal data stripped before storage",
                  desc: "The raw API response is processed in memory. Only aggregate numbers (totals, counts, rates) are extracted. Any field containing personal information — names, emails, IDs — is discarded and never written to disk.",
                },
                {
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <ellipse cx="12" cy="5" rx="9" ry="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                    </svg>
                  ),
                  color: "#00d4aa",
                  title: "Stored in your account",
                  subtitle: "AES-256 at rest · row-level isolation",
                  desc: "The filtered snapshot is written to your isolated tenant in our database, encrypted at rest. Row-level security ensures no other Fold user can read your data — not even via a misconfigured query.",
                },
                {
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <rect x="2" y="3" width="20" height="14" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4" />
                    </svg>
                  ),
                  color: "#f59e0b",
                  title: "Shown in your dashboard",
                  subtitle: "Overview · Analytics · AI Digest",
                  desc: "The stored aggregate numbers surface across your Fold dashboard — the Overview tile, Analytics tab charts, and the AI-generated daily digest. No raw data from the API is ever returned to the frontend.",
                },
              ].map((node, i, arr) => (
                <div key={node.title} className="flex gap-4">
                  {/* Icon column */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className="relative z-10 flex h-13.5 w-13.5 shrink-0 items-center justify-center rounded-2xl border"
                      style={{
                        backgroundColor: `${node.color}12`,
                        borderColor: `${node.color}30`,
                        color: node.color,
                      }}
                    >
                      {node.icon}
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex-1 flex flex-col items-center py-1 gap-1">
                        <span className="h-1 w-1 rounded-full bg-[#363650]" />
                        <span className="h-1 w-1 rounded-full bg-[#363650]" />
                        <span className="h-1 w-1 rounded-full bg-[#363650]" />
                      </div>
                    )}
                  </div>

                  {/* Text column */}
                  <div className={`flex-1 pb-4 ${i < arr.length - 1 ? "border-b border-[#1e1e2e]" : ""}`}>
                    <div className="flex items-baseline gap-2 mb-0.5 mt-3">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: node.color }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-mono text-sm font-bold text-[#f8f8fc]">{node.title}</h3>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] mb-2">{node.subtitle}</p>
                    <p className="text-sm text-[#bcbcd8] leading-relaxed">{node.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── CONNECT FLOW ─────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Step 1 — How you connect</SectionLabel>
          <SectionHeading>The exact connection flow</SectionHeading>
          <p className="text-sm text-[#bcbcd8] mt-2 mb-5 leading-relaxed">
            Here is precisely what happens when you connect {detail.name} to Fold, step by step.
          </p>
          <ol className="space-y-3">
            {detail.connectSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-4 text-sm text-[#e0e0f0]">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                  style={{ color: detail.color, backgroundColor: `${detail.color}18`, border: `1px solid ${detail.color}30` }}
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Card>

        {/* ── PERMISSIONS ──────────────────────────────────────────────── */}
        <Card>
          <SectionLabel color="#a78bfa">Step 2 — Permissions we request</SectionLabel>
          <SectionHeading>Exactly what access Fold asks for</SectionHeading>
          <p className="text-sm text-[#bcbcd8] mt-2 mb-5 leading-relaxed">
            We request the minimum permissions needed. No more.
          </p>
          <ul className="space-y-2.5">
            {detail.scopesRequested.map((scope) => (
              <Check key={scope}>{scope}</Check>
            ))}
          </ul>
        </Card>

        {/* ── API ENDPOINTS ────────────────────────────────────────────── */}
        <Card>
          <SectionLabel color="#60a5fa">Step 3 — API calls Fold makes</SectionLabel>
          <SectionHeading>Every request we send to {detail.name}</SectionHeading>
          <p className="text-sm text-[#bcbcd8] mt-2 mb-5 leading-relaxed">
            These are the exact API endpoints Fold calls during each sync, and why.
          </p>
          <div className="space-y-3">
            {detail.apiEndpoints.map((ep, i) => (
              <div key={i} className="rounded-xl border border-[#363650] bg-[#13131f]/60 p-4">
                <p className="font-mono text-xs font-semibold text-[#60a5fa] mb-1 break-all">{ep.label}</p>
                <p className="text-sm text-[#bcbcd8]">{ep.purpose}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-[#fbbf24]/20 bg-[#fbbf24]/05 px-4 py-3 flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0 text-[#fbbf24] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-[12px] text-[#bcbcd8]"><span className="text-[#fbbf24] font-semibold">API impact:</span> {detail.apiImpact}</p>
          </div>
        </Card>

        {/* ── WHAT WE STORE ────────────────────────────────────────────── */}
        <Card>
          <SectionLabel color="#00d4aa">What we store</SectionLabel>
          <SectionHeading>Exactly what lands in our database</SectionHeading>
          <p className="text-sm text-[#bcbcd8] mt-2 mb-5 leading-relaxed">
            Every field we persist — with a real example and the reason it exists. Nothing more is stored.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#363650]">
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#8585aa] pb-3 pr-6">Field</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#8585aa] pb-3 pr-6">Example value</th>
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest text-[#8585aa] pb-3">Why we store it</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#363650]/60">
                {detail.storedFields.map((f) => (
                  <tr key={f.field}>
                    <td className="py-3 pr-6 text-[#f8f8fc] font-medium align-top">{f.field}</td>
                    <td className="py-3 pr-6 text-[#00d4aa] font-mono text-[12px] align-top whitespace-nowrap">{f.example}</td>
                    <td className="py-3 text-[#bcbcd8] align-top">{f.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── DAILY SNAPSHOT ───────────────────────────────────────────── */}
        <Card>
          <SectionLabel color="#a78bfa">What a daily sync actually stores</SectionLabel>
          <SectionHeading>One day's record — verbatim</SectionHeading>
          <p className="text-sm text-[#bcbcd8] mt-2 mb-5 leading-relaxed">
            This is a real-looking example of the row Fold writes to your account after a single sync. Every field, every value — nothing hidden.
          </p>
          <div className="rounded-xl border border-[#2a2a3e] bg-[#0d0d18] font-mono text-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1e1e30] bg-[#13131f]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]" />
              <span className="ml-2 text-[10px] text-[#4a4a6a] uppercase tracking-widest">
                {detail.name.toLowerCase().replace(/\s+/g, "_")}_daily_snapshot
              </span>
            </div>
            <div className="p-5 space-y-1">
              <p className="text-[#363660]">{"{"}</p>
              {detail.sampleSnapshot.map((row) => (
                <p key={row.label} className="pl-5">
                  <span className="text-[#a78bfa]">&quot;{row.label}&quot;</span>
                  <span className="text-[#8585aa]">: </span>
                  <span className="text-[#00d4aa]">&quot;{row.value}&quot;</span>
                  <span className="text-[#8585aa]">,</span>
                </p>
              ))}
              <p className="text-[#363660]">{"}"}</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-[#4a4a6a] italic">
            No customer names. No emails. No transaction IDs. Just numbers.
          </p>
        </Card>

        {/* ── WHAT WE NEVER STORE ──────────────────────────────────────── */}
        <Card>
          <SectionLabel color="#f87171">What we never store</SectionLabel>
          <SectionHeading>Data Fold never touches</SectionHeading>
          <p className="text-sm text-[#bcbcd8] mt-2 mb-5 leading-relaxed">
            These fields are explicitly excluded. Even if the {detail.name} API returns them,
            Fold ignores and discards them before any storage step.
          </p>
          <ul className="space-y-2.5">
            {detail.neverStored.map((item) => (
              <Cross key={item}>{item}</Cross>
            ))}
          </ul>
        </Card>

        {/* ── WHAT WE NEVER DO ─────────────────────────────────────────── */}
        <Card>
          <SectionLabel color="#f87171">What Fold never does</SectionLabel>
          <SectionHeading>Hard limits — enforced at the API level</SectionHeading>
          <p className="text-sm text-[#bcbcd8] mt-2 mb-5 leading-relaxed">
            These aren&apos;t just policies — they&apos;re technically impossible given the permissions we
            request. {detail.name}&apos;s own API enforces them.
          </p>
          <ul className="space-y-2.5">
            {detail.neverDoes.map((item) => (
              <Cross key={item}>{item}</Cross>
            ))}
          </ul>
        </Card>

        {/* ── PLATFORM PRIVACY NOTE ────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-6"
          style={{ borderColor: `${detail.color}30`, backgroundColor: `${detail.color}08` }}
        >
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0" style={{ color: detail.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: detail.color }}>
                Privacy note — {detail.name} specific
              </p>
              <p className="text-sm text-[#e0e0f0] leading-relaxed">{detail.privacyNote}</p>
            </div>
          </div>
        </div>

        {/* ── RETENTION + REFRESH ──────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <SectionLabel>Data retention</SectionLabel>
            <SectionHeading>How long we keep it</SectionHeading>
            <p className="text-sm text-[#bcbcd8] mt-3 leading-relaxed">{detail.dataRetention}</p>
          </Card>
          <Card>
            <SectionLabel>Refresh frequency</SectionLabel>
            <SectionHeading>How often we sync</SectionHeading>
            <p className="text-sm text-[#bcbcd8] mt-3 leading-relaxed">{detail.refreshFrequency}</p>
          </Card>
        </div>

        {/* ── HOW TO REVOKE ────────────────────────────────────────────── */}
        <Card>
          <SectionLabel color="#f59e0b">How to revoke access</SectionLabel>
          <SectionHeading>You are always in control</SectionHeading>
          <p className="text-sm text-[#bcbcd8] mt-2 mb-6 leading-relaxed">
            You can disconnect {detail.name} from Fold at any time — from either side.
            Both options immediately stop all data access.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#363650] bg-[#13131f]/60 p-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#00d4aa] mb-2">From Fold</p>
              <p className="text-sm text-[#e0e0f0] leading-relaxed">{detail.howToRevoke.fromFold}</p>
            </div>
            <div className="rounded-xl border border-[#363650] bg-[#13131f]/60 p-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa] mb-2">
                From {detail.name} directly
              </p>
              <p className="text-sm text-[#e0e0f0] leading-relaxed mb-3">{detail.howToRevoke.fromPlatform}</p>
              <a
                href={detail.howToRevoke.platformRevokeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#a78bfa] hover:underline"
              >
                Open {detail.name} settings
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </Card>

        {/* ── SECURITY ─────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>Security standards</SectionLabel>
          <SectionHeading>How your credentials are protected</SectionHeading>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {[
              {
                color: "#00d4aa",
                title: "AES-256 encryption at rest",
                desc: detail.connectMethod === "oauth2"
                  ? "Your OAuth access token is encrypted with AES-256 before being written to our database. It is never stored in plaintext."
                  : "Your API key is encrypted with AES-256 before being written to our database. It is never stored, logged, or returned in plaintext.",
              },
              {
                color: "#60a5fa",
                title: "TLS 1.3 in transit",
                desc: `All API calls from Fold to ${detail.name} use TLS 1.3. Your credentials cannot be intercepted in transit.`,
              },
              {
                color: "#a78bfa",
                title: "Read-only enforcement",
                desc: `${detail.name}'s own API enforces the read-only permissions server-side. Even if Fold's code had a bug, the platform would reject any write request.`,
              },
              {
                color: "#f59e0b",
                title: "Row-level security",
                desc: "Your synced data is isolated in our database with row-level security. No other Fold user can query your data.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-[#363650] bg-[#13131f]/60 p-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: item.color }}>
                  {item.title}
                </p>
                <p className="text-sm text-[#bcbcd8] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        {detail.faq.length > 0 && (
          <div>
            <div className="mb-5">
              <SectionLabel>FAQ</SectionLabel>
              <SectionHeading>Questions about the {detail.name} integration</SectionHeading>
            </div>
            <div className="space-y-3">
              {detail.faq.map((item) => (
                <Card key={item.q}>
                  <h3 className="font-mono text-sm font-bold text-[#f8f8fc] mb-2">{item.q}</h3>
                  <p className="text-sm text-[#bcbcd8] leading-relaxed">{item.a}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Divider />

        {/* ── OTHER INTEGRATIONS ───────────────────────────────────────── */}
        <div>
          <div className="mb-5">
            <SectionLabel>Other live integrations</SectionLabel>
            <SectionHeading>See how other connections work</SectionHeading>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveIntegrations.map((integration) => (
              <Link
                key={integration.id}
                href={`/learn/${integration.id}`}
                className="group flex items-center gap-3 rounded-xl border border-[#363650] bg-[#1c1c2a]/60 p-4 transition-all hover:border-[#363660] hover:bg-[#1c1c2a]"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border overflow-hidden"
                  style={{ backgroundColor: `${integration.color}15`, borderColor: `${integration.color}30` }}
                >
                  <img src={integration.icon} alt={integration.name} width={20} height={20} className="object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-[#f8f8fc] group-hover:text-[#00d4aa] transition-colors truncate">{integration.name}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">{integration.category}</p>
                </div>
                <svg className="ml-auto h-4 w-4 shrink-0 text-[#8585aa] group-hover:text-[#00d4aa] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-[#00d4aa]/20 bg-[#00d4aa]/4 p-10 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-full bg-[#00d4aa]/8 blur-3xl" />
          </div>
          <div className="relative">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa] mb-3">
              Ready to connect {detail.name}?
            </p>
            <h2 className="font-mono text-2xl font-bold text-[#f8f8fc] mb-3">
              Start your free trial — no credit card
            </h2>
            <p className="text-sm text-[#bcbcd8] mb-6 max-w-md mx-auto">
              7 days full access. Connect {detail.name} and every other live integration.
              Cancel anytime. Your data deleted on request, immediately.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-[#13131f] transition-all hover:bg-[#00bfa0]"
              >
                Get started free
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <Link
                href="/learn"
                className="inline-flex items-center gap-2 rounded-xl border border-[#363650] bg-[#1c1c2a] px-6 py-3 font-mono text-sm font-semibold uppercase tracking-wider text-[#bcbcd8] transition-all hover:border-[#00d4aa]/30 hover:text-[#f8f8fc]"
              >
                Back to full guide
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#363650] px-6 py-10">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/fold-primary-dark.svg" alt="Fold" className="h-7 w-auto" />
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { label: "Home", href: "/" },
              { label: "How it works", href: "/learn" },
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Contact", href: "mailto:info@usefold.io" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa] hover:text-[#f8f8fc] transition-colors">
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
