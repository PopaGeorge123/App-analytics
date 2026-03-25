"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Snapshot } from "./DashboardShell";
import { DEMO_SNAPSHOTS, DEMO_CONNECTED_PLATFORMS } from "./demoData";
import { DEFAULT_ALERTS, type AlertRules } from "./SettingsTab";

// ── Types ─────────────────────────────────────────────────────────────────

interface WebsiteData {
  url: string | null;
  score: number;
  status: "idle" | "analyzing" | "done" | "error";
  summary: string | null;
  lastScanned: string | null;
  tasks: {
    id: string;
    title: string;
    description: string;
    category: string;
    impact_score: number;
    completed: boolean;
    completed_at?: string | null;
  }[];
}

interface OverviewTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  websiteData: WebsiteData;
  onNavigate: (tab: "overview" | "analytics" | "website" | "settings") => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function filterDays(snaps: Snapshot[], days: number): Snapshot[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return snaps.filter((s) => s.date >= cutoffStr);
}

function sumField(snaps: Snapshot[], provider: string, field: string): number {
  return snaps
    .filter((s) => s.provider === provider)
    .reduce((acc, s) => {
      const d = s.data as Record<string, number>;
      return acc + (d[field] ?? 0);
    }, 0);
}

function avgField(snaps: Snapshot[], provider: string, field: string): number {
  const rows = snaps.filter((s) => s.provider === provider);
  if (!rows.length) return 0;
  const total = rows.reduce((acc, s) => {
    const d = s.data as Record<string, number>;
    return acc + (d[field] ?? 0);
  }, 0);
  return total / rows.length;
}

function fmt(n: number, type: "currency" | "number" | "percent" = "number"): string {
  if (type === "currency") {
    if (n >= 100000) return `$${(n / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    return `$${(n / 100).toFixed(2)}`;
  }
  if (type === "percent") return `${n.toFixed(1)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function trendPct(current: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 90) return "#00d4aa";
  if (score >= 70) return "#34d399";
  if (score >= 50) return "#f59e0b";
  if (score >= 30) return "#fb923c";
  return "#f87171";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  if (score >= 30) return "Needs Work";
  return "Poor";
}

function greetingTime(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ── Trend Badge ───────────────────────────────────────────────────────────

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const pct = trendPct(current, prev);
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
        up ? "text-[#00d4aa] bg-[#00d4aa]/10" : "text-red-400 bg-red-400/10"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── KPI Icons ─────────────────────────────────────────────────────────────

const KPI_ICONS: Record<string, React.ReactNode> = {
  revenue: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  sessions: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  adspend: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  customers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  cac: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  ),
  bounce: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  ),
};

// ── KPI Card ──────────────────────────────────────────────────────────────

const KPI_ACCENT_COLORS: Record<string, string> = {
  revenue: "#635bff",
  sessions: "#f59e0b",
  adspend: "#1877f2",
  customers: "#00d4aa",
  cac: "#f87171",
  bounce: "#a78bfa",
};

function KpiCard({
  label,
  value,
  sub,
  trend,
  icon,
}: {
  label: string;
  value: string | null;
  sub?: string | null;
  trend?: { current: number; prev: number } | null;
  icon: string;
}) {
  const accent = KPI_ACCENT_COLORS[icon] ?? "#00d4aa";
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5 flex flex-col gap-3 transition-all hover:border-[#454560] hover:bg-[#0f0f18]"
      style={{ boxShadow: "inset 3px 0 0 " + accent + "30" }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">{label}</span>
        <span style={{ color: accent + "99" }}>{KPI_ICONS[icon]}</span>
      </div>
      {value === null ? (
        <div>
          <p className="font-mono text-2xl font-bold text-[#8585aa]">—</p>
          <p className="mt-1 font-mono text-[10px] text-[#58588a]">Not connected</p>
        </div>
      ) : (
        <div>
          <div className="flex items-end gap-2">
            <p className="font-mono text-2xl font-bold text-[#f8f8fc] leading-none">{value}</p>
            {trend && <TrendBadge current={trend.current} prev={trend.prev} />}
          </div>
          {sub && <p className="mt-1.5 font-mono text-[10px] text-[#8585aa]">{sub}</p>}
          {trend && trendPct(trend.current, trend.prev) !== null && (
            <p className="mt-1 font-mono text-[9px] text-[#58588a]">vs prev 7 days</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mini Score Ring ───────────────────────────────────────────────────────

function MiniScoreRing({ score }: { score: number }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const color = scoreColor(score);
  return (
    <div className="relative flex items-center justify-center h-16 w-16 shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#363650" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={R}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <span className="absolute font-mono text-[13px] font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Goals Widget ─────────────────────────────────────────────────────────

interface Goals {
  revenueTarget: number; // cents per week
  sessionsTarget: number;
}

function GoalsWidget({
  revenue7: revenue7,
  sessions7: sessions7,
  stripeConn,
  ga4Conn,
}: {
  revenue7: number;
  sessions7: number;
  stripeConn: boolean;
  ga4Conn: boolean;
}) {
  const [goals, setGoals] = useState<Goals>({ revenueTarget: 0, sessionsTarget: 0 });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ revenue: "", sessions: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.goals) setGoals(d.goals);
      })
      .catch(() => {});
  }, []);

  function openEdit() {
    setDraft({
      revenue: goals.revenueTarget ? (goals.revenueTarget / 100).toFixed(0) : "",
      sessions: goals.sessionsTarget ? String(goals.sessionsTarget) : "",
    });
    setEditing(true);
  }

  async function saveGoals() {
    const updated: Goals = {
      revenueTarget: draft.revenue ? Math.round(parseFloat(draft.revenue) * 100) : 0,
      sessionsTarget: draft.sessions ? parseInt(draft.sessions) : 0,
    };
    setGoals(updated);
    setEditing(false);
    setSaving(true);
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: updated }),
      });
    } finally {
      setSaving(false);
    }
  }

  const revenueProgress = goals.revenueTarget > 0 ? Math.min((revenue7 / goals.revenueTarget) * 100, 100) : 0;
  const sessionsProgress = goals.sessionsTarget > 0 ? Math.min((sessions7 / goals.sessionsTarget) * 100, 100) : 0;

  const hasGoals = goals.revenueTarget > 0 || goals.sessionsTarget > 0;

  if (!editing && !hasGoals) {
    return (
      <button
        onClick={openEdit}
        className="w-full flex items-center gap-2 rounded-xl border border-dashed border-[#363650] bg-transparent px-4 py-3 text-left text-[#8585aa] hover:border-[#00d4aa]/30 hover:text-[#00d4aa] transition-colors group"
      >
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
        </svg>
        <span className="font-mono text-[11px]">Set weekly goals →</span>
      </button>
    );
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-4 py-3 space-y-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#00d4aa]">Set weekly goals</p>
        {stripeConn && (
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] text-[#bcbcd8] w-28 shrink-0">Revenue target ($)</label>
            <input
              type="number"
              placeholder="e.g. 2000"
              value={draft.revenue}
              onChange={(e) => setDraft((d) => ({ ...d, revenue: e.target.value }))}
              className="flex-1 bg-[#222235] border border-[#363650] rounded-lg px-3 py-1.5 font-mono text-xs text-[#f8f8fc] placeholder:text-[#58588a] focus:outline-none focus:border-[#00d4aa]/30"
            />
          </div>
        )}
        {ga4Conn && (
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] text-[#bcbcd8] w-28 shrink-0">Sessions target</label>
            <input
              type="number"
              placeholder="e.g. 3000"
              value={draft.sessions}
              onChange={(e) => setDraft((d) => ({ ...d, sessions: e.target.value }))}
              className="flex-1 bg-[#222235] border border-[#363650] rounded-lg px-3 py-1.5 font-mono text-xs text-[#f8f8fc] placeholder:text-[#58588a] focus:outline-none focus:border-[#00d4aa]/30"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={saveGoals} disabled={saving} className="flex-1 rounded-lg bg-[#00d4aa] px-3 py-1.5 font-mono text-xs font-bold text-[#13131f] hover:bg-[#00bfa0] transition disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => setEditing(false)} className="rounded-lg border border-[#363650] px-3 py-1.5 font-mono text-xs text-[#8585aa] hover:text-[#bcbcd8] transition">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Weekly goals</p>
        <button onClick={openEdit} className="font-mono text-[9px] text-[#8585aa] hover:text-[#00d4aa] transition">Edit</button>
      </div>
      {stripeConn && goals.revenueTarget > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] text-[#bcbcd8]">Revenue</span>
            <span className="font-mono text-[10px] text-[#f8f8fc]">
              {fmt(revenue7, "currency")} <span className="text-[#8585aa]">/ {fmt(goals.revenueTarget, "currency")}</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#363650]">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${revenueProgress}%`, backgroundColor: revenueProgress >= 100 ? "#00d4aa" : revenueProgress >= 75 ? "#34d399" : "#f59e0b" }} />
          </div>
          {revenueProgress >= 100 && <p className="mt-0.5 font-mono text-[9px] text-[#00d4aa]">🎉 Goal reached!</p>}
        </div>
      )}
      {ga4Conn && goals.sessionsTarget > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] text-[#bcbcd8]">Sessions</span>
            <span className="font-mono text-[10px] text-[#f8f8fc]">
              {fmt(sessions7)} <span className="text-[#8585aa]">/ {fmt(goals.sessionsTarget)}</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#363650]">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sessionsProgress}%`, backgroundColor: sessionsProgress >= 100 ? "#00d4aa" : sessionsProgress >= 75 ? "#34d399" : "#f59e0b" }} />
          </div>
          {sessionsProgress >= 100 && <p className="mt-0.5 font-mono text-[9px] text-[#00d4aa]">🎉 Goal reached!</p>}
        </div>
      )}
    </div>
  );
}

// ── Integration icons ─────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Revenue & customers",
    connectUrl: "/api/auth/stripe/url",
    color: "#635bff",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    ),
  },
  {
    id: "ga4",
    name: "Google Analytics",
    description: "Sessions & conversions",
    connectUrl: "/api/auth/google/url",
    color: "#f59e0b",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    id: "meta",
    name: "Meta Ads",
    description: "Ad spend & reach",
    connectUrl: "/api/auth/meta/url",
    color: "#1877f2",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
];

// ── Main Component ────────────────────────────────────────────────────────

export default function OverviewTab({
  email,
  isPremium,
  connectedPlatforms,
  snapshots,
  websiteData,
  onNavigate,
}: OverviewTabProps) {
  const router = useRouter();
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [alertRules, setAlertRules] = useState<AlertRules>(DEFAULT_ALERTS);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.alertRules) setAlertRules(d.alertRules);
      })
      .catch(() => {});
  }, []);

  async function handleUpgrade() {
    setUpgradeLoading(true);
    setUpgradeError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setUpgradeError(data.error ?? "Something went wrong.");
        setUpgradeLoading(false);
        return;
      }
      router.push(data.url);
    } catch {
      setUpgradeError("Network error. Please try again.");
      setUpgradeLoading(false);
    }
  }

  // ── Metrics: 7d vs previous 7d for trend ───────────────────────────────
  // Demo mode: show sample data when no platforms are connected
  const isDemoMode = isPremium && connectedPlatforms.length === 0;
  const effectiveSnapshots = isDemoMode ? DEMO_SNAPSHOTS : snapshots;
  const effectivePlatforms = isDemoMode ? DEMO_CONNECTED_PLATFORMS : connectedPlatforms;

  const { kpis, activity, narrative, crossInsights, metrics7 } = useMemo(() => {
    const snaps7 = filterDays(effectiveSnapshots, 7);
    const snaps14 = filterDays(effectiveSnapshots, 14);
    const snapsPrev7 = snaps14.filter((s) => !snaps7.find((x) => x.id === s.id));

    const revenue7 = sumField(snaps7, "stripe", "revenue");
    const revenuePrev = sumField(snapsPrev7, "stripe", "revenue");
    const sessions7 = sumField(snaps7, "ga4", "sessions");
    const sessionsPrev = sumField(snapsPrev7, "ga4", "sessions");
    const spend7 = sumField(snaps7, "meta", "spend");
    const spendPrev = sumField(snapsPrev7, "meta", "spend");
    const newCustomers7 = sumField(snaps7, "stripe", "newCustomers");
    const newCustomersPrev = sumField(snapsPrev7, "stripe", "newCustomers");
    const conversions7 = sumField(snaps7, "ga4", "conversions");
    const bounceRate7 = avgField(snaps7, "ga4", "bounceRate");

    const stripeConn = effectivePlatforms.includes("stripe");
    const ga4Conn = effectivePlatforms.includes("ga4");
    const metaConn = effectivePlatforms.includes("meta");
    const cac7 = newCustomers7 > 0 ? spend7 / newCustomers7 : null;

    // ── Yesterday's metrics for daily narrative ─────────────────────────
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const snapsYesterday = effectiveSnapshots.filter((s) => s.date === yesterdayStr);
    const revenueYday = sumField(snapsYesterday, "stripe", "revenue");
    const sessionsYday = sumField(snapsYesterday, "ga4", "sessions");
    const txYday = sumField(snapsYesterday, "stripe", "transactions");
    const newCxYday = sumField(snapsYesterday, "stripe", "newCustomers");
    const spendYday = sumField(snapsYesterday, "meta", "spend");
    const bounceYday = avgField(snapsYesterday, "ga4", "bounceRate");
    const hasYesterdayData = snapsYesterday.length > 0;

    // Build narrative sentence
    const narrativeParts: string[] = [];
    if (stripeConn && revenueYday > 0) narrativeParts.push(`${fmt(revenueYday, "currency")} revenue (${txYday} txns)`);
    if (ga4Conn && sessionsYday > 0) narrativeParts.push(`${fmt(sessionsYday)} sessions`);
    if (stripeConn && newCxYday > 0) narrativeParts.push(`${newCxYday} new customer${newCxYday !== 1 ? "s" : ""}`);
    if (metaConn && spendYday > 0) narrativeParts.push(`${fmt(spendYday, "currency")} ad spend`);

    const narrative = {
      hasData: hasYesterdayData && narrativeParts.length > 0,
      text: narrativeParts.join(" · "),
      bounceAlert: ga4Conn && bounceYday > 65,
      bounceRate: bounceYday,
      date: yesterdayStr,
    };

    // ── Cross-insight: website + analytics ──────────────────────────────
    const crossInsights: { icon: string; color: string; message: string; action: string }[] = [];
    if (ga4Conn && bounceRate7 > 65 && websiteData.score > 0 && websiteData.score < 60) {
      crossInsights.push({
        icon: "⚠",
        color: "#f59e0b",
        message: `High bounce rate (${fmt(bounceRate7, "percent")}) combined with a low website score (${websiteData.score}/100) suggests UX issues are driving visitors away.`,
        action: "Fix website →",
      });
    }
    if (ga4Conn && bounceRate7 > 65 && websiteData.score >= 60) {
      crossInsights.push({
        icon: "↑",
        color: "#f87171",
        message: `Bounce rate is elevated at ${fmt(bounceRate7, "percent")}. Despite a decent website score, consider reviewing your landing page copy and load speed.`,
        action: "View website →",
      });
    }
    if (stripeConn && metaConn && newCustomers7 > 0 && spend7 > 0 && websiteData.score > 0 && websiteData.score < 55) {
      crossInsights.push({
        icon: "💡",
        color: "#a78bfa",
        message: `You're spending on ads but your website health score is ${websiteData.score}/100. Fixing website issues could significantly improve your ad-to-customer conversion rate.`,
        action: "Improve website →",
      });
    }

    const kpis = [
      {
        label: "Revenue (7d)",
        value: stripeConn ? fmt(revenue7, "currency") : null,
        sub: stripeConn ? `${newCustomers7} new customers` : null,
        trend: stripeConn ? { current: revenue7, prev: revenuePrev } : null,
        icon: "revenue",
      },
      {
        label: "Sessions (7d)",
        value: ga4Conn ? fmt(sessions7) : null,
        sub: ga4Conn ? `${fmt(conversions7)} conversions` : null,
        trend: ga4Conn ? { current: sessions7, prev: sessionsPrev } : null,
        icon: "sessions",
      },
      {
        label: "Ad Spend (7d)",
        value: metaConn ? fmt(spend7, "currency") : null,
        sub: metaConn ? `${fmt(sumField(snaps7, "meta", "clicks"))} clicks` : null,
        trend: metaConn ? { current: spend7, prev: spendPrev } : null,
        icon: "adspend",
      },
      {
        label: "New Customers (7d)",
        value: stripeConn ? fmt(newCustomers7) : null,
        sub: stripeConn
          ? bounceRate7 > 0 && ga4Conn
            ? `Bounce rate ${fmt(bounceRate7, "percent")}`
            : "from Stripe"
          : null,
        trend: stripeConn ? { current: newCustomers7, prev: newCustomersPrev } : null,
        icon: "customers",
      },
      {
        label: "CAC",
        value: metaConn && stripeConn && cac7 !== null ? fmt(cac7, "currency") : null,
        sub: metaConn && stripeConn && cac7 !== null ? "ad spend ÷ new customers" : null,
        trend: null,
        icon: "cac",
      },
      {
        label: "Bounce Rate (7d)",
        value: ga4Conn ? fmt(bounceRate7, "percent") : null,
        sub: ga4Conn ? "avg across 7 days" : null,
        trend: null,
        icon: "bounce",
      },
    ];

    // Activity feed from completed tasks + last scan
    const activityItems: { type: string; label: string; time: string; color: string }[] = [];

    websiteData.tasks
      .filter((t) => t.completed && t.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .slice(0, 4)
      .forEach((t) => {
        activityItems.push({
          type: "task",
          label: `Completed: ${t.title}`,
          time: timeAgo(t.completed_at!),
          color: "#00d4aa",
        });
      });

    if (websiteData.lastScanned) {
      activityItems.push({
        type: "scan",
        label: `Website analyzed — score ${websiteData.score}/100`,
        time: timeAgo(websiteData.lastScanned),
        color: "#a78bfa",
      });
    }

    return { kpis, activity: activityItems.slice(0, 5), narrative, crossInsights, metrics7: { revenue7, sessions7: sessions7, bounceRate7, spend7, revenuePrev } };
  }, [effectiveSnapshots, effectivePlatforms, websiteData]);

  const pendingTasks = websiteData.tasks.filter((t) => !t.completed);
  const completedTasks = websiteData.tasks.filter((t) => t.completed);
  const hasAllIntegrations = ["stripe", "ga4", "meta"].every((p) => connectedPlatforms.includes(p));
  const missingIntegrations = INTEGRATIONS.filter((i) => !connectedPlatforms.includes(i.id));

  // ── Active alerts based on user-configured thresholds ─────────────────
  const activeAlerts: { color: string; message: string }[] = [];
  if (alertRules.revenueDropPct > 0 && metrics7.revenuePrev > 0) {
    const dropPct = ((metrics7.revenuePrev - metrics7.revenue7) / metrics7.revenuePrev) * 100;
    if (dropPct >= alertRules.revenueDropPct) {
      activeAlerts.push({ color: "#f87171", message: `🚨 Revenue is down ${dropPct.toFixed(1)}% vs last week (threshold: ${alertRules.revenueDropPct}%)` });
    }
  }
  if (alertRules.bounceSpikeThreshold > 0 && metrics7.bounceRate7 > alertRules.bounceSpikeThreshold) {
    activeAlerts.push({ color: "#f59e0b", message: `⚠ Bounce rate ${fmt(metrics7.bounceRate7, "percent")} exceeds your ${alertRules.bounceSpikeThreshold}% threshold` });
  }
  if (alertRules.spendSpikeThreshold > 0 && metrics7.spend7 > 0) {
    const avgDailySpend = metrics7.spend7 / 7;
    if (avgDailySpend > alertRules.spendSpikeThreshold * 100) {
      activeAlerts.push({ color: "#1877f2", message: `💸 Average daily ad spend (${fmt(avgDailySpend, "currency")}) exceeds your $${alertRules.spendSpikeThreshold} cap` });
    }
  }

  const firstName = email.split("@")[0].split(/[._-]/)[0];
  const capitalFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div className="max-w-5xl space-y-8">

      {/* ── Greeting ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">
            {greetingTime()}, {capitalFirst}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-[#8585aa]">{formatDate()}</p>
        </div>
        {isPremium ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/8 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">
              Premium Active
            </span>
          </div>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={upgradeLoading}
            className="inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/25 bg-[#00d4aa]/5 px-4 py-1.5 font-mono text-[10px] font-semibold text-[#00d4aa] hover:bg-[#00d4aa]/10 transition disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            Upgrade to Premium
          </button>
        )}
      </div>

      {upgradeError && <p className="font-mono text-xs text-red-400">{upgradeError}</p>}

      {/* ── Demo mode banner ──────────────────────────────────── */}
      {isDemoMode && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#a78bfa]/25 bg-[#a78bfa]/8 px-5 py-4">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#a78bfa]/15 text-[#a78bfa]">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa] mb-0.5">Demo Mode</p>
            <p className="font-mono text-[11px] text-[#e0e0f0]">
              You&apos;re viewing sample data for a fictional SaaS business. Connect Stripe, GA4, or Meta Ads in Settings to see your real metrics.
            </p>
          </div>
          <button
            onClick={() => onNavigate("settings")}
            className="shrink-0 font-mono text-[10px] font-semibold text-[#a78bfa] hover:underline"
          >
            Connect →
          </button>
        </div>
      )}

      {/* ── Yesterday at a glance ─────────────────────────────── */}
      {isPremium && narrative.hasData && (
        <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00d4aa]/10 text-[#00d4aa]">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">Yesterday</p>
                <span className="font-mono text-[9px] text-[#58588a]">
                  {new Date(narrative.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="font-mono text-sm text-[#e0e0f0] leading-relaxed">{narrative.text}</p>
              {narrative.bounceAlert && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 px-2.5 py-1">
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="font-mono text-[10px] font-semibold text-amber-400">
                    Bounce rate {fmt(narrative.bounceRate, "percent")} — high, consider checking landing pages
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Premium gate ─────────────────────────────────────── */}
      {!isPremium && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 py-16 px-6 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#a78bfa]/20 bg-[#a78bfa]/10 text-[#a78bfa]">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa] mb-2">Premium Required</p>
          <h2 className="font-mono text-xl font-bold text-[#f8f8fc] mb-3">Unlock your full dashboard</h2>
          <p className="text-sm text-[#bcbcd8] max-w-sm mb-6">
            Get real-time business intelligence with live data from all your connected tools.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-7 w-full max-w-sm text-left">
            {[
              "KPI dashboard with trends",
              "Website health score",
              "Stripe & GA4 analytics",
              "Meta Ads performance",
              "AI business advisor",
              "Daily automated insights",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="font-mono text-[10px] text-[#bcbcd8]">{f}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleUpgrade}
            disabled={upgradeLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-7 py-3 font-mono text-sm font-bold text-[#13131f] hover:bg-[#00bfa0] transition disabled:opacity-50"
          >
            {upgradeLoading ? "Redirecting…" : "Start 3-day free trial →"}
          </button>
          <p className="mt-3 font-mono text-[10px] text-[#8585aa]">$29/mo after trial · Cancel anytime</p>
        </div>
      )}

      {/* ── Premium content ──────────────────────────────────── */}
      {isPremium && <>

      {/* ── Active alert banners ──────────────────────────── */}
      {isPremium && activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: alert.color + "35", backgroundColor: alert.color + "0d" }}>
              <p className="flex-1 font-mono text-[11px]" style={{ color: alert.color }}>{alert.message}</p>
              <button
                onClick={() => onNavigate("settings")}
                className="shrink-0 font-mono text-[10px] hover:underline"
                style={{ color: alert.color }}
              >
                Adjust →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Cross-insights (website + analytics) ──────────────── */}
      {isPremium && crossInsights.length > 0 && (
        <div className="space-y-2">
          {crossInsights.slice(0, 1).map((ci, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border px-5 py-3.5" style={{ borderColor: ci.color + "30", backgroundColor: ci.color + "08" }}>
              <span className="mt-0.5 font-mono text-sm shrink-0" style={{ color: ci.color }}>{ci.icon}</span>
              <p className="flex-1 font-mono text-[11px] text-[#e0e0f0] leading-relaxed">{ci.message}</p>
              <button
                onClick={() => onNavigate("website")}
                className="shrink-0 font-mono text-[10px] font-semibold hover:underline"
                style={{ color: ci.color }}
              >
                {ci.action}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── KPI Grid ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Last 7 days</p>
          <span className="font-mono text-[8px] text-[#58588a] border border-[#363650] rounded px-1.5 py-0.5">▲▼ vs prev 7 days</span>
          <div className="flex-1 border-t border-[#363650]" />
          <button
            onClick={() => onNavigate("analytics")}
            className="font-mono text-[9px] text-[#8585aa] hover:text-[#00d4aa] transition"
          >
            Full analytics →
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              sub={k.sub}
              trend={k.trend}
              icon={k.icon}
            />
          ))}
        </div>
      </section>

      {/* ── Bottom grid: Website score + Quick Actions + Activity ─ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Website Health card (2/3 width) */}
        <div className="lg:col-span-2 rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Website Health</p>
              {websiteData.url && (
                <p className="mt-0.5 font-mono text-[11px] text-[#bcbcd8] truncate max-w-60">
                  {websiteData.url.replace(/^https?:\/\//, "")}
                </p>
              )}
            </div>
            <button
              onClick={() => onNavigate("website")}
              className="font-mono text-[10px] font-semibold text-[#00d4aa] hover:underline"
            >
              Manage →
            </button>
          </div>

          {!websiteData.url ? (
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-[#363650] p-4">
              <span className="text-[#2e2e4e]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
              </span>
              <div>
                <p className="font-mono text-sm font-semibold text-[#8585aa]">No website added yet</p>
                <button
                  onClick={() => onNavigate("website")}
                  className="mt-1 font-mono text-[11px] font-semibold text-[#00d4aa] hover:underline"
                >
                  Add your website →
                </button>
              </div>
            </div>
          ) : websiteData.status === "analyzing" ? (
            <div className="flex items-center gap-4 rounded-xl border border-[#a78bfa]/20 bg-[#a78bfa]/5 p-4">
              <svg className="animate-spin h-5 w-5 text-[#a78bfa] shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="font-mono text-sm text-[#a78bfa]">Analysis in progress…</p>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <MiniScoreRing score={websiteData.score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-lg font-bold text-[#f8f8fc]">{websiteData.score}/100</span>
                  <span
                    className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
                    style={{
                      color: scoreColor(websiteData.score),
                      backgroundColor: `${scoreColor(websiteData.score)}18`,
                    }}
                  >
                    {scoreLabel(websiteData.score)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#363650] mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${websiteData.score}%`,
                      backgroundColor: scoreColor(websiteData.score),
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] font-mono text-[#8585aa]">
                  <span>
                    <span className="text-[#f59e0b] font-bold">{pendingTasks.length}</span> tasks pending
                  </span>
                  <span>
                    <span className="text-[#00d4aa] font-bold">{completedTasks.length}</span> completed
                  </span>
                  {websiteData.lastScanned && (
                    <span>Scanned {timeAgo(websiteData.lastScanned)}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Top 2 pending tasks preview */}
          {pendingTasks.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Top improvements</p>
              {pendingTasks.slice(0, 2).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] shrink-0" />
                  <p className="flex-1 min-w-0 font-mono text-[11px] text-[#e0e0f0] truncate">{t.title}</p>
                  <span className="font-mono text-[10px] font-bold text-[#f59e0b] shrink-0">
                    +{t.impact_score} pts
                  </span>
                </div>
              ))}
              {pendingTasks.length > 2 && (
                <button
                  onClick={() => onNavigate("website")}
                  className="font-mono text-[10px] text-[#8585aa] hover:text-[#00d4aa] transition"
                >
                  +{pendingTasks.length - 2} more tasks →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right column: Quick Actions + Recent Activity */}
        <div className="flex flex-col gap-4">

          {/* Quick Actions */}
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Quick Actions</p>
            <div className="space-y-2">
              <GoalsWidget
                revenue7={kpis.find((k) => k.icon === "revenue")?.trend?.current ?? 0}
                sessions7={kpis.find((k) => k.icon === "sessions")?.trend?.current ?? 0}
                stripeConn={effectivePlatforms.includes("stripe")}
                ga4Conn={effectivePlatforms.includes("ga4")}
              />
              <button
                onClick={() => onNavigate("website")}
                className="w-full flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2.5 text-left transition hover:border-[#00d4aa]/25 hover:bg-[#0f1420] group"
              >
                <span className="text-[#8585aa] group-hover:text-[#00d4aa] transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#e0e0f0] group-hover:text-[#f8f8fc]">
                  {websiteData.url ? "Re-analyze website" : "Add website"}
                </span>
              </button>
              <button
                onClick={() => onNavigate("analytics")}
                className="w-full flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2.5 text-left transition hover:border-[#00d4aa]/25 hover:bg-[#0f1420] group"
              >
                <span className="text-[#8585aa] group-hover:text-[#00d4aa] transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#e0e0f0] group-hover:text-[#f8f8fc]">
                  View analytics
                </span>
              </button>
              <button
                onClick={() => onNavigate("settings")}
                className="w-full flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2.5 text-left transition hover:border-[#00d4aa]/25 hover:bg-[#0f1420] group"
              >
                <span className="text-[#8585aa] group-hover:text-[#00d4aa] transition">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#e0e0f0] group-hover:text-[#f8f8fc]">
                  Manage integrations
                </span>
              </button>
              {!isPremium && (
                <button
                  onClick={handleUpgrade}
                  disabled={upgradeLoading}
                  className="w-full flex items-center gap-3 rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-3 py-2.5 text-left transition hover:bg-[#00d4aa]/10 group disabled:opacity-50"
                >
                  <span className="text-[#00d4aa]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#00d4aa]">
                    Upgrade to Premium
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa] mb-3">Recent Activity</p>
            {activity.length === 0 ? (
              <div className="py-4 text-center">
                <p className="font-mono text-[11px] text-[#58588a]">No activity yet</p>
                <p className="mt-1 font-mono text-[10px] text-[#58588a]">
                  Analyze your website to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: a.color + "18", color: a.color }}
                    >
                      {a.type === "task" ? (
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : a.type === "scan" ? (
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-[#e0e0f0] leading-snug">{a.label}</p>
                      <p className="font-mono text-[9px] text-[#8585aa] mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Integrations (only if not all connected) ──────────── */}
      {!hasAllIntegrations && (
        <section className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/70 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Integrations</p>
              <p className="mt-1 text-sm text-[#bcbcd8]">Connect your tools to unlock real data.</p>
            </div>
            <span className="font-mono text-[10px] text-[#8585aa]">
              {connectedPlatforms.length}/3 connected
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {missingIntegrations.map((intg) => (
              <a
                key={intg.id}
                href={intg.connectUrl}
                className="flex items-center gap-3 rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 transition hover:border-[#00d4aa]/25 hover:bg-[#0f1420] group"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${intg.color}18`, color: intg.color }}
                >
                  {intg.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-[#e0e0f0] group-hover:text-[#f8f8fc]">
                    {intg.name}
                  </p>
                  <p className="font-mono text-[9px] text-[#8585aa]">{intg.description}</p>
                </div>
                <span className="ml-auto font-mono text-[9px] text-[#8585aa] group-hover:text-[#00d4aa] shrink-0">
                  Connect →
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      </>}

    </div>
  );
}
