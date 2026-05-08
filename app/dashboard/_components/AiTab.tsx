"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Tab } from "./DashboardShell";
import React from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Insight {
  id: string;
  content: string;
  created_at: string;
}

interface AiTabProps {
  isPremium: boolean;
  isDemo?: boolean;
  onNavigate?: (tab: Tab) => void;
}

type Goal = "grow_mrr" | "reduce_churn" | "scale_ads" | null;

// ── Goal helpers ───────────────────────────────────────────────────────────
const GOAL_OPTIONS: { id: Goal; label: string; icon: React.ReactElement; color: string }[] = [
  { id: "grow_mrr",      label: "Grow MRR",     color: "#00d4aa", icon: <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: "reduce_churn",  label: "Reduce Churn", color: "#f59e0b", icon: <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg> },
  { id: "scale_ads",     label: "Scale Ads",    color: "#a78bfa", icon: <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg> },
];

function loadGoal(): Goal {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem("aiGoal");
  return (v as Goal) ?? null;
}
function saveGoal(g: Goal) {
  if (typeof window === "undefined") return;
  if (g) localStorage.setItem("aiGoal", g);
  else localStorage.removeItem("aiGoal");
}

/** Map content keywords → tabs to suggest */
function inferInvestigateTabs(content: string): { tab: Tab; label: string; icon: React.ReactElement }[] {
  const c = content.toLowerCase();
  const tabs: { tab: Tab; label: string; icon: React.ReactElement }[] = [];
  if (c.includes("revenue") || c.includes("mrr") || c.includes("stripe")) tabs.push({ tab: "revenue", label: "Revenue", icon: <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> });
  if (c.includes("traffic") || c.includes("session") || c.includes("ga4"))  tabs.push({ tab: "website", label: "Website", icon: <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253M3.284 14.253A8.959 8.959 0 013 12c0-.778.099-1.533.284-2.253" /></svg> });
  if (c.includes("ad") || c.includes("meta") || c.includes("roas"))         tabs.push({ tab: "marketing", label: "Marketing", icon: <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg> });
  if (c.includes("churn") || c.includes("customer"))                        tabs.push({ tab: "customers", label: "Customers", icon: <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> });
  return tabs;
}

// ── Inline bold renderer ───────────────────────────────────────────────────
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} style={{ color: "#a5b4fc", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ── Insight parser ─────────────────────────────────────────────────────────
interface ParsedObservation {
  severity: "critical" | "warning" | "positive" | "info";
  title: string;
  body: string;
}
interface ParsedAction {
  number: number;
  category: string;
  priority: "high" | "medium" | "quick";
  title: string;
  description: string;
}
interface ParsedInsight {
  snapshot: string;
  observations: ParsedObservation[];
  actions: ParsedAction[];
  keyInsight: string;
}

function severityOf(text: string): ParsedObservation["severity"] {
  const t = text.toLowerCase();
  if (/0%|drop|spike|critical|zero|none|no /.test(t)) return "critical";
  if (/low|below|warn|risk|declin|slow/.test(t)) return "warning";
  if (/up|increas|grow|strong|above/.test(t)) return "positive";
  return "info";
}

function severityColor(s: ParsedObservation["severity"]) {
  return s === "critical" ? "#ef4444" : s === "warning" ? "#f59e0b" : s === "positive" ? "#10b981" : "#6366f1";
}
function SeverityIcon({ severity }: { severity: ParsedObservation["severity"] }) {
  const color = severityColor(severity);
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="5" cy="5" r="5" fill={color} />
    </svg>
  );
}

function actionPriority(title: string): ParsedAction["priority"] {
  const t = title.toLowerCase();
  if (/urgent|critical|asap|immediately/.test(t)) return "high";
  if (/quick|easy|simple|today/.test(t)) return "quick";
  return "medium";
}
function priorityColor(p: ParsedAction["priority"]) {
  return p === "high" ? "#ef4444" : p === "quick" ? "#10b981" : "#f59e0b";
}
function priorityLabel(p: ParsedAction["priority"]) {
  return p === "high" ? "High" : p === "quick" ? "Quick Win" : "Medium";
}

function parseInsightContent(raw: string): ParsedInsight {
  // Split on bold headers (**Header**) or ## headers
  const sectionRe = /^(?:\*\*([^*]+)\*\*|##\s*(.+))$/m;
  const lines = raw.split("\n");

  type Section = { header: string; lines: string[] };
  const sections: Section[] = [];
  let current: Section = { header: "", lines: [] };

  for (const line of lines) {
    const m = line.match(/^(?:\*\*([^*\n]+)\*\*|##\s*(.+))$/);
    if (m) {
      if (current.lines.some((l) => l.trim())) sections.push(current);
      current = { header: (m[1] || m[2] || "").trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((l) => l.trim())) sections.push(current);

  // Find snapshot section
  const snapSec = sections.find((s) =>
    /snapshot|overview|summary|revenue|today/i.test(s.header) || s.header === ""
  );
  const snapshot = snapSec ? snapSec.lines.join("\n").trim() : "";

  // Observation sections
  const obsSections = sections.filter((s) =>
    /observation|highlight|finding|notice|signal|where|what/i.test(s.header)
  );
  let observations: ParsedObservation[] = [];
  for (const sec of obsSections) {
    for (const line of sec.lines) {
      const t = line.replace(/^[-*]\s*/, "").trim();
      if (!t) continue;
      const colonIdx = t.indexOf("—");
      const title = colonIdx > 0 ? t.slice(0, colonIdx).trim() : t.slice(0, 60);
      const body  = colonIdx > 0 ? t.slice(colonIdx + 1).trim() : t;
      observations.push({ severity: severityOf(t), title, body });
    }
  }
  // Fallback: any bullet lines from all sections
  if (observations.length === 0) {
    for (const sec of sections) {
      for (const line of sec.lines) {
        if (!/^[-*]\s/.test(line)) continue;
        const t = line.replace(/^[-*]\s*/, "").trim();
        if (!t) continue;
        const colonIdx = t.indexOf("—");
        const title = colonIdx > 0 ? t.slice(0, colonIdx).trim() : t.slice(0, 60);
        const body  = colonIdx > 0 ? t.slice(colonIdx + 1).trim() : t;
        observations.push({ severity: severityOf(t), title, body });
      }
    }
  }

  // Action sections
  const actSections = sections.filter((s) =>
    /action|today|recommend|next step|to.do|fix/i.test(s.header)
  );
  const actions: ParsedAction[] = [];
  for (const sec of actSections) {
    let n = 0;
    for (const line of sec.lines) {
      const m = line.match(/^(\d+)\.\s+(.+)/);
      if (!m) continue;
      n++;
      const full = m[2].trim();
      // Try to split "Category: title — description"
      const colonIdx = full.indexOf(":");
      const dashIdx  = full.indexOf("—");
      let category = "Action";
      let title = full;
      let description = "";
      if (colonIdx > 0 && colonIdx < 30) {
        category = full.slice(0, colonIdx).trim();
        title    = full.slice(colonIdx + 1).trim();
      }
      if (dashIdx > 0) {
        description = title.slice(dashIdx + 1).trim();
        title       = title.slice(0, dashIdx).trim();
      }
      actions.push({ number: n, category, priority: actionPriority(title), title, description });
    }
  }

  // Key insight
  const insightSec = sections.find((s) =>
    /insight|worth|takeaway|honest|contrarian/i.test(s.header)
  );
  const keyInsight = insightSec ? insightSec.lines.join("\n").trim() : "";

  return { snapshot, observations, actions, keyInsight };
}

// ── InsightRenderer ────────────────────────────────────────────────────────
function InsightRenderer({
  content,
  onNavigate,
}: {
  content: string;
  onNavigate?: (tab: Tab) => void;
}) {
  const parsed = parseInsightContent(content);
  const investigateTabs = onNavigate ? inferInvestigateTabs(content) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Snapshot */}
      {parsed.snapshot && (
        <div
          style={{
            background: "#0f172a",
            borderLeft: "4px solid #6366f1",
            borderRadius: "0 8px 8px 0",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6366f1",
              marginBottom: 8,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>Today&apos;s Snapshot</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: "#c7d2fe" }}>
            {parsed.snapshot.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              if (t.startsWith("- ") || t.startsWith("* ")) {
                return (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    <span><InlineText text={t.slice(2)} /></span>
                  </div>
                );
              }
              return <p key={i} style={{ margin: "0 0 6px 0" }}><InlineText text={t} /></p>;
            })}
          </div>
        </div>
      )}

      {/* Observations */}
      {parsed.observations.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8585aa",
            }}
          >
            Signals
          </div>
          {parsed.observations.map((obs, i) => (
            <div
              key={i}
              style={{
                background: "#13131a",
                borderLeft: `3px solid ${severityColor(obs.severity)}`,
                borderRadius: "0 8px 8px 0",
                padding: "10px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <SeverityIcon severity={obs.severity} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#f8f8fc" }}>
                  <InlineText text={obs.title} />
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                <InlineText text={obs.body} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {parsed.actions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8585aa",
            }}
          >
            Recommended Actions
          </div>
          {parsed.actions.map((act, i) => (
            <div
              key={i}
              style={{
                background: "#13131a",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#6366f1",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {act.number}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: "rgba(99,102,241,0.15)",
                      color: "#a5b4fc",
                    }}
                  >
                    {act.category}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: priorityColor(act.priority) + "22",
                      color: priorityColor(act.priority),
                    }}
                  >
                    {priorityLabel(act.priority)}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f8f8fc", marginBottom: 3 }}>
                  <InlineText text={act.title} />
                </div>
                {act.description && (
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                    <InlineText text={act.description} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Insight */}
      {parsed.keyInsight && (
        <div
          style={{
            background: "#1e1b4b",
            borderLeft: "4px solid #6366f1",
            borderRadius: "0 8px 8px 0",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#818cf8",
              marginBottom: 8,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>One Insight Worth Knowing</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "#c7d2fe" }}>
            <InlineText text={parsed.keyInsight} />
          </div>
        </div>
      )}

      {/* Investigate links */}
      {investigateTabs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", paddingTop: 4 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8585aa",
              marginRight: 4,
            }}
          >
            Dig deeper:
          </span>
          {investigateTabs.map(({ tab, label, icon }) => (
            <button
              key={tab}
              onClick={() => onNavigate!(tab)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: 8,
                border: "1px solid rgba(99,102,241,0.25)",
                background: "transparent",
                color: "#a5b4fc",
                cursor: "pointer",
              }}
            >
              {icon} {label} →
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AiMessageBody — renders an assistant message with structured sections ──
function AiMessageBody({
  content,
  onReply,
}: {
  content: string;
  onReply?: (q: string) => void;
}) {
  const lines = content.split("\n");

  // Detect closing question (last non-empty line ending with ?)
  let closingQuestion = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t) {
      if (t.endsWith("?")) closingQuestion = t;
      break;
    }
  }

  // Split body vs next-steps
  const sepIdx = lines.findIndex((l) => /^next steps?:/i.test(l.trim()));
  const bodyLines = sepIdx >= 0 ? lines.slice(0, sepIdx) : lines;
  const stepLines = sepIdx >= 0 ? lines.slice(sepIdx + 1) : [];

  // Body renderer
  const renderBodyLine = (line: string, i: number) => {
    const t = line.trim();
    if (!t) return null;
    if (t === closingQuestion && onReply) return null; // rendered as chip below
    if (t.startsWith("**") && t.endsWith("**")) {
      return (
        <p key={i} style={{ fontWeight: 600, color: "#e2e8f0", margin: "10px 0 4px 0", fontSize: 14 }}>
          {t.slice(2, -2)}
        </p>
      );
    }
    if (t.startsWith("- ") || t.startsWith("* ")) {
      return (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}>
          <svg width="6" height="6" viewBox="0 0 6 6" style={{ flexShrink: 0, marginTop: 6 }}><circle cx="3" cy="3" r="3" fill="#6366f1" /></svg>
          <span style={{ fontSize: 14, color: "#c0c0d5", lineHeight: 1.65 }}>
            <InlineText text={t.slice(2)} />
          </span>
        </div>
      );
    }
    const numMatch = t.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      return (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "flex-start" }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#6366f1",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {numMatch[1]}
          </span>
          <span style={{ fontSize: 14, color: "#c0c0d5", lineHeight: 1.65 }}>
            <InlineText text={numMatch[2]} />
          </span>
        </div>
      );
    }
    return (
      <p key={i} style={{ fontSize: 14, color: "#c0c0d5", lineHeight: 1.7, margin: "0 0 6px 0" }}>
        <InlineText text={t} />
      </p>
    );
  };

  // Next steps renderer
  const renderStepLine = (line: string, i: number) => {
    const t = line.trim();
    if (!t) return null;
    const numMatch = t.match(/^(\d+)\.\s+(.+)/);
    if (!numMatch) return null;
    const linkMatch = numMatch[2].match(/^(.+?)\s*→\s*(.+)$/);
    return (
      <div
        key={i}
        style={{
          background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.18)",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#6366f1",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {numMatch[1]}
        </span>
        <div style={{ flex: 1 }}>
          {linkMatch ? (
            <>
              <span style={{ fontSize: 13, color: "#c7d2fe", fontWeight: 500 }}>{linkMatch[1]}</span>
              <a
                href={linkMatch[2]}
                style={{
                  display: "inline-block",
                  marginLeft: 8,
                  fontSize: 11,
                  color: "#818cf8",
                  textDecoration: "underline",
                }}
              >
                {linkMatch[2]}
              </a>
            </>
          ) : (
            <span style={{ fontSize: 13, color: "#c7d2fe", fontWeight: 500 }}>
              <InlineText text={numMatch[2]} />
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {bodyLines.map(renderBodyLine)}
      {stepLines.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6366f1",
              marginBottom: 8,
            }}
          >
            Next Steps
          </div>
          {stepLines.map(renderStepLine)}
        </div>
      )}
      {closingQuestion && onReply && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => onReply(closingQuestion)}
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid rgba(99,102,241,0.3)",
              background: "rgba(99,102,241,0.08)",
              color: "#a5b4fc",
              cursor: "pointer",
            }}
          >
            <span style={{ display:"flex", alignItems:"center", gap:6 }}><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>{closingQuestion}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── formatTime / relativeDate ──────────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
function formatInsightDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── ConvItem ───────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#a78bfa", "#00d4aa"];

function ConvItem({
  conv,
  isActive,
  onSelect,
  onDelete,
  onRename,
  messageCount,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (t: string) => void;
  messageCount?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(conv.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }
  function commitRename() {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== conv.title) onRename(t);
    else setDraft(conv.title);
  }

  const avatarColor = AVATAR_COLORS[conv.title.toUpperCase().charCodeAt(0) % AVATAR_COLORS.length];
  const letter = conv.title.trim()[0]?.toUpperCase() ?? "C";

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        cursor: "pointer",
        borderLeft: isActive ? "3px solid #6366f1" : "3px solid transparent",
        background: isActive
          ? "rgba(99,102,241,0.08)"
          : hovered
          ? "rgba(255,255,255,0.04)"
          : "transparent",
        transition: "background 0.15s",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: avatarColor + "22",
          border: `1px solid ${avatarColor}44`,
          color: avatarColor,
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {letter}
      </div>

      {/* Title + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(99,102,241,0.4)",
              outline: "none",
              fontSize: 12,
              color: "#f8f8fc",
            }}
          />
        ) : (
          <>
            <div
              style={{
                fontSize: 12,
                color: isActive ? "#f8f8fc" : "#bcbcd8",
                fontWeight: isActive ? 600 : 400,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {conv.title}
            </div>
            <div style={{ fontSize: 10, color: "#8585aa", marginTop: 1 }}>
              {messageCount != null ? `${messageCount} msg${messageCount !== 1 ? "s" : ""} · ` : ""}
              {relativeDate(conv.updated_at)}
            </div>
          </>
        )}
      </div>

      {/* Action buttons on hover */}
      {!editing && hovered && (
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button
            onClick={startEdit}
            title="Rename"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 3,
              borderRadius: 4,
              color: "#8585aa",
            }}
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 3,
              borderRadius: 4,
              color: "#8585aa",
            }}
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── EmptyNewChat ───────────────────────────────────────────────────────────
const SUGGESTED_QUESTIONS: { icon: React.ReactElement; label: string; q: string }[] = [
  { icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>, label: "Analyze this week", q: "Analyze my business performance this week" },
  { icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>, label: "Find my biggest risk", q: "What is my biggest business risk right now?" },
  { icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>, label: "Suggest growth ideas", q: "Give me 3 growth ideas based on my data" },
  { icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>, label: "What changed yesterday?", q: "What changed in my metrics since yesterday?" },
];

function EmptyNewChat({ onSuggest }: { onSuggest: (q: string) => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "40px 20px",
        textAlign: "center",
        flex: 1,
      }}
    >
      <div>
        <div style={{ marginBottom: 8 }}><svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg></div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#f8f8fc", marginBottom: 4 }}>
          Ask me anything about your business
        </p>
        <p style={{ fontSize: 13, color: "#8585aa", maxWidth: 300 }}>
          I have full context of your Stripe revenue, GA4 traffic, Meta ad spend, and website data.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          width: "100%",
          maxWidth: 380,
        }}
      >
        {SUGGESTED_QUESTIONS.map((s) => (
          <button
            key={s.q}
            onClick={() => onSuggest(s.q)}
            style={{
              background: "#13131a",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "12px 14px",
              textAlign: "left",
              cursor: "pointer",
              color: "#bcbcd8",
              fontSize: 12,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {s.icon}
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ChatInputBar ───────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: "Summarize this week", value: "Summarize my business performance this week" },
  { label: "Biggest risk?", value: "What is my biggest risk right now?" },
  { label: "Growth ideas", value: "Suggest 3 growth ideas based on my current data" },
  { label: "Why no conversions?", value: "Why am I not converting more visitors to paying customers?" },
];

function ChatInputBar({
  value,
  onChange,
  onSend,
  onKeyDown,
  sending,
  disabled,
  textareaRef,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  sending: boolean;
  disabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px 12px" }}>
      {/* Quick prompt chips — hide while typing */}
      {!value && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                onChange({ target: { value: p.value } } as React.ChangeEvent<HTMLTextAreaElement>);
              }}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#8585aa",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth={2} style={{ flexShrink: 0, marginBottom: 10 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "Select or create a chat first" : "Ask about revenue, traffic, churn, ads…"}
          rows={1}
          disabled={sending || disabled}
          style={{
            flex: 1,
            resize: "none",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#0d0d0f",
            padding: "10px 14px",
            fontSize: 14,
            color: "#f8f8fc",
            outline: "none",
            minHeight: 44,
            maxHeight: 160,
            lineHeight: 1.5,
            fontFamily: "inherit",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(99,102,241,0.4)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || sending || disabled}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: !value.trim() || sending || disabled ? "rgba(99,102,241,0.3)" : "#6366f1",
            color: "#fff",
            cursor: !value.trim() || sending || disabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
          title="Send (Enter)"
        >
          {sending ? (
            <Spinner size={14} />
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>
      <p style={{ marginTop: 6, fontSize: 10, color: "#8585aa" }}>↵ Send · ⇧↵ New line</p>
    </div>
  );
}

// ── Demo static data ───────────────────────────────────────────────────────
const DEMO_INSIGHT: Insight = {
  id: "demo-insight-1",
  created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  content: `**Revenue overview — last 30 days**

Your MRR reached **$14,280** this month, up **18.3%** from last month. Net MRR expansion of **+$2,204** with 41 new customers vs. 27 churned.

**Where growth is coming from**

- Stripe subscriptions — 91% of revenue — healthy SaaS concentration
- ARPU climbed to **$348**, up from $312 last month — strong upsell signal
- 3 customers upgraded from Starter to Pro this week

**Ad spend efficiency — watch this**

- Meta ROAS dropped to **1.8×** this week, down from 2.6× — CPM up 34% (audience fatigue)
- Google Ads performing better at **3.1× ROAS** — reallocating 20% of Meta budget could recover ~$620/mo
- Consider rotating ad creative; current hero image has been live 38 days

**Churn signal**

- 4 accounts on payment retry cycle — dunning email within 48h could recover ~$480
- Churn rate: **3.1%** (industry median 3.5%) — you are slightly above average

**One insight worth knowing**

Your organic search channel is your best-performing acquisition source with zero CAC. Two comparison articles you published 60 days ago now drive 22% of all paid signups. Publishing two more in the next 30 days is likely your highest-ROI action this quarter.`,
};

const DEMO_CONV: Conversation = {
  id: "demo-conv-1",
  title: "Revenue & churn deep-dive",
  created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
};

const DEMO_CONV_2: Conversation = {
  id: "demo-conv-2",
  title: "Ad spend analysis",
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

const DEMO_MESSAGES: Message[] = [
  {
    id: "dm-1",
    role: "user",
    content: "Why did churn spike last week?",
    created_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
  },
  {
    id: "dm-2",
    role: "assistant",
    content: `Looking at your Stripe data from the past 14 days, here's what I found:

**Churn breakdown last week**

- 6 customers cancelled — 4 on monthly Starter ($19/mo), 2 annual Pro downgrades
- **3 had zero logins in the 14 days prior** — classic disengagement churn, not price-driven
- 1 left a cancellation reason: "found a cheaper alternative"

**Root cause — low activation on Starter plan**

Your Starter cohort from 45–60 days ago has a 23% weekly active rate vs. 71% for Pro. Customers who don't reach the "aha moment" (connecting ≥2 integrations) within week 1 are 4× more likely to churn.

**Recommended actions**

1. Trigger in-app prompt at day 3 if user hasn't connected a second integration
2. Set up Stripe dunning — 2 of 6 churns were actually failed payments, not intentional
3. Send a 30-day check-in email for Starter users with <2 logins/week

Want me to draft the dunning email copy?`,
    created_at: new Date(Date.now() - 27 * 60 * 1000).toISOString(),
  },
  {
    id: "dm-3",
    role: "user",
    content: "What's my best channel for new customers right now?",
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: "dm-4",
    role: "assistant",
    content: `Based on your GA4 + Stripe combined data, here's last 30 days by channel:

**Customer acquisition by channel**

- **Organic search** — 18 new paid customers, CAC: $0
- **Google Ads** — 11 new paid customers, CAC: $67, ROAS: 3.1× ✅
- **Meta Ads** — 8 new paid customers, CAC: $118, ROAS: 1.8× ⚠️
- **Referral** — 4 new paid customers, CAC: $0

**Verdict**

Organic is your best channel by LTV:CAC ratio. Your two comparison articles convert at 4.2% vs. your blog average of 1.1%. Publish 2–3 more before increasing ad spend.

Google Ads at 3.1× is solid and scalable. Meta is underperforming this week — likely creative fatigue (38 days on same ad set). Refresh the creative before increasing budget.

Which channel would you like to dig into further?`,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
];

// ── DemoAiView ─────────────────────────────────────────────────────────────
function DemoAiView() {
  const [insightExpanded, setInsightExpanded] = useState(true);
  const [demoInput, setDemoInput] = useState("");
  const [activeConv, setActiveConv] = useState<string>("demo-conv-1");
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDemoInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; }
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleDemoSend(); }
  }
  function handleDemoSend() {
    if (!demoInput.trim()) return;
    setDemoInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setShowSignUpPrompt(true);
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  const messages = activeConv === "demo-conv-1" ? DEMO_MESSAGES : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color: "#f8f8fc", margin: 0 }}>
            AI Advisor
          </h1>
          <p style={{ fontFamily: "monospace", fontSize: 13, color: "#bcbcd8", marginTop: 4 }}>
            Analyzes your Stripe, GA4, Meta &amp; more in real time
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 20,
            border: "1px solid rgba(0,212,170,0.2)",
            background: "rgba(0,212,170,0.05)",
            padding: "6px 12px",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#00d4aa",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }}
          />
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
          <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#00d4aa" }}>
            Demo data
          </span>
        </div>
      </div>

      {/* Daily Insight card */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(0,212,170,0.15)",
          background: "#13131a",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(0,212,170,0.1)",
                color: "#00d4aa",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f8f8fc" }}>Daily AI Insight</div>
              <div style={{ fontSize: 12, color: "#8585aa" }}>Generated {formatInsightDate(DEMO_INSIGHT.created_at)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setInsightExpanded((v) => !v)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 6,
                borderRadius: 6,
                color: "#8585aa",
                fontSize: 12,
              }}
            >
              {insightExpanded
                ? <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                : <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>}
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 10,
                border: "1px solid rgba(0,212,170,0.2)",
                background: "rgba(0,212,170,0.05)",
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 500,
                color: "#00d4aa",
                opacity: 0.5,
                cursor: "not-allowed",
                userSelect: "none",
              }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ display:"inline", marginRight:5, verticalAlign:"middle" }}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>Refresh
            </div>
          </div>
        </div>
        {insightExpanded && (
          <div style={{ padding: "16px 20px" }}>
            <InsightRenderer content={DEMO_INSIGHT.content} />
          </div>
        )}
      </div>

      {/* Chat area */}
      <div style={{ display: "flex", gap: 16, minHeight: 480 }}>
        {/* Sidebar */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "#13131a",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#bcbcd8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Chats
            </span>
            <a
              href="/signup"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#0d0d0f",
                color: "#bcbcd8",
                textDecoration: "none",
              }}
            >
              + New
            </a>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
            {[DEMO_CONV, DEMO_CONV_2].map((conv) => {
              const isActive = activeConv === conv.id;
              const avatarColor = AVATAR_COLORS[conv.title.toUpperCase().charCodeAt(0) % AVATAR_COLORS.length];
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConv(conv.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    borderLeft: isActive ? "3px solid #6366f1" : "3px solid transparent",
                    background: isActive ? "rgba(99,102,241,0.08)" : "transparent",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: avatarColor + "22",
                      border: `1px solid ${avatarColor}44`,
                      color: avatarColor,
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {conv.title[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: isActive ? "#f8f8fc" : "#bcbcd8",
                        fontWeight: isActive ? 600 : 400,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {conv.title}
                    </div>
                    <div style={{ fontSize: 10, color: "#8585aa" }}>{relativeDate(conv.updated_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat panel */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "#13131a",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(99,102,241,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f8f8fc" }}>
                  {activeConv === "demo-conv-1" ? DEMO_CONV.title : DEMO_CONV_2.title}
                </div>
                <div style={{ fontSize: 12, color: "#8585aa" }}>
                  {activeConv === "demo-conv-1" ? `${DEMO_MESSAGES.length} messages` : "Demo conversation"}
                </div>
              </div>
            </div>
          </div>

          {/* Context strip */}
          <div
            style={{
              padding: "6px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(99,102,241,0.04)",
              fontSize: 11,
              color: "#6366f1",
            }}
          >
            <span style={{ display:"flex", alignItems:"center", gap:6 }}><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>This conversation has full context of your live Stripe, GA4, and PostHog data.</span>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              minHeight: 280,
              maxHeight: 420,
            }}
          >
            {activeConv === "demo-conv-2" ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  textAlign: "center",
                  padding: 40,
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 500, color: "#bcbcd8" }}>Demo conversation</p>
                <p style={{ fontSize: 12, color: "#8585aa" }}>Sign up to chat about your real business data</p>
                <a
                  href="/signup"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#00d4aa",
                    color: "#0d0d0f",
                    padding: "10px 20px",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 13,
                    textDecoration: "none",
                    fontFamily: "monospace",
                  }}
                >
                  Start free trial →
                </a>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        maxWidth: "80%",
                        alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      {msg.role === "assistant" && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#8585aa", paddingLeft: 4, display:"flex", alignItems:"center", gap:4 }}><svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>AI Advisor</div>
                      )}
                      <div
                        style={
                          msg.role === "user"
                            ? {
                                background: "#1e293b",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: "18px 18px 4px 18px",
                                padding: "10px 16px",
                                fontSize: 14,
                                color: "#f8f8fc",
                                lineHeight: 1.6,
                              }
                            : {
                                background: "#13131a",
                                borderLeft: "3px solid #6366f1",
                                borderTop: "1px solid rgba(255,255,255,0.06)",
                                borderRight: "1px solid rgba(255,255,255,0.06)",
                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: "4px 18px 18px 18px",
                                padding: "12px 16px",
                                fontSize: 14,
                                color: "#c0c0d5",
                                lineHeight: 1.7,
                              }
                        }
                      >
                        {msg.role === "assistant" ? (
                          <AiMessageBody
                            content={msg.content}
                            onReply={(q) => {
                              setDemoInput(q);
                            }}
                          />
                        ) : (
                          <p style={{ margin: 0 }}>{msg.content}</p>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: "#8585aa", padding: "0 4px" }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                ))}

                {showSignUpPrompt && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "80%", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#8585aa", paddingLeft: 4, display:"flex", alignItems:"center", gap:4 }}><svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>AI Advisor</div>
                      <div
                        style={{
                          background: "#13131a",
                          borderLeft: "3px solid #6366f1",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: "4px 18px 18px 18px",
                          padding: "14px 16px",
                          fontSize: 14,
                          color: "#c0c0d5",
                        }}
                      >
                        <p style={{ margin: "0 0 8px 0" }}>Great question! To answer that with your real data, I need access to your connected integrations.</p>
                        <p style={{ fontSize: 12, color: "#8585aa", margin: "0 0 14px 0" }}>
                          This is a demo — sign up to connect Stripe, GA4, Meta Ads and get answers based on <em>your</em> actual numbers.
                        </p>
                        <a
                          href="/signup"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "#00d4aa",
                            color: "#0d0d0f",
                            padding: "8px 16px",
                            borderRadius: 10,
                            fontWeight: 700,
                            fontSize: 12,
                            textDecoration: "none",
                            fontFamily: "monospace",
                          }}
                        >
                          Start free — 3-day trial →
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          <ChatInputBar
            value={demoInput}
            onChange={handleInputChange}
            onSend={handleDemoSend}
            onKeyDown={handleKeyDown}
            sending={false}
            disabled={false}
            textareaRef={textareaRef}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AiTab({ isPremium, isDemo = false, onNavigate }: AiTabProps) {
  if (isDemo) return <DemoAiView />;

  // ── Goal state ────────────────────────────────────────────────────────
  const [goal, setGoal] = useState<Goal>(null);
  useEffect(() => { setGoal(loadGoal()); }, []);
  function handleGoalChange(g: Goal) {
    const next = goal === g ? null : g;
    setGoal(next);
    saveGoal(next);
  }

  // ── Insight state ─────────────────────────────────────────────────────
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [insightGenerating, setInsightGenerating] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(false);

  // ── Conversation state ────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [creatingConv, setCreatingConv] = useState(false);

  // ── Chat state ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load insight ───────────────────────────────────────────────────────
  const loadInsight = useCallback(async () => {
    setInsightLoading(true);
    try {
      const res = await fetch("/api/ai/insight");
      const data = await res.json();
      setInsight(data.insight ?? null);
    } catch { /* silent */ }
    finally { setInsightLoading(false); }
  }, []);

  async function generateInsight() {
    setInsightGenerating(true);
    try {
      const res = await fetch("/api/ai/insight", { method: "POST" });
      const data = await res.json();
      if (data.insight) {
        setInsight(data.insight);
        setInsightExpanded(true);
        localStorage.setItem("insightExpanded", "true");
      }
    } catch { /* silent */ }
    finally { setInsightGenerating(false); }
  }

  // ── Load conversations ─────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const res = await fetch("/api/ai/conversations");
      const data = await res.json();
      const list: Conversation[] = data.conversations ?? [];
      setConversations(list);
      if (list.length > 0 && !activeConvId) setActiveConvId(list[0].id);
    } catch { /* silent */ }
    finally { setConvsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load messages ──────────────────────────────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/ai/messages?conversationId=${convId}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch { /* silent */ }
    finally { setMessagesLoading(false); }
  }, []);

  useEffect(() => {
    const expanded = localStorage.getItem("insightExpanded") === "true";
    setInsightExpanded(expanded);
    loadInsight();
    loadConversations();
  }, [loadInsight, loadConversations]);

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Conversation CRUD ──────────────────────────────────────────────────
  async function createConversation() {
    setCreatingConv(true);
    try {
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      const data = await res.json();
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setMessages([]);
      }
    } catch { /* silent */ }
    finally { setCreatingConv(false); }
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      if (activeConvId === id) { setActiveConvId(updated[0]?.id ?? null); setMessages([]); }
      return updated;
    });
  }

  async function renameConversation(id: string, title: string) {
    await fetch(`/api/ai/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }

  // ── Input handling ─────────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; }
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── Send message ───────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || sending || !activeConvId) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = { id: tempId, role: "user", content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: activeConvId }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          const actualUser: Message = { id: `u-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() };
          return [...withoutTemp, actualUser, data.reply];
        });
        if (data.updatedTitle) {
          setConversations((prev) => prev.map((c) => c.id === activeConvId ? { ...c, title: data.updatedTitle } : c));
        }
        setConversations((prev) => {
          const conv = prev.find((c) => c.id === activeConvId);
          if (!conv) return prev;
          return [{ ...conv, updated_at: new Date().toISOString() }, ...prev.filter((c) => c.id !== activeConvId)];
        });
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  // ── isPremium gate ─────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color: "#f8f8fc", margin: 0 }}>AI Advisor</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "#bcbcd8" }}>Analyzes your Stripe, GA4, Meta &amp; more in real time.</p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(19,19,26,0.6)",
            padding: "64px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              marginBottom: 20,
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "1px solid rgba(99,102,241,0.2)",
              background: "rgba(99,102,241,0.1)",
              color: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
          </div>
          <p style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6366f1", marginBottom: 8 }}>
            Premium Feature
          </p>
          <h2 style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#f8f8fc", marginBottom: 12 }}>
            AI Advisor requires Premium
          </h2>
          <p style={{ fontSize: 14, color: "#bcbcd8", maxWidth: 360, marginBottom: 24 }}>
            Upgrade to access the AI Advisor, get automated insights, and chat with an AI trained on your real business data.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 28,
              width: "100%",
              maxWidth: 360,
              textAlign: "left",
            }}
          >
            {[
              "Daily AI business insights",
              "Chat with your data",
              "Revenue trend analysis",
              "Ad spend intelligence",
              "Website improvement tips",
              "Multi-source data fusion",
            ].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#00d4aa" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#bcbcd8" }}>{f}</span>
              </div>
            ))}
          </div>
          <a
            href="/api/stripe/checkout"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 12,
              background: "#00d4aa",
              padding: "12px 28px",
              fontFamily: "monospace",
              fontSize: 14,
              fontWeight: 700,
              color: "#0d0d0f",
              textDecoration: "none",
            }}
          >
            Start 7-day free trial →
          </a>
          <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 10, color: "#8585aa" }}>
            $19/mo after trial · Cancel anytime
          </p>
        </div>
      </div>
    );
  }

  // ── Full premium render ────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color: "#f8f8fc", margin: 0 }}>AI Advisor</h1>
          <p style={{ fontFamily: "monospace", fontSize: 13, color: "#bcbcd8", marginTop: 4 }}>
            Analyzes your Stripe, GA4, Meta &amp; more in real time
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 20,
            border: "1px solid rgba(0,212,170,0.2)",
            background: "rgba(0,212,170,0.05)",
            padding: "6px 12px",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#00d4aa",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }}
          />
          <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#00d4aa" }}>
            Live data context
          </span>
        </div>
      </div>

      {/* Daily Insight card */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(0,212,170,0.15)",
          background: "#13131a",
          overflow: "hidden",
        }}
      >
        {/* Goal bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(23,23,42,0.8)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#8585aa",
              flexShrink: 0,
            }}
          >
            Focus goal:
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.id}
                onClick={() => handleGoalChange(g.id)}
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: goal === g.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                  background: goal === g.id ? g.color : "transparent",
                  color: goal === g.id ? "#0d0d0f" : "#8585aa",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{g.icon}</span>
                <span>{g.label}</span>
              </button>
            ))}
            {goal && (
              <button
                onClick={() => handleGoalChange(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8585aa", padding: 2, display:"flex" }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          {goal && (
            <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 9, color: "#8585aa" }}>
              Applied to next insight
            </span>
          )}
        </div>

        {/* Card header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(0,212,170,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f8f8fc" }}>Daily AI Insight</div>
              {insight && (
                <div style={{ fontSize: 12, color: "#8585aa" }}>Generated {formatInsightDate(insight.created_at)}</div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {insight && (
              <button
                onClick={() => {
                  setInsightExpanded((v) => {
                    const nv = !v;
                    localStorage.setItem("insightExpanded", String(nv));
                    return nv;
                  });
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 6,
                  color: "#8585aa",
                  fontSize: 12,
                }}
              >
                {insightExpanded
                  ? <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                  : <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>}
              </button>
            )}
            <button
              onClick={generateInsight}
              disabled={insightGenerating}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 10,
                border: "1px solid rgba(0,212,170,0.2)",
                background: "rgba(0,212,170,0.05)",
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                color: "#00d4aa",
                cursor: insightGenerating ? "not-allowed" : "pointer",
                opacity: insightGenerating ? 0.5 : 1,
              }}
            >
              {insightGenerating ? <><Spinner size={12} /> Generating…</> : <><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>{insight ? "Refresh" : "Generate Insight"}</>}
            </button>
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: "16px 20px" }}>
          {insightLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[80, 60, 70, 55, 65].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: 14,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.06)",
                    width: `${w}%`,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              ))}
            </div>
          ) : !insight ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "32px 0", textAlign: "center" }}>
              <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#bcbcd8" }}>No insight for today yet</p>
              <p style={{ fontSize: 12, color: "#8585aa" }}>Click &ldquo;Generate Insight&rdquo; to analyze your current business data</p>
            </div>
          ) : insightExpanded ? (
            <InsightRenderer content={insight.content} onNavigate={onNavigate} />
          ) : null}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ display: "flex", gap: 16, minHeight: 480 }}>

        {/* Sidebar */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "#13131a",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#bcbcd8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Chats
            </span>
            <button
              onClick={createConversation}
              disabled={creatingConv}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#0d0d0f",
                color: "#bcbcd8",
                cursor: creatingConv ? "not-allowed" : "pointer",
                opacity: creatingConv ? 0.5 : 1,
              }}
            >
              {creatingConv ? <Spinner size={10} /> : "+ New"}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
            {convsLoading ? (
              [1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{ height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", animation: "pulse 1.5s ease-in-out infinite" }}
                />
              ))
            ) : conversations.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "32px 8px", textAlign: "center" }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                <p style={{ fontSize: 11, color: "#8585aa" }}>No chats yet.<br />Click &ldquo;+ New&rdquo; to start.</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === activeConvId}
                  onSelect={() => setActiveConvId(conv.id)}
                  onDelete={() => deleteConversation(conv.id)}
                  onRename={(title) => renameConversation(conv.id, title)}
                  messageCount={conv.id === activeConvId ? messages.length : undefined}
                />
              ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "#13131a",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Chat header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(99,102,241,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#f8f8fc",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {activeConv ? activeConv.title : "AI Advisor"}
                </div>
                <div style={{ fontSize: 12, color: "#8585aa" }}>
                  {!activeConvId
                    ? "Select or create a chat"
                    : messages.length === 0
                    ? "Start a conversation"
                    : `${messages.length} message${messages.length !== 1 ? "s" : ""}`}
                </div>
              </div>
            </div>
          </div>

          {/* Context strip */}
          {activeConvId && (
            <div
              style={{
                padding: "6px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: "rgba(99,102,241,0.04)",
                fontSize: 11,
                color: "#6366f1",
              }}
            >
              <span style={{ display:"flex", alignItems:"center", gap:6 }}><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>This conversation has full context of your live Stripe, GA4, and PostHog data.</span>
            </div>
          )}

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              minHeight: 280,
              maxHeight: 420,
            }}
          >
            {!activeConvId ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  textAlign: "center",
                  padding: 40,
                }}
              >
                <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={1.3}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                <p style={{ fontSize: 14, color: "#8585aa" }}>Create a new chat to get started</p>
                <button
                  onClick={createConversation}
                  disabled={creatingConv}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 10,
                    border: "1px solid rgba(99,102,241,0.2)",
                    background: "rgba(99,102,241,0.05)",
                    padding: "8px 16px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#6366f1",
                    cursor: "pointer",
                  }}
                >
                  {creatingConv ? <Spinner size={14} /> : "+ New Chat"}
                </button>
              </div>
            ) : messagesLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[true, false, true].map((isUser, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        height: 48,
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.05)",
                        width: `${40 + i * 15}%`,
                        animation: "pulse 1.5s ease-in-out infinite",
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <EmptyNewChat
                onSuggest={(q) => {
                  setInput(q);
                  textareaRef.current?.focus();
                }}
              />
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        maxWidth: "80%",
                        alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      {msg.role === "assistant" && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#8585aa", paddingLeft: 4, display:"flex", alignItems:"center", gap:4 }}><svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>AI Advisor</div>
                      )}
                      <div
                        style={
                          msg.role === "user"
                            ? {
                                background: "#1e293b",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: "18px 18px 4px 18px",
                                padding: "10px 16px",
                                fontSize: 14,
                                color: "#f8f8fc",
                                lineHeight: 1.6,
                              }
                            : {
                                background: "#13131a",
                                borderLeft: "3px solid #6366f1",
                                borderTop: "1px solid rgba(255,255,255,0.06)",
                                borderRight: "1px solid rgba(255,255,255,0.06)",
                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: "4px 18px 18px 18px",
                                padding: "12px 16px",
                                fontSize: 14,
                                color: "#c0c0d5",
                                lineHeight: 1.7,
                              }
                        }
                      >
                        {msg.role === "assistant" ? (
                          <AiMessageBody
                            content={msg.content}
                            onReply={(q) => {
                              setInput(q);
                              textareaRef.current?.focus();
                            }}
                          />
                        ) : (
                          <p style={{ margin: 0 }}>{msg.content}</p>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: "#8585aa", padding: "0 4px" }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                ))}

                {sending && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#13131a",
                        borderLeft: "3px solid #6366f1",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "4px 18px 18px 18px",
                        padding: "10px 16px",
                      }}
                    >
                      <div style={{ display: "flex", gap: 4 }}>
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#6366f1",
                              display: "inline-block",
                              animation: `bounce 1s ease-in-out ${delay}ms infinite`,
                            }}
                          />
                        ))}
                        <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }`}</style>
                      </div>
                      <span style={{ fontSize: 12, color: "#8585aa" }}>Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </>
            )}
          </div>

          {/* Input bar */}
          <ChatInputBar
            value={input}
            onChange={handleInputChange}
            onSend={sendMessage}
            onKeyDown={handleKeyDown}
            sending={sending}
            disabled={!activeConvId}
            textareaRef={textareaRef}
          />
        </div>
      </div>
    </div>
  );
}
