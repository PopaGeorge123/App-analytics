"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
}

// ── Markdown-lite renderer ─────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      result.push(
        <p key={key++} className="mt-3 mb-1 font-semibold text-[#f8f8fc]">
          {line.slice(2, -2)}
        </p>
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      result.push(
        <li key={key++} className="ml-4 text-[#c0c0d5] list-disc">
          {inlineFormat(line.slice(2))}
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      result.push(
        <li key={key++} className="ml-4 text-[#c0c0d5] list-decimal">
          {inlineFormat(line.replace(/^\d+\.\s/, ""))}
        </li>
      );
    } else if (line.trim() === "") {
      result.push(<div key={key++} className="h-1" />);
    } else {
      result.push(
        <p key={key++} className="text-[#c0c0d5] leading-relaxed">
          {inlineFormat(line)}
        </p>
      );
    }
  }

  return result;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-[#f8f8fc]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Spinner ────────────────────────────────────────────────────────────────
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="animate-spin"
    >
      <path strokeLinecap="round" d="M12 3a9 9 0 010 18" />
    </svg>
  );
}

// ── Conversation sidebar item ──────────────────────────────────────────────
function ConvItem({
  conv,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
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
    const t = draft.trim();
    if (t && t !== conv.title) onRename(t);
    setEditing(false);
  }

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-all ${
        isActive
          ? "bg-[#6366f1]/10 border border-[#6366f1]/20 text-[#f8f8fc]"
          : "border border-transparent text-[#bcbcd8] hover:bg-[#363650] hover:text-[#f8f8fc]"
      }`}
    >
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="shrink-0 opacity-60">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>

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
          className="flex-1 min-w-0 bg-transparent text-xs text-[#f8f8fc] outline-none border-b border-[#6366f1]/40"
        />
      ) : (
        <span className="flex-1 min-w-0 truncate text-xs">{conv.title}</span>
      )}

      {/* Action buttons — show on hover */}
      {!editing && (
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button
            onClick={startEdit}
            title="Rename"
            className="rounded p-0.5 text-[#8585aa] hover:text-[#bcbcd8] transition-colors"
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete"
            className="rounded p-0.5 text-[#8585aa] hover:text-red-400 transition-colors"
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

// ── Main component ─────────────────────────────────────────────────────────
export default function AiTab({ isPremium }: AiTabProps) {
  // ── Insight state ─────────────────────────────────────────────────────
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [insightGenerating, setInsightGenerating] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(
    localStorage.getItem("insightExpanded") === "true" || false
  );

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

  // ── Load conversations list ────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const res = await fetch("/api/ai/conversations");
      const data = await res.json();
      const list: Conversation[] = data.conversations ?? [];
      setConversations(list);
      // Auto-select the most recent one
      if (list.length > 0 && !activeConvId) {
        setActiveConvId(list[0].id);
      }
    } catch { /* silent */ }
    finally { setConvsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load messages for active conversation ─────────────────────────────
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

  useEffect(() => { loadInsight(); loadConversations(); }, [loadInsight, loadConversations]);

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
  }, [activeConvId, loadMessages]);

  // Auto-scroll
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── New conversation ───────────────────────────────────────────────────
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

  // ── Delete conversation ────────────────────────────────────────────────
  async function deleteConversation(id: string) {
    await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      if (activeConvId === id) {
        setActiveConvId(updated[0]?.id ?? null);
        setMessages([]);
      }
      return updated;
    });
  }

  // ── Rename conversation ────────────────────────────────────────────────
  async function renameConversation(id: string, title: string) {
    await fetch(`/api/ai/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }

  // ── Input handling ─────────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── Send message ───────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || sending || !activeConvId) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticUser: Message = {
      id: tempId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser]);
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
          const actualUser: Message = {
            id: `u-${Date.now()}`,
            role: "user",
            content: text,
            created_at: new Date().toISOString(),
          };
          return [...withoutTemp, actualUser, data.reply];
        });
        // Update title in sidebar if auto-titled
        if (data.updatedTitle) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConvId ? { ...c, title: data.updatedTitle } : c
            )
          );
        }
        // Bubble conversation to top
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

  // ── Render ─────────────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">AI Advisor</h1>
          <p className="mt-1 text-sm text-[#bcbcd8]">Analyzes your Stripe, GA4, Meta &amp; website data in real time.</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 py-16 px-6 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#6366f1]/20 bg-[#6366f1]/10 text-[#6366f1]">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#6366f1] mb-2">Premium Feature</p>
          <h2 className="font-mono text-xl font-bold text-[#f8f8fc] mb-3">AI Advisor requires Premium</h2>
          <p className="text-sm text-[#bcbcd8] max-w-sm mb-6">
            Upgrade to access the AI Advisor, get automated insights, and chat with an AI trained on your real business data.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-7 w-full max-w-sm text-left">
            {[
              "Daily AI business insights",
              "Chat with your data",
              "Revenue trend analysis",
              "Ad spend intelligence",
              "Website improvement tips",
              "Multi-source data fusion",
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
            Start 3-day free trial →
          </a>
          <p className="mt-3 font-mono text-[10px] text-[#8585aa]">$29/mo after trial · Cancel anytime</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold text-[#f8f8fc]">AI Advisor</h1>
          <p className="font-mono text-sm text-[#bcbcd8] mt-0.5">
            Analyzes your Stripe, GA4, Meta &amp; website data in real time
          </p>
        </div>
        {/* Live data context indicator */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
          <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">Live data context</span>
        </div>
      </div>

      {/* ── Daily Insight card ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#00d4aa]/15 bg-[#1c1c2a] overflow-hidden" style={{ boxShadow: "0 0 0 1px #00d4aa08" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#363650]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00d4aa]/10 text-[#00d4aa]">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#f8f8fc]">Daily AI Insight</h2>
              {insight && <p className="text-xs text-[#8585aa]">Generated {formatDate(insight.created_at)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {insight && (
              <button
                onClick={() => {
                  setInsightExpanded((v) => {
                    const newValue = !v;
                    localStorage.setItem("insightExpanded", newValue.toString());
                    return newValue;
                  });
                }}
                className="rounded-lg p-1.5 text-[#8585aa] hover:bg-[#363650] hover:text-[#bcbcd8] transition-colors"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  className={`transition-transform ${insightExpanded ? "" : "rotate-180"}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
            )}
            <button
              onClick={generateInsight}
              disabled={insightGenerating}
              className="flex items-center gap-1.5 rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 px-3 py-1.5 text-xs font-medium text-[#00d4aa] hover:bg-[#00d4aa]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {insightGenerating ? (
                <><Spinner size={12} /> Generating…</>
              ) : (
                <>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  {insight ? "Refresh" : "Generate Insight"}
                </>
              )}
            </button>
          </div>
        </div>
        <div className="px-5 py-4">
          {insightLoading ? (
            <div className="flex flex-col gap-2">
              {[80, 60, 70, 55, 65].map((w, i) => (
                <div key={i} className="h-4 rounded bg-[#363650] animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : !insight ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#363650] bg-[#0a0a14]">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#bcbcd8]">No insight for today yet</p>
                <p className="text-xs text-[#8585aa] mt-1">Click &ldquo;Generate Insight&rdquo; to analyze your current business data</p>
              </div>
            </div>
          ) : insightExpanded ? (
            <div className="prose-sm text-[0.8rem] leading-relaxed">
              {renderMarkdown(insight.content)}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Chat area: sidebar + panel ───────────────────────────────────── */}
      <div className="flex gap-4 min-h-140">

        {/* ── Conversations sidebar ──────────────────────────────────────── */}
        <div className="flex flex-col w-52 shrink-0 rounded-2xl border border-[#363650] bg-[#1c1c2a] overflow-hidden">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-[#363650]">
            <span className="text-xs font-semibold text-[#bcbcd8] uppercase tracking-wider">Chats</span>
            <button
              onClick={createConversation}
              disabled={creatingConv}
              title="New Chat"
              className="flex items-center gap-1 rounded-lg border border-[#363650] bg-[#0a0a14] px-2 py-1 text-[10px] font-medium text-[#bcbcd8] hover:border-[#6366f1]/30 hover:text-[#6366f1] disabled:opacity-50 transition-colors"
            >
              {creatingConv ? <Spinner size={10} /> : (
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              )}
              New
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {convsLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-9 rounded-xl bg-[#363650] animate-pulse" />
              ))
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center px-2">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p className="text-[11px] text-[#8585aa]">No chats yet.<br />Click &ldquo;New&rdquo; to start.</p>
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
                />
              ))
            )}
          </div>
        </div>

        {/* ── Chat panel ────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col rounded-2xl border border-[#363650] bg-[#1c1c2a] overflow-hidden min-w-0">
          {/* Chat header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#363650]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#6366f1]">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[#f8f8fc] truncate">
                  {activeConv ? activeConv.title : "AI Advisor"}
                </h2>
                <p className="text-xs text-[#8585aa]">
                  {!activeConvId
                    ? "Select or create a chat"
                    : messages.length === 0
                    ? "Start a conversation"
                    : `${messages.length} message${messages.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-4 flex-1 px-5 py-4 overflow-y-auto min-h-72 max-h-120">
            {!activeConvId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p className="text-sm text-[#8585aa]">Create a new chat to get started</p>
                <button
                  onClick={createConversation}
                  disabled={creatingConv}
                  className="flex items-center gap-2 rounded-xl border border-[#6366f1]/20 bg-[#6366f1]/5 px-4 py-2 text-sm font-medium text-[#6366f1] hover:bg-[#6366f1]/10 disabled:opacity-50 transition-colors"
                >
                  {creatingConv ? <Spinner size={14} /> : (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                  New Chat
                </button>
              </div>
            ) : messagesLoading ? (
              <div className="flex flex-col gap-3">
                {[true, false, true].map((isUser, i) => (
                  <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className="h-12 rounded-2xl bg-[#363650] animate-pulse" style={{ width: `${40 + i * 15}%` }} />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#363650] bg-[#0a0a14]">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#8585aa" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#bcbcd8]">Ask me anything about your business</p>
                  <p className="text-xs text-[#8585aa] mt-1 max-w-xs">I have access to your last 30 days of revenue, MRR, subscriptions, churn, traffic, ad spend, and website data</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center mt-1">
                  {[
                    { label: "Stripe", color: "#635bff" },
                    { label: "GA4", color: "#f59e0b" },
                    { label: "Meta Ads", color: "#1877f2" },
                    { label: "Website", color: "#a78bfa" },
                  ].map((s) => (
                    <span key={s.label} className="inline-flex items-center gap-1 font-mono text-[9px] px-2 py-0.5 rounded-md" style={{ color: s.color, backgroundColor: s.color + "15" }}>
                      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {["How is my revenue trending?", "What's my CAC this month?", "Top website issues to fix?", "Is my ad spend efficient?"].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                      className="rounded-lg border border-[#363650] bg-[#0a0a14] px-3 py-1.5 text-xs text-[#bcbcd8] hover:border-[#00d4aa]/20 hover:text-[#00d4aa] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5 px-1">
                          <div className="flex h-4 w-4 items-center justify-center rounded bg-[#6366f1]/20">
                            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                          <span className="text-[10px] font-medium text-[#8585aa]">AI Advisor</span>
                        </div>
                      )}
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#00d4aa]/10 border border-[#00d4aa]/20 text-[#f8f8fc] rounded-tr-sm"
                          : "bg-[#0a0a14] border border-[#363650] text-[#c0c0d5] rounded-tl-sm"
                      }`}>
                        {msg.role === "assistant" ? renderMarkdown(msg.content) : <p>{msg.content}</p>}
                      </div>
                      <span className="text-[10px] text-[#8585aa] px-1">{formatTime(msg.created_at)}</span>
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-[#0a0a14] border border-[#363650] px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 150, 300].map((delay) => (
                          <span key={delay} className="h-1.5 w-1.5 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                        ))}
                      </div>
                      <span className="text-xs text-[#8585aa]">Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t border-[#363650] px-4 py-3">
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={activeConvId ? "Ask about your revenue, traffic, ad spend, website…" : "Select or create a chat first"}
                rows={1}
                disabled={sending || !activeConvId}
                className="flex-1 resize-none rounded-xl border border-[#363650] bg-[#0a0a14] px-4 py-3 text-sm text-[#f8f8fc] placeholder:text-[#8585aa] focus:border-[#00d4aa]/30 focus:outline-none disabled:opacity-50 transition-colors"
                style={{ minHeight: "44px", maxHeight: "160px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending || !activeConvId}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00d4aa] text-[#0a0a14] hover:bg-[#00bfa3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Send (Enter)"
              >
                {sending ? <Spinner size={16} /> : (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-[#8585aa]">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </div>

      </div>
    </div>
  );
}
