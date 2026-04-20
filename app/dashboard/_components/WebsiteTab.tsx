"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────

type AnalysisStatus = "idle" | "analyzing" | "done" | "error";

interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  impact_score: number;
  completed: boolean;
  completed_at?: string | null;
}

interface WebsiteProfile {
  url: string;
  score: number;
  analysis_status: AnalysisStatus;
  analysis_error?: string | null;
  description?: string | null;
  last_scanned_at?: string | null;
}

interface WebsiteTabProps {
  isPremium: boolean;
  initialUrl: string | null;
  initialScore?: number;
  initialStatus?: AnalysisStatus;
  initialSummary?: string | null;
  initialLastScanned?: string | null;
  initialTasks?: Task[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  ux:            { label: "UX",            color: "#a78bfa", icon: "🎨" },
  performance:   { label: "Performance",   color: "#60a5fa", icon: "⚡" },
  seo:           { label: "SEO",           color: "#34d399", icon: "🔍" },
  copy:          { label: "Copy",          color: "#f59e0b", icon: "📝" },
  conversion:    { label: "Conversion",    color: "#f87171", icon: "🔄" },
  accessibility: { label: "Accessibility", color: "#00d4aa", icon: "♿" },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Score Circle ─────────────────────────────────────────────────────────

function ScoreCircle({ score, animating }: { score: number; animating?: boolean }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const pct = score / 100;
  const color = scoreColor(score);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#363650" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          style={{ transition: animating ? "stroke-dashoffset 1.2s ease-out, stroke 0.5s" : "none" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-4xl font-bold" style={{ color }}>{score}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">/ 100</span>
        <span className="mt-0.5 font-mono text-[11px] font-semibold" style={{ color }}>
          {scoreLabel(score)}
        </span>
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onComplete,
  completing,
}: {
  task: Task;
  onComplete: (id: string) => void;
  completing: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const cat = CATEGORY_META[task.category] ?? { label: task.category, color: "#bcbcd8", icon: "•" };

  function handleCheckClick() {
    if (task.completed || completing) return;
    setConfirming(true);
  }

  function handleConfirm() {
    setConfirming(false);
    onComplete(task.id);
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        task.completed
          ? "border-[#222235] bg-[#1c1c2a]/50 opacity-55"
          : confirming
          ? "border-[#f59e0b]/30 bg-[#13120a]"
          : "border-[#363650] bg-[#111119] hover:border-[#454560] hover:bg-[#121220]"
      }`}
    >
      {/* ── Colour accent bar (left edge) ── */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.75 rounded-l-2xl"
        style={{ backgroundColor: task.completed ? "#454560" : cat.color }}
      />

      <div className="pl-5 pr-4 py-4">
        {/* ── Top row: category badge + impact pill ── */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <span
            className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
            style={{
              color: task.completed ? "#8585aa" : cat.color,
              backgroundColor: task.completed ? "#222235" : `${cat.color}14`,
            }}
          >
            {cat.icon} {cat.label}
          </span>

          <div className="flex items-center gap-2">
            {/* Impact badge */}
            <span
              className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                task.completed
                  ? "text-[#8585aa] bg-[#222235]"
                  : "text-[#f59e0b] bg-[#f59e0b]/10"
              }`}
            >
              +{task.impact_score} pts
            </span>

            {/* Checkbox button */}
            <button
              onClick={handleCheckClick}
              disabled={task.completed || completing}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
                task.completed
                  ? "border-[#00d4aa] bg-[#00d4aa]"
                  : completing
                  ? "border-[#2e2e4e] bg-[#363650] animate-pulse cursor-wait"
                  : confirming
                  ? "border-[#f59e0b] bg-[#f59e0b]/15 cursor-pointer"
                  : "border-[#2e2e4e] hover:border-[#00d4aa]/60 cursor-pointer"
              }`}
              aria-label={task.completed ? "Completed" : "Mark as done"}
            >
              {task.completed && (
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 4.5-5" stroke="#1c1c2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {confirming && !task.completed && (
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 4.5-5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Title ── */}
        <p
          className={`text-sm font-semibold leading-snug mb-1.5 ${
            task.completed ? "line-through text-[#3a3a5a]" : "text-[#eeeef5]"
          }`}
        >
          {task.title}
        </p>

        {/* ── Description ── */}
        <p className={`text-[13px] leading-relaxed ${task.completed ? "text-[#58588a]" : "text-[#7070a0]"}`}>
          {task.description}
        </p>

        {/* ── Confirm strip ── */}
        {confirming && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-3 py-2.5">
            <span className="flex-1 min-w-0 font-mono text-[11px] text-[#f59e0b]">
              Are you sure? This adds{" "}
              <span className="font-bold text-[#fbbf24]">+{task.impact_score} pts</span>{" "}
              to your score.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-[#00d4aa] px-3 py-1.5 font-mono text-[10px] font-bold text-[#1c1c2a] transition hover:bg-[#00d4aa]/85"
              >
                Yes, done ✓
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-[#2e2e4e] px-3 py-1.5 font-mono text-[10px] text-[#6666888] transition hover:text-[#f8f8fc] hover:border-[#8585aa]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Analyzing Skeleton ────────────────────────────────────────────────────

function AnalyzingSkeleton({ url }: { url: string }) {
  const steps = [
    { label: "Fetching website HTML…",                   delay: "0s" },
    { label: "Capturing full-page screenshot…",          delay: "1.5s" },
    { label: "Running AI vision analysis…",              delay: "3s" },
    { label: "Checking SEO, performance & copy…",        delay: "5s" },
    { label: "Generating improvement tasks…",            delay: "7s" },
  ];

  return (
    <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-8 text-center space-y-6">
      <div className="mx-auto relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-[#00d4aa]/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-[#00d4aa]/40 animate-ping [animation-delay:0.3s]" />
        <div className="h-10 w-10 rounded-full bg-[#00d4aa]/10 flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 text-[#00d4aa]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      </div>

      <div>
        <p className="font-mono text-sm font-semibold text-[#f8f8fc]">Analyzing your website…</p>
        <p className="mt-1 font-mono text-[11px] text-[#8585aa] truncate max-w-xs mx-auto">{url}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#a78bfa]/10 border border-[#a78bfa]/20 px-3 py-1">
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          <span className="font-mono text-[10px] text-[#a78bfa]">AI Vision — sees your site as a real browser</span>
        </div>
      </div>

      <div className="text-left space-y-2 max-w-sm mx-auto">
        {steps.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2 opacity-0"
            style={{ animation: `fadeIn 0.4s ease forwards`, animationDelay: s.delay }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa]/60 animate-pulse" style={{ animationDelay: s.delay }} />
            <span className="font-mono text-[11px] text-[#8585aa]">{s.label}</span>
          </div>
        ))}
      </div>

      <style>{`@keyframes fadeIn { to { opacity: 1; } }`}</style>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function WebsiteTab({
  isPremium,
  initialUrl,
  initialScore = 0,
  initialStatus = "idle",
  initialSummary = null,
  initialLastScanned = null,
  initialTasks = [],
}: WebsiteTabProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  const [profile, setProfile] = useState<WebsiteProfile>({
    url: initialUrl ?? "",
    score: initialScore,
    analysis_status: initialStatus,
    description: initialSummary,
    last_scanned_at: initialLastScanned,
  });

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [reAnalyzeMsg, setReAnalyzeMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "todo" | "done">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [screenshotUsed, setScreenshotUsed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Monotonically-increasing counter — lets us discard stale refresh responses
  const refreshGenRef = useRef(0);

  const isDirty = url.trim() !== savedUrl.trim();
  const normalized = normalizeUrl(url);
  const urlValid = !url.trim() || isValidUrl(normalized);
  const hasSavedUrl = Boolean(savedUrl);
  const status = profile.analysis_status;

  // ── Fetch fresh data ────────────────────────────────────────
  // Returns the fetched status so callers can decide whether to stop polling.
  // The `gen` argument is compared against refreshGenRef to discard results
  // that arrived out-of-order (prevents a slow earlier call from overwriting
  // a faster later one).
  const refresh = useCallback(async (gen?: number): Promise<AnalysisStatus | null> => {
    const [profileRes, tasksRes] = await Promise.all([
      fetch("/api/website"),
      fetch("/api/website/tasks"),
    ]);
    // If a newer refresh has been issued since we started, discard this result
    if (gen !== undefined && gen < refreshGenRef.current) return null;
    let newStatus: AnalysisStatus | null = null;
    if (profileRes.ok) {
      const d = await profileRes.json();
      if (d.profile) {
        setProfile(d.profile);
        newStatus = d.profile.analysis_status as AnalysisStatus;
      }
    }
    if (tasksRes.ok) {
      const d = await tasksRes.json();
      if (d.tasks) setTasks(d.tasks);
    }
    return newStatus;
  }, []);

  // ── Poll while analyzing ────────────────────────────────────
  useEffect(() => {
    if (status !== "analyzing") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    // Poll immediately on mount (catches mid-analysis page loads)
    const gen = ++refreshGenRef.current;
    refresh(gen);

    // Then poll every 4s
    pollRef.current = setInterval(async () => {
      const pollGen = ++refreshGenRef.current;
      const newStatus = await refresh(pollGen);
      // Stop polling once finished
      if (newStatus !== null && newStatus !== "analyzing") {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 4000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ── Save URL ────────────────────────────────────────────────
  async function handleSave() {
    const toSave = normalizeUrl(url);
    if (!toSave || !isValidUrl(toSave)) {
      setSaveError("Please enter a valid URL");
      setSaveStatus("error");
      return;
    }
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: toSave }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSavedUrl(data.profile.url);
      setUrl(data.profile.url);
      setProfile((p) => ({ ...p, url: data.profile.url }));
      setSaveStatus("success");
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Error saving");
      setSaveStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // ── Trigger Analysis ────────────────────────────────────────
  function handleAnalyze() {
    setProfile((p) => ({ ...p, analysis_status: "analyzing", analysis_error: null }));
    setTasks([]);
    setReAnalyzeMsg(null);
    setScreenshotUsed(false);

    // Bump the generation NOW so any in-flight refresh from the polling
    // useEffect (which fires immediately when status → "analyzing") will be
    // treated as stale once our own refresh arrives below.
    const analyzeGen = ++refreshGenRef.current;

    // Try to use the direct response when Claude finishes within the timeout window.
    // If the request takes longer than the browser/server allows, the polling
    // interval (set up by the useEffect above) will detect completion from the DB.
    fetch("/api/website/analyze", { method: "POST" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.screenshotUsed) setScreenshotUsed(true);
        }
        // Whether success or error — do one authoritative refresh after the API settles.
        // Bump gen again so this is the freshest result.
        const finalGen = ++refreshGenRef.current;
        await refresh(finalGen);
      })
      .catch(() => {
        // Network/timeout — polling will handle it; mark this gen as consumed
        // so subsequent poll cycles (which bump their own gen) win correctly.
        void analyzeGen;
      });
  }

  // ── Complete task ───────────────────────────────────────────
  async function handleComplete(taskId: string) {
    setCompletingId(taskId);
    try {
      const res = await fetch(`/api/website/tasks/${taskId}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTasks((prev) =>
        prev.map((t) => t.id === taskId ? { ...t, completed: true, completed_at: new Date().toISOString() } : t)
      );
      setProfile((p) => ({ ...p, score: data.newScore }));

      if (data.allTasksDone) {
        if (data.newScore >= 95) {
          setReAnalyzeMsg("� Exceptional score! Re-analyze to find the final micro-improvements.");
        } else {
          setReAnalyzeMsg("� Round complete! Run a new analysis to get the next batch of improvements.");
        }
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setCompletingId(null);
    }
  }

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const potentialGain = pendingTasks.reduce((s, t) => s + t.impact_score, 0);

  // Active categories in the current task list
  const activeCategories = Array.from(new Set(tasks.map((t) => t.category)));

  // Filtered view
  const filteredTasks = tasks.filter((t) => {
    const statusMatch =
      filterStatus === "all" ? true :
      filterStatus === "todo" ? !t.completed :
      t.completed;
    const catMatch = filterCategory === "all" || t.category === filterCategory;
    return statusMatch && catMatch;
  });
  const filteredPending = filteredTasks.filter((t) => !t.completed);
  const filteredDone = filteredTasks.filter((t) => t.completed);

  if (!isPremium) {
    return (
      <div className="w-full">
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">Website Optimizer</h1>
          <p className="mt-1 text-sm text-[#bcbcd8]">Analyze your website and get an improvement roadmap.</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 py-16 px-6 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#a78bfa]/20 bg-[#a78bfa]/10 text-[#a78bfa]">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa] mb-2">Premium Feature</p>
          <h2 className="font-mono text-xl font-bold text-[#f8f8fc] mb-3">Website Optimizer requires Premium</h2>
          <p className="text-sm text-[#bcbcd8] max-w-sm mb-6">
            Upgrade to analyze your website, get a health score, and receive a prioritized list of improvements.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-7 w-full max-w-sm text-left">
            {[
              "AI-powered website scan",
              "Health score 0–100",
              "Prioritized task list",
              "UX, SEO & performance",
              "Conversion optimization",
              "Re-analyze anytime",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="font-mono text-[10px] text-[#bcbcd8]">{f}</span>
              </div>
            ))}
          </div>
          <a
            href="/api/stripe/checkout"
            className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-7 py-3 font-mono text-sm font-bold text-[#13131f] hover:bg-[#00bfa0] transition"
          >
            Start 7-day free trial →
          </a>
          <p className="mt-3 font-mono text-[10px] text-[#8585aa]">$29/mo after trial · Cancel anytime</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">Website Optimizer</h1>
          {profile.score >= 95 && (
            <span className="font-mono text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#00d4aa]/40 text-[#00d4aa] bg-[#00d4aa]/10">
              🏆 Perfect
            </span>
          )}
        </div>
        <p className="text-sm text-[#bcbcd8]">
          AI analyzes your website and gives you a prioritized task list to reach a perfect 100 score.
        </p>
      </div>

      {/* ── URL Input Card ───────────────────────────────────── */}
      <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">Website URL</p>
          {savedUrl && profile.analysis_status === "done" && (
            <span className="inline-flex items-center gap-1 font-mono text-[9px] text-[#00d4aa]">
              <span className="h-1 w-1 rounded-full bg-[#00d4aa]" />
              Active
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <span className="font-mono text-xs text-[#8585aa]">https://</span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={url.replace(/^https?:\/\//i, "")}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="yoursite.com"
              disabled={status === "analyzing"}
              className={`w-full rounded-xl border bg-[#222235] py-3 pl-16 pr-4 font-mono text-sm text-[#f8f8fc] placeholder-[#2e2e4e] outline-none transition-all focus:ring-2 disabled:opacity-50 ${
                !urlValid && url
                  ? "border-red-500/50 focus:border-red-500/80 focus:ring-red-500/10"
                  : "border-[#363650] focus:border-[#00d4aa]/50 focus:ring-[#00d4aa]/8"
              }`}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !url.trim() || !urlValid || !isDirty || status === "analyzing"}
            className="shrink-0 rounded-xl border border-[#363650] bg-[#222235] px-4 py-2.5 font-mono text-xs font-semibold text-[#bcbcd8] transition-all hover:border-[#00d4aa]/30 hover:text-[#00d4aa] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {saveStatus === "success" && (
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-[#00d4aa]">
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            URL saved
          </p>
        )}
        {saveStatus === "error" && (
          <p className="font-mono text-[11px] text-red-400">✗ {saveError}</p>
        )}
      </div>

      {/* ── State: no URL ─────────────────────────────────────── */}
      {!hasSavedUrl && (
        <div className="rounded-2xl border border-dashed border-[#363650] p-10 text-center">
          <p className="text-2xl mb-3">🌐</p>
          <p className="font-mono text-sm text-[#8585aa] mb-4">
            Add your website URL above to get an AI-powered optimization score
          </p>
          <button
            onClick={() => inputRef.current?.focus()}
            className="font-mono text-xs font-semibold text-[#00d4aa] hover:underline"
          >
            Enter your URL →
          </button>
        </div>
      )}

      {/* ── State: idle + URL saved (not yet analyzed) ────────── */}
      {hasSavedUrl && status === "idle" && tasks.length === 0 && (
        <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-10 text-center space-y-4">
          <p className="text-3xl">🤖</p>
          <div>
            <p className="font-mono text-sm font-semibold text-[#f8f8fc]">Ready to analyze</p>
            <p className="mt-1 text-xs text-[#8585aa]">
              Our AI will scan <span className="text-[#00d4aa]">{savedUrl}</span> and generate a personalized improvement plan.
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-6 py-3 font-mono text-xs font-semibold text-[#1c1c2a] transition hover:bg-[#00d4aa]/90"
          >
            <span>⚡</span> Analyze Website
          </button>
        </div>
      )}

      {/* ── State: analyzing ───────────────────────────────────── */}
      {status === "analyzing" && <AnalyzingSkeleton url={savedUrl} />}

      {/* ── State: error ───────────────────────────────────────── */}
      {status === "error" && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-3">
          <p className="font-mono text-sm font-semibold text-red-400">✗ Analysis failed</p>
          {profile.analysis_error && (
            <p className="font-mono text-xs text-[#8585aa]">{profile.analysis_error}</p>
          )}
          <button
            onClick={handleAnalyze}
            className="font-mono text-xs font-semibold text-[#00d4aa] hover:underline"
          >
            Try again →
          </button>
        </div>
      )}

      {/* ── State: done — Score + Tasks ───────────────────────── */}
      {(status === "done" || (status === "idle" && tasks.length > 0)) && (
        <div className="space-y-6">

          {/* Score card */}
          <div
            className="rounded-2xl border p-6 transition-colors"
            style={{ borderColor: scoreColor(profile.score) + "30", backgroundColor: scoreColor(profile.score) + "05" }}
          >
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ScoreCircle score={profile.score} animating />
              <div className="flex-1 space-y-3 text-center sm:text-left">
                {profile.description && (
                  <p className="text-sm leading-relaxed text-[#bcbcd8]">{profile.description}</p>
                )}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-[10px] text-[#8585aa]">Progress to 100</span>
                    <span className="font-mono text-[10px] text-[#8585aa]">
                      {pendingTasks.length > 0 ? `+${potentialGain} pts available` : ""}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#363650]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${profile.score}%`, backgroundColor: scoreColor(profile.score) }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                  {screenshotUsed && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#a78bfa]/10 border border-[#a78bfa]/20 px-2.5 py-1 font-mono text-[10px] text-[#a78bfa]">
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      AI Vision analysis
                    </span>
                  )}
                  {profile.last_scanned_at && (
                    <span className="font-mono text-[10px] text-[#8585aa]">
                      Last analyzed {timeAgo(profile.last_scanned_at)}
                    </span>
                  )}
                  <button
                    onClick={handleAnalyze}
                    disabled={profile.analysis_status === "analyzing"}
                    className="font-mono text-[10px] font-semibold text-[#00d4aa] hover:underline disabled:opacity-40"
                  >
                    Re-analyze →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Re-analyze prompt */}
          {reAnalyzeMsg && (
            <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-4 py-3 flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-[#00d4aa]">{reAnalyzeMsg}</p>
              <button
                onClick={handleAnalyze}
                className="shrink-0 rounded-lg bg-[#00d4aa] px-4 py-1.5 font-mono text-[11px] font-semibold text-[#1c1c2a] hover:bg-[#00d4aa]/90"
              >
                New Analysis
              </button>
            </div>
          )}

          {/* ── Filter bar ─────────────────────────────────── */}
          {tasks.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {/* Status pills */}
              <div className="flex rounded-xl border border-[#363650] overflow-hidden">
                {(["all", "todo", "done"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                      filterStatus === s
                        ? "bg-[#363650] text-[#f8f8fc]"
                        : "text-[#8585aa] hover:text-[#bcbcd8]"
                    }`}
                  >
                    {s === "all" ? `All (${tasks.length})` : s === "todo" ? `Todo (${pendingTasks.length})` : `Done (${completedTasks.length})`}
                  </button>
                ))}
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterCategory("all")}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest transition-colors ${
                    filterCategory === "all"
                      ? "border-[#bcbcd8]/40 bg-[#bcbcd8]/10 text-[#bcbcd8]"
                      : "border-[#363650] text-[#8585aa] hover:text-[#bcbcd8]"
                  }`}
                >
                  All types
                </button>
                {activeCategories.map((cat) => {
                  const meta = CATEGORY_META[cat] ?? { label: cat, color: "#bcbcd8", icon: "•" };
                  const active = filterCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(active ? "all" : cat)}
                      className="rounded-full border px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest transition-all"
                      style={{
                        color: active ? meta.color : "#8585aa",
                        borderColor: active ? `${meta.color}50` : "#363650",
                        backgroundColor: active ? `${meta.color}12` : "transparent",
                      }}
                    >
                      {meta.icon} {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending tasks */}
          {filteredPending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#8585aa]">
                  Improvement Tasks ({filteredPending.length})
                </p>
                <div className="flex-1 border-t border-[#363650]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPending.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    completing={completingId === task.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed tasks */}
          {filteredDone.length > 0 && (
            <details className="group" open={filterStatus === "done"}>
              <summary className="flex cursor-pointer items-center gap-2 list-none">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#2e2e4e]">
                  Completed ({filteredDone.length})
                </p>
                <div className="flex-1 border-t border-[#363650]/50" />
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className="text-[#2e2e4e] transition-transform group-open:rotate-180"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredDone.map((task) => (
                  <TaskCard key={task.id} task={task} onComplete={handleComplete} completing={false} />
                ))}
              </div>
            </details>
          )}

          {/* Empty state when filter returns nothing */}
          {filteredTasks.length === 0 && tasks.length > 0 && (
            <div className="rounded-xl border border-dashed border-[#363650] p-6 text-center">
              <p className="font-mono text-xs text-[#8585aa]">No tasks match the current filter.</p>
              <button
                onClick={() => { setFilterStatus("all"); setFilterCategory("all"); }}
                className="mt-2 font-mono text-[11px] font-semibold text-[#00d4aa] hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
