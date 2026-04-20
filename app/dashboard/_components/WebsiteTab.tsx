"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";

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

const CATEGORY_META: Record<string, { label: string; color: string; icon: ReactNode }> = {
  ux: {
    label: "UX", color: "#a78bfa",
    icon: (
      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
  },
  performance: {
    label: "Performance", color: "#60a5fa",
    icon: (
      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
  },
  seo: {
    label: "SEO", color: "#34d399",
    icon: (
      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  copy: {
    label: "Copy", color: "#f59e0b",
    icon: (
      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  conversion: {
    label: "Conversion", color: "#f87171",
    icon: (
      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  accessibility: {
    label: "Accessibility", color: "#00d4aa",
    icon: (
      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="1"/><path d="M9 20l3-9 3 9"/><path d="M6 9h12"/>
      </svg>
    ),
  },
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

// ── Task Row (left column) ────────────────────────────────────────────────

function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
}) {
  const cat = CATEGORY_META[task.category] ?? { label: task.category, color: "#bcbcd8", icon: <span>·</span> };
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left relative flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 ${
        task.completed
          ? selected
            ? "border-[#2e2e4e] bg-[#0f0f14] opacity-60"
            : "border-transparent bg-transparent opacity-40 hover:opacity-60"
          : selected
          ? "border-[#2e2e4e] bg-[#111118]"
          : "border-transparent bg-transparent hover:bg-[#0f0f14]/60"
      }`}
    >
      {/* selected indicator */}
      {selected && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: task.completed ? "#454560" : `${cat.color}66` }} />
      )}

      {/* category dot */}
      <div className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.completed ? "#2e2e4e" : `${cat.color}88` }} />

      {/* title */}
      <span className={`flex-1 text-xs leading-snug truncate ${task.completed ? "line-through text-[#3a3a5a]" : selected ? "text-[#d0d0e8]" : "text-[#9090b0]"}`}>
        {task.title}
      </span>

      {/* impact */}
      <span className={`shrink-0 font-mono text-[10px] ${task.completed ? "text-[#3a3a5a]" : "text-[#5a5a7a]"}`}>+{task.impact_score}</span>

      {/* done tick */}
      {task.completed && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <path d="M1.5 5l2.5 2.5 4.5-5" stroke="#454560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ── Task Detail (right panel) ─────────────────────────────────────────────

function TaskDetail({
  task,
  onComplete,
  completing,
}: {
  task: Task;
  onComplete: (id: string) => void;
  completing: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const cat = CATEGORY_META[task.category] ?? { label: task.category, color: "#bcbcd8", icon: <span>·</span> };

  // Reset confirming when selected task changes
  useEffect(() => { setConfirming(false); }, [task.id]);

  return (
    <div className="flex flex-col h-full rounded-lg border border-[#1e1e2e] bg-[#0c0c12] overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[#1a1a28]">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ backgroundColor: `${cat.color}10` }}>
          <span style={{ color: `${cat.color}aa` }}>{cat.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: `${cat.color}88` }}>{cat.label}</p>
          <p className={`text-sm font-semibold leading-snug ${task.completed ? "line-through text-[#3a3a5a]" : "text-[#d0d0e8]"}`}>
            {task.title}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#6a6a8a] bg-[#1a1a28] px-2 py-0.5 rounded">
            +{task.impact_score} pts
          </span>
        </div>
      </div>

      {/* description */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {task.completed ? (
          <p className="text-xs text-[#3a3a5a] leading-relaxed">{task.description}</p>
        ) : (
          <p className="text-[13px] text-[#8080a8] leading-relaxed">{task.description}</p>
        )}
      </div>

      {/* footer */}
      <div className="px-5 pb-5 pt-3 border-t border-[#1a1a28]">
        {task.completed ? (
          <div className="flex items-center gap-2 text-[#3a3a5a]">
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 4.5-5" stroke="#3a3a5a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-mono text-[10px]">Completed</span>
          </div>
        ) : confirming ? (
          <div className="flex items-center gap-3">
            <span className="flex-1 font-mono text-[11px] text-[#8585aa]">
              Mark as done and add <span className="text-[#bcbcd8] font-semibold">+{task.impact_score} pts</span>?
            </span>
            <button
              onClick={() => { setConfirming(false); onComplete(task.id); }}
              className="rounded-lg bg-[#00d4aa] px-4 py-1.5 font-mono text-[10px] font-semibold text-[#0c0c12] hover:bg-[#00bfa0] transition"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-[#2e2e4e] px-4 py-1.5 font-mono text-[10px] text-[#6a6a8a] hover:text-[#bcbcd8] transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={completing}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-[11px] font-semibold transition ${
              completing
                ? "border-[#2e2e4e] text-[#3a3a5a] cursor-wait animate-pulse"
                : "border-[#2e2e4e] text-[#6a6a8a] hover:border-[#00d4aa]/40 hover:text-[#00d4aa]"
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2.5 5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Mark as done
          </button>
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTasks.length > 0 ? initialTasks[0].id : null
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether the "analyzing" state was triggered locally (button click)
  // vs loaded from the server (page load while analysis was already running).
  // When triggered locally we skip the immediate poll — the API hasn't had time
  // to update the DB yet, so an instant poll would return stale "done" status.
  const locallyTriggeredRef = useRef(false);

  const isDirty = url.trim() !== savedUrl.trim();
  const normalized = normalizeUrl(url);
  const urlValid = !url.trim() || isValidUrl(normalized);
  const hasSavedUrl = Boolean(savedUrl);
  const status = profile.analysis_status;

  // ── Fetch fresh data ────────────────────────────────────────
  const refresh = useCallback(async (): Promise<AnalysisStatus | null> => {
    const [profileRes, tasksRes] = await Promise.all([
      fetch("/api/website"),
      fetch("/api/website/tasks"),
    ]);
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
      if (d.tasks) {
        setTasks(d.tasks);
        // Auto-select first pending task when new tasks arrive
        setSelectedTaskId((prev) => {
          const all: Task[] = d.tasks;
          if (prev && all.find((t: Task) => t.id === prev)) return prev;
          const first = all.find((t: Task) => !t.completed) ?? all[0];
          return first?.id ?? null;
        });
      }
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

    // Only poll immediately when the component LOADED with status=analyzing
    // (e.g. page refresh mid-analysis). When the user just clicked "Analyze",
    // the API hasn't updated the DB yet — an instant poll would return the
    // stale "done" status from the previous analysis, killing the interval early.
    if (!locallyTriggeredRef.current) {
      refresh();
    }
    locallyTriggeredRef.current = false;

    // Poll every 4s — DB will reflect "done"/"error" once the API finishes
    pollRef.current = setInterval(async () => {
      const newStatus = await refresh();
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
    // Flag so the polling useEffect skips its immediate refresh — the API
    // hasn't had time to write "analyzing" to the DB yet, so an instant
    // poll would return the stale previous status and kill the interval.
    locallyTriggeredRef.current = true;

    // Optimistically show the skeleton. Do NOT wipe tasks here — if the API
    // returns an early error (rate limit, auth, etc.) the DB profile never
    // changes and we'd be stuck with status="done" + empty task list (blank).
    setProfile((p) => ({ ...p, analysis_status: "analyzing", analysis_error: null }));
    setReAnalyzeMsg(null);
    setScreenshotUsed(false);

    // Fire-and-forget. The 4s polling interval (set up by the useEffect above)
    // is the primary completion detector. The .then() just triggers an early
    // refresh when the API responds within the request window so we don't have
    // to wait for the next poll tick.
    fetch("/api/website/analyze", { method: "POST" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.screenshotUsed) setScreenshotUsed(true);
        }
        // Refresh regardless of ok/error to reflect whatever the DB settled on.
        // If the interval is still running it will detect the status change and
        // clean itself up via the useEffect — no need to stop it here.
        await refresh();
      })
      .catch(() => {
        // Network / server timeout — the polling interval keeps running and
        // will detect "done" / "error" when the DB updates. Do nothing here.
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
  const filteredPending = filteredTasks.filter((t) => !t.completed).sort((a, b) => b.impact_score - a.impact_score);
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <h1 className="font-mono text-xl font-bold text-[#f8f8fc]">Website Optimizer</h1>
            {profile.score >= 95 && (
              <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#00d4aa]/40 text-[#00d4aa] bg-[#00d4aa]/10">
                <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Perfect
              </span>
            )}
          </div>
          <p className="font-mono text-[11px] text-[#8585aa]">AI scans your site and builds a prioritized improvement roadmap.</p>
        </div>

        {/* Inline URL input */}
        <div className="flex items-center gap-2 flex-1 min-w-65 max-w-md">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-[11px] text-[#58588a]">https://</span>
            <input
              ref={inputRef}
              type="text"
              value={url.replace(/^https?:\/\//i, "")}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="yoursite.com"
              disabled={status === "analyzing"}
              className={`w-full rounded-xl border bg-[#1c1c2a] py-2 pl-14 pr-3 font-mono text-xs text-[#f8f8fc] placeholder-[#2e2e4e] outline-none transition-all focus:ring-1 disabled:opacity-50 ${
                !urlValid && url
                  ? "border-red-500/40 focus:border-red-500/60 focus:ring-red-500/10"
                  : "border-[#363650] focus:border-[#00d4aa]/40 focus:ring-[#00d4aa]/8"
              }`}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !url.trim() || !urlValid || !isDirty || status === "analyzing"}
            className="shrink-0 rounded-xl border border-[#363650] bg-[#222235] px-3 py-2 font-mono text-[11px] font-semibold text-[#bcbcd8] transition-all hover:border-[#00d4aa]/30 hover:text-[#00d4aa] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
      </div>

      {/* Save status feedback */}
      {saveStatus === "success" && (
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-[#00d4aa]">
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          URL saved
        </p>
      )}
      {saveStatus === "error" && (
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-red-400">
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {saveError}
        </p>
      )}

      {/* ── State: no URL ─────────────────────────────────────── */}
      {!hasSavedUrl && (
        <div className="rounded-2xl border border-dashed border-[#363650] p-12 text-center">
          <p className="font-mono text-sm text-[#58588a]">Enter your website URL above to get started</p>
        </div>
      )}

      {/* ── State: idle + URL saved (not yet analyzed) ────────── */}
      {hasSavedUrl && status === "idle" && tasks.length === 0 && (
        <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/40 p-8 flex flex-col sm:flex-row items-center gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#635bff]/10">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#635bff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-mono text-sm font-semibold text-[#f8f8fc]">Ready to analyze</p>
            <p className="mt-0.5 font-mono text-[11px] text-[#8585aa]">
              <span className="text-[#00d4aa]">{savedUrl}</span>
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-5 py-2.5 font-mono text-xs font-semibold text-[#13131f] transition hover:bg-[#00bfa0]"
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            Analyze
          </button>
        </div>
      )}

      {/* ── State: analyzing ───────────────────────────────────── */}
      {status === "analyzing" && <AnalyzingSkeleton url={savedUrl} />}

      {/* ── State: error ───────────────────────────────────────── */}
      {status === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 flex items-center gap-4">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs font-semibold text-red-400">Analysis failed</p>
            {profile.analysis_error && <p className="font-mono text-[10px] text-[#8585aa] truncate">{profile.analysis_error}</p>}
          </div>
          <button onClick={handleAnalyze} className="shrink-0 font-mono text-xs font-semibold text-[#00d4aa] hover:underline">
            Retry →
          </button>
        </div>
      )}

      {/* ── State: done — Score + Tasks ───────────────────────── */}
      {(status === "done" || (status === "idle" && tasks.length > 0)) && (
        <div className="space-y-5">

          {/* Score strip — horizontal, lightweight */}
          <div className="flex items-center gap-5 rounded-2xl border border-[#363650] bg-[#1c1c2a]/40 px-5 py-4">
            {/* Mini score circle */}
            <div className="relative shrink-0 flex items-center justify-center">
              <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
                <circle cx="36" cy="36" r="28" fill="none" stroke="#363650" strokeWidth="6" />
                <circle
                  cx="36" cy="36" r="28"
                  fill="none"
                  stroke={scoreColor(profile.score)}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 28}
                  strokeDashoffset={2 * Math.PI * 28 * (1 - profile.score / 100)}
                  style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-mono text-lg font-bold leading-none" style={{ color: scoreColor(profile.score) }}>{profile.score}</span>
                <span className="font-mono text-[8px] text-[#8585aa]">/100</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold" style={{ color: scoreColor(profile.score) }}>{scoreLabel(profile.score)}</span>
                {pendingTasks.length > 0 && (
                  <span className="font-mono text-[10px] text-[#8585aa]">· +{potentialGain} pts available</span>
                )}
              </div>
              {profile.description && (
                <p className="font-mono text-[11px] text-[#8585aa] leading-relaxed line-clamp-2">{profile.description}</p>
              )}
              <div className="h-1.5 w-full rounded-full bg-[#363650]">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${profile.score}%`, backgroundColor: scoreColor(profile.score) }} />
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex flex-col items-end gap-2">
              <button
                onClick={handleAnalyze}
                disabled={profile.analysis_status === "analyzing"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#363650] px-3 py-1.5 font-mono text-[10px] font-semibold text-[#bcbcd8] transition hover:border-[#00d4aa]/40 hover:text-[#00d4aa] disabled:opacity-30"
              >
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                Re-analyze
              </button>
              {profile.last_scanned_at && (
                <span className="font-mono text-[9px] text-[#58588a]">{timeAgo(profile.last_scanned_at)}</span>
              )}
            </div>
          </div>

          {/* Re-analyze prompt */}
          {reAnalyzeMsg && (
            <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-4 py-3 flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] text-[#00d4aa]">{reAnalyzeMsg}</p>
              <button onClick={handleAnalyze} className="shrink-0 rounded-lg bg-[#00d4aa] px-3 py-1.5 font-mono text-[10px] font-semibold text-[#13131f] hover:bg-[#00bfa0]">
                New scan
              </button>
            </div>
          )}

          {/* ── Task master-detail ─────────────────────────── */}
          {tasks.length > 0 && (
            <div className="space-y-3">
              {/* Category progress cards */}
              {pendingTasks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeCategories.map((cat) => {
                    const meta = CATEGORY_META[cat] ?? { label: cat, color: "#bcbcd8", icon: <span>·</span> };
                    const catPending = pendingTasks.filter((t) => t.category === cat);
                    const catPts = catPending.reduce((s, t) => s + t.impact_score, 0);
                    if (catPending.length === 0) return null;
                    const isActive = filterCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => { setFilterCategory(isActive ? "all" : cat); setFilterStatus("todo"); }}
                        className="flex items-center gap-2 rounded-xl border px-3 py-2 transition-all text-left"
                        style={{
                          borderColor: isActive ? `${meta.color}60` : "#363650",
                          backgroundColor: isActive ? `${meta.color}10` : "#1c1c2a",
                        }}
                      >
                        <span style={{ color: meta.color }}>{meta.icon}</span>
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-widest font-semibold" style={{ color: meta.color }}>{meta.label}</p>
                          <p className="font-mono text-[9px] text-[#8585aa]">{catPending.length} task{catPending.length !== 1 ? "s" : ""} · <span style={{ color: meta.color }}>+{catPts} pts</span></p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                {(["all", "todo", "done"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest transition-colors ${
                      filterStatus === s
                        ? "border-[#454560] bg-[#363650] text-[#f8f8fc]"
                        : "border-[#363650] text-[#8585aa] hover:text-[#bcbcd8]"
                    }`}
                  >
                    {s === "all" ? `All · ${tasks.length}` : s === "todo" ? `Todo · ${pendingTasks.length}` : `Done · ${completedTasks.length}`}
                  </button>
                ))}
                <div className="w-px h-4 bg-[#363650]" />
                {filterCategory !== "all" && (
                  <button onClick={() => setFilterCategory("all")} className="font-mono text-[9px] text-[#58588a] hover:text-[#bcbcd8]">× clear</button>
                )}
                {activeCategories.map((cat) => {
                  const meta = CATEGORY_META[cat] ?? { label: cat, color: "#bcbcd8", icon: <span>·</span> };
                  const active = filterCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(active ? "all" : cat)}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest transition-all"
                      style={{
                        color: active ? meta.color : "#8585aa",
                        borderColor: active ? `${meta.color}50` : "#363650",
                        backgroundColor: active ? `${meta.color}12` : "transparent",
                      }}
                    >
                      <span style={{ color: active ? meta.color : "#58588a" }}>{meta.icon}</span>
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              {/* Two-column master-detail */}
              {filteredTasks.length > 0 ? (
                <div className="flex gap-3 min-h-105">
                  {/* Left: task list */}
                  <div className="w-64 shrink-0 flex flex-col gap-0.5 overflow-y-auto pr-1">
                    {filteredPending.length > 0 && (
                      <>
                        <p className="font-mono text-[8px] uppercase tracking-widest text-[#3a3a5a] px-3 pt-1 pb-1">
                          To do · {filteredPending.length}
                        </p>
                        {filteredPending.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            selected={selectedTaskId === task.id}
                            onSelect={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </>
                    )}
                    {filteredDone.length > 0 && (
                      <>
                        <p className="font-mono text-[8px] uppercase tracking-widest text-[#3a3a5a] px-3 pt-3 pb-1">
                          Done · {filteredDone.length}
                        </p>
                        {filteredDone.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            selected={selectedTaskId === task.id}
                            onSelect={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </>
                    )}
                  </div>

                  {/* Right: detail panel */}
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const sel = filteredTasks.find((t) => t.id === selectedTaskId) ?? filteredTasks[0];
                      return sel ? (
                        <TaskDetail
                          task={sel}
                          onComplete={handleComplete}
                          completing={completingId === sel.id}
                        />
                      ) : null;
                    })()}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#363650] p-6 text-center">
                  <p className="font-mono text-xs text-[#8585aa]">No tasks match this filter.</p>
                  <button onClick={() => { setFilterStatus("all"); setFilterCategory("all"); }} className="mt-1.5 font-mono text-[10px] font-semibold text-[#00d4aa] hover:underline">
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
