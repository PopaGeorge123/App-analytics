import React from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";

// ── SVG sparkline (server-side) ───────────────────────────────────────────────
function Sparkline({
  values,
  color,
  width = 120,
  height = 36,
  filled = true,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  filled?: boolean;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y] as [number, number];
  });
  const linePath = `M ${pts.map(([x, y]) => `${x},${y}`).join(" L ")}`;
  const areaPath = `${linePath} L ${pts[pts.length - 1][0]},${height} L ${pts[0][0]},${height} Z`;
  const id = `grad-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled && <path d={areaPath} fill={`url(#${id})`} />}
      <path d={linePath} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Bar chart (server-side SVG) ───────────────────────────────────────────────
function BarChart({
  values,
  color,
  width = 280,
  height = 64,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!values.some((v) => v > 0)) return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "monospace", fontSize: 9, color: "#58588a" }}>No data yet</span>
    </div>
  );
  const max = Math.max(...values) || 1;
  const barW = Math.max(1, (width / values.length) - 2);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      {values.map((v, i) => {
        const barH = Math.max(2, (v / max) * (height - 4));
        const x = (i / values.length) * width;
        const isLast7 = i >= values.length - 7;
        return (
          <rect
            key={i}
            x={x + 1}
            y={height - barH}
            width={barW}
            height={barH}
            rx={1.5}
            fill={color}
            fillOpacity={isLast7 ? 1 : 0.3}
          />
        );
      })}
    </svg>
  );
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtCents(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}
function fmtUSD(val: number): string {
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
  return `$${val.toFixed(2)}`;
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}
function fmtDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Growth badge ─────────────────────────────────────────────────────────────
function Badge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null;
  const positive = invert ? pct <= 0 : pct >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", borderRadius: 999,
      fontFamily: "monospace", fontSize: 10, fontWeight: 700,
      background: positive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
      color: positive ? "#10b981" : "#ef4444",
    }}>
      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d={positive ? "M4.5 19.5l15-15M19.5 4.5H9m10.5 0v10.5" : "M4.5 4.5l15 15M19.5 19.5H9m10.5 0V9"} />
      </svg>
      {pct > 0 ? "+" : ""}{pct}%
    </span>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, badge, color, icon, spark,
}: {
  label: string; value: string; sub?: string;
  badge?: React.ReactNode; color: string; icon: React.ReactNode; spark?: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#ffffff", borderRadius: 16,
      border: "1px solid rgba(0,0,0,0.1)",
      borderTop: `2px solid ${color}`,
      padding: "18px 18px 14px",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6a6a90" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div>
          <p style={{ fontSize: 26, fontWeight: 700, fontFamily: "monospace", color: "#1a1a2e", lineHeight: 1, margin: 0 }}>{value}</p>
          {(sub || badge) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              {sub && <span style={{ fontFamily: "monospace", fontSize: 10, color: "#6a6a90" }}>{sub}</span>}
              {badge}
            </div>
          )}
        </div>
        {spark && <div style={{ flexShrink: 0 }}>{spark}</div>}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ color, icon, title, subtitle }: { color: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>{title}</p>
        <p style={{ fontFamily: "monospace", fontSize: 10, color: "#6a6a90", margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailySeries { date: string; value: number }
interface Payload {
  type: string;
  generatedBy: string;
  generatedAt: string;
  platforms: string[];
  stripe?: { rev7: number; revPrev7: number; revGrowthPct: number | null; refunds7: number; txCount7: number; newCust7: number; avgTxValue7: number; netRev7: number; rev30: number; txCount30: number; newCust30: number };
  ga4?: { sessions7: number; sessionsPrev7: number; sessionsGrowthPct: number | null; users7: number; newUsers7: number; bounceRate7: number; avgDuration7: number; sessions30: number };
  meta?: { adSpend7: number; adSpend30: number; impressions7: number; clicks7: number; ctr7: number; cpc7: number; roas7: number | null };
  sparklines?: { dailyRevenue: DailySeries[]; dailySessions: DailySeries[]; dailyAdSpend: DailySeries[] };
  // legacy fallback
  metrics?: { rev7?: number; revPrev7?: number; revGrowthPct?: number | null; sessions7?: number; sessionsPrev7?: number; sessionsGrowthPct?: number | null; adSpend7?: number };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const db = createServiceClient();
  const { data: row } = await db
    .from("share_tokens")
    .select("label, date_from, date_to, platforms, payload, expires_at, view_count, created_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) notFound();
  if (new Date(row.expires_at) < new Date()) notFound();

  const payload = row.payload as Payload;
  if (payload?.type !== "dashboard") notFound();

  // Increment view count
  db.from("share_tokens").update({ view_count: (row.view_count ?? 0) + 1 }).eq("token", token).then(() => {});

  const { stripe, ga4, meta, sparklines } = payload;

  // Sparkline value arrays
  const revSpark = sparklines?.dailyRevenue?.map((d) => d.value / 100) ?? [];
  const sessSpark = sparklines?.dailySessions?.map((d) => d.value) ?? [];
  const adSpark = sparklines?.dailyAdSpend?.map((d) => d.value) ?? [];

  const generatedAt = new Date(payload.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const expiresAt = new Date(row.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const platforms = payload.platforms ?? [];

  const hasStripe = stripe && (stripe.rev7 > 0 || stripe.rev30 > 0 || stripe.txCount30 > 0);
  const hasGa4 = ga4 && (ga4.sessions7 > 0 || ga4.sessions30 > 0);
  const hasMeta = meta && (meta.adSpend7 > 0 || meta.adSpend30 > 0 || meta.impressions7 > 0);

  const s = { fontFamily: "system-ui, -apple-system, sans-serif" };

  return (
    <div style={{ ...s, minHeight: "100vh", background: "#f5f5f8", color: "#1a1a2e" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header style={{ background: "#f3f3fb", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Image src="/fold-primary-dark.svg" alt="Fold Analytics" width={100} height={43} style={{ height: 28, width: "auto" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", fontFamily: "monospace", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 999 }}>
              Read-only snapshot
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#58588a" }}>expires {expiresAt}</span>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#58588a" }}>{(row.view_count ?? 0) + 1} views</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* ── Hero header ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ height: 1, flex: 1, background: "rgba(0,0,0,0.07)" }} />
            <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#6a6a90" }}>Dashboard Snapshot</span>
            <div style={{ height: 1, flex: 1, background: "rgba(0,0,0,0.07)" }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1a1a2e", margin: "0 0 8px", lineHeight: 1.2 }}>{row.label}</h1>
          <p style={{ fontFamily: "monospace", fontSize: 11, color: "#6a6a90", margin: "0 0 14px" }}>
            Generated {generatedAt} · Last 30 days of data · Shared by {payload.generatedBy}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {platforms.map((p) => (
              <span key={p} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(0,212,170,0.3)", background: "rgba(0,212,170,0.06)", color: "#00d4aa" }}>
                {p === "ga4" ? "Google Analytics" : p === "meta" ? "Meta Ads" : p.charAt(0).toUpperCase() + p.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* ── STRIPE SECTION ───────────────────────────────────────────── */}
        {hasStripe && (
          <section style={{ marginBottom: 40 }}>
            <SectionHeader
              color="#00d4aa"
              title="Revenue & Payments"
              subtitle="Stripe · Last 7 days vs prior 7 · 30-day totals"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />

            {/* 30-day bar chart */}
            {revSpark.length > 0 && (
              <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.1)", padding: "20px 20px 12px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6a6a90" }}>Revenue — 30-day trend</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#00d4aa", fontWeight: 700 }}>{fmtCents(stripe!.rev30)} total</span>
                </div>
                <BarChart values={revSpark} color="#00d4aa" width={860} height={72} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 9, color: "#58588a" }}>30 days ago</span>
                  <span style={{ fontFamily: "monospace", fontSize: 9, color: "#58588a" }}>Today  ↑ darker = last 7 days</span>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 12 }}>
              <KpiCard
                label="Revenue (7d)" color="#00d4aa" value={fmtCents(stripe!.rev7)}
                sub={stripe!.revPrev7 > 0 ? `vs ${fmtCents(stripe!.revPrev7)} prior week` : undefined}
                badge={<Badge pct={stripe!.revGrowthPct} />}
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                spark={<Sparkline values={revSpark.slice(-14)} color="#00d4aa" />}
              />
              <KpiCard
                label="Net Revenue (7d)" color="#10b981" value={fmtCents(stripe!.netRev7)}
                sub={stripe!.refunds7 > 0 ? `${fmtCents(stripe!.refunds7)} refunded` : "No refunds"}
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <KpiCard
                label="Transactions (7d)" color="#6366f1" value={fmtNum(stripe!.txCount7)}
                sub={`${fmtNum(stripe!.txCount30)} this month`}
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
              />
              <KpiCard
                label="New Customers (7d)" color="#f59e0b" value={fmtNum(stripe!.newCust7)}
                sub={`${fmtNum(stripe!.newCust30)} this month`}
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
              />
              <KpiCard
                label="Avg Txn Value (7d)" color="#a78bfa" value={fmtCents(stripe!.avgTxValue7)}
                sub="per transaction"
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
              />
              {stripe!.refunds7 > 0 && (
                <KpiCard
                  label="Refunds (7d)" color="#ef4444" value={fmtCents(stripe!.refunds7)}
                  sub={`${fmtCents(stripe!.rev7 > 0 ? Math.round(stripe!.refunds7 / stripe!.rev7 * 100) : 0)} refund rate`}
                  icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
                />
              )}
            </div>
          </section>
        )}

        {/* ── GA4 SECTION ──────────────────────────────────────────────── */}
        {hasGa4 && (
          <section style={{ marginBottom: 40 }}>
            <SectionHeader
              color="#6366f1"
              title="Website Traffic"
              subtitle="Google Analytics 4 · Last 7 days vs prior 7 · 30-day totals"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
            />

            {sessSpark.length > 0 && (
              <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.1)", padding: "20px 20px 12px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6a6a90" }}>Sessions — 30-day trend</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6366f1", fontWeight: 700 }}>{fmtNum(ga4!.sessions30)} total</span>
                </div>
                <BarChart values={sessSpark} color="#6366f1" width={860} height={72} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 9, color: "#58588a" }}>30 days ago</span>
                  <span style={{ fontFamily: "monospace", fontSize: 9, color: "#58588a" }}>Today  ↑ darker = last 7 days</span>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 12 }}>
              <KpiCard
                label="Sessions (7d)" color="#6366f1" value={fmtNum(ga4!.sessions7)}
                sub={ga4!.sessionsPrev7 > 0 ? `vs ${fmtNum(ga4!.sessionsPrev7)} prior` : undefined}
                badge={<Badge pct={ga4!.sessionsGrowthPct} />}
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                spark={<Sparkline values={sessSpark.slice(-14)} color="#6366f1" />}
              />
              <KpiCard
                label="Users (7d)" color="#8b5cf6" value={fmtNum(ga4!.users7)}
                sub={`${fmtNum(ga4!.newUsers7)} new users`}
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
              />
              <KpiCard
                label="New Users (7d)" color="#a78bfa" value={fmtNum(ga4!.newUsers7)}
                sub={ga4!.users7 > 0 ? `${Math.round(ga4!.newUsers7 / ga4!.users7 * 100)}% of users` : undefined}
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
              />
              <KpiCard
                label="Bounce Rate (7d)" color="#f59e0b" value={ga4!.bounceRate7 > 0 ? `${(ga4!.bounceRate7 * 100).toFixed(1)}%` : "—"}
                sub="lower is better"
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
              />
              <KpiCard
                label="Avg Session" color="#14b8a6" value={fmtDuration(ga4!.avgDuration7)}
                sub="per visit"
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
              />
              <KpiCard
                label="Sessions (30d)" color="#0ea5e9" value={fmtNum(ga4!.sessions30)}
                sub="monthly total"
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
              />
            </div>
          </section>
        )}

        {/* ── META ADS SECTION ─────────────────────────────────────────── */}
        {hasMeta && (
          <section style={{ marginBottom: 40 }}>
            <SectionHeader
              color="#f59e0b"
              title="Paid Advertising"
              subtitle="Meta Ads · Last 7 days performance"
              icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>}
            />

            {adSpark.length > 0 && adSpark.some((v) => v > 0) && (
              <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.1)", padding: "20px 20px 12px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6a6a90" }}>Ad Spend — 30-day trend</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>{fmtUSD(meta!.adSpend30)} total</span>
                </div>
                <BarChart values={adSpark} color="#f59e0b" width={860} height={72} />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 12 }}>
              <KpiCard
                label="Ad Spend (7d)" color="#f59e0b" value={fmtUSD(meta!.adSpend7)}
                sub={`${fmtUSD(meta!.adSpend30)} this month`}
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                spark={adSpark.length > 0 ? <Sparkline values={adSpark.slice(-14)} color="#f59e0b" /> : undefined}
              />
              <KpiCard
                label="Impressions (7d)" color="#fb923c" value={fmtNum(meta!.impressions7)}
                sub="total views"
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
              />
              <KpiCard
                label="Clicks (7d)" color="#f97316" value={fmtNum(meta!.clicks7)}
                sub={`CTR ${meta!.ctr7}%`}
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>}
              />
              <KpiCard
                label="CPC (7d)" color="#ea580c" value={meta!.cpc7 > 0 ? fmtUSD(meta!.cpc7) : "—"}
                sub="cost per click"
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" /></svg>}
              />
              {meta!.roas7 !== null && (
                <KpiCard
                  label="ROAS (7d)" color="#22c55e" value={meta!.roas7 !== null ? `${meta!.roas7}×` : "—"}
                  sub="revenue per $1 spent"
                  badge={meta!.roas7 !== null ? <Badge pct={meta!.roas7 !== null ? Math.round((meta!.roas7 - 1) * 100) : null} /> : undefined}
                  icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                />
              )}
            </div>
          </section>
        )}

        {/* ── No data fallback ─────────────────────────────────────────── */}
        {!hasStripe && !hasGa4 && !hasMeta && (
          <div style={{ textAlign: "center", padding: "64px 0", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 20, background: "#ffffff" }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#6a6a90" strokeWidth={1.5} style={{ margin: "0 auto 12px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#6a6a90" }}>No metric data in this snapshot.</p>
            <p style={{ fontFamily: "monospace", fontSize: 10, color: "#58588a", marginTop: 4 }}>Connect integrations in Fold to populate this view.</p>
          </div>
        )}

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <div style={{ borderRadius: 14, border: "1px solid rgba(99,102,241,0.15)", background: "rgba(99,102,241,0.04)", padding: "14px 18px", display: "flex", gap: 12, marginBottom: 40 }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#a5b4fc" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p style={{ fontFamily: "monospace", fontSize: 10, color: "#a5b4fc", lineHeight: 1.7, margin: 0 }}>
            This is a <strong>read-only snapshot</strong> captured on {generatedAt}. Metrics reflect data at the moment of generation and are not live. Revenue figures are in USD cents where applicable. The 7-day window covers the 7 days ending on {generatedAt}; the prior-week comparison covers the preceding 7 days.
          </p>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <div style={{ borderRadius: 24, border: "1px solid rgba(0,212,170,0.2)", background: "linear-gradient(135deg, rgba(0,212,170,0.07) 0%, rgba(99,102,241,0.05) 100%)", padding: "40px 32px", textAlign: "center" }}>
          <Image src="/fold-primary-dark.svg" alt="Fold Analytics" width={120} height={52} style={{ height: 36, width: "auto", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: "0 0 10px", lineHeight: 1.2 }}>
            Want your own live analytics dashboard?
          </h2>
          <p style={{ fontFamily: "monospace", fontSize: 11, color: "#6a6a90", margin: "0 auto 24px", maxWidth: 480, lineHeight: 1.8 }}>
            Fold connects Stripe, GA4, Meta Ads, and 30+ more platforms. Get AI-powered insights, weekly email digests, custom alert rules, and shareable dashboards — in minutes.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://foldanalytics.com/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#00d4aa", color: "#f4faf8", fontFamily: "monospace", fontWeight: 800, fontSize: 13, padding: "13px 32px", borderRadius: 12, textDecoration: "none" }}>
              Start free trial →
            </a>
            <a href="https://foldanalytics.com" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.07)", color: "#1a1a2e", fontFamily: "monospace", fontWeight: 700, fontSize: 13, padding: "13px 24px", borderRadius: 12, textDecoration: "none", border: "1px solid rgba(0,0,0,0.08)" }}>
              Learn more
            </a>
          </div>
          <p style={{ fontFamily: "monospace", fontSize: 9, color: "#58588a", marginTop: 14 }}>$19/mo after 7-day trial · No credit card required</p>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(0,0,0,0.08)", padding: "20px 24px", textAlign: "center" }}>
        <p style={{ fontFamily: "monospace", fontSize: 9, color: "#58588a" }}>
          Powered by <strong style={{ color: "#00d4aa" }}>Fold Analytics</strong> · This link expires {expiresAt} · Shared by {payload.generatedBy}
        </p>
      </footer>
    </div>
  );
}
