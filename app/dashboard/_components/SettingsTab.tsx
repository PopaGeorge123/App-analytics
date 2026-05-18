"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SettingsTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  currencies: Record<string, string>;
  isDemo?: boolean;
}

// ── Toggle component ──────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  color = "#10b981",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
      style={{ backgroundColor: checked ? color : "#d0d0e8" }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="h-3.5 w-0.5 rounded-full" style={{ backgroundColor: color }} />
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color }}>
        {children}
      </p>
    </div>
  );
}


// ── Share Dashboard ───────────────────────────────────────────────────────

interface ShareLink {
  token: string;
  label: string;
  expires_at: string;
  view_count: number;
  created_at: string;
}

function ShareSection() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function fetchLinks() {
    try {
      const res = await fetch("/api/dashboard/share");
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { fetchLinks(); }, []);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/share", { method: "POST" });
      if (!res.ok) { setError("Failed to generate link."); return; }
      const data = await res.json();
      await navigator.clipboard.writeText(data.url.startsWith("http") ? data.url : `${window.location.origin}${data.url}`);
      await fetchLinks();
      setCopied(data.token);
      setTimeout(() => setCopied(null), 2500);
    } catch { setError("Something went wrong."); }
    finally { setGenerating(false); }
  }

  async function revoke(token: string) {
    setRevoking(token);
    try {
      await fetch(`/api/dashboard/share?token=${token}`, { method: "DELETE" });
      setLinks((prev) => prev.filter((l) => l.token !== token));
    } catch {}
    finally { setRevoking(null); }
  }

  async function copy(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  function daysLeft(exp: string) {
    const d = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
    return d <= 0 ? "Expired" : `${d}d left`;
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] text-[#6a6a90] leading-relaxed">
        Generate a read-only link to share your dashboard snapshot with investors, teammates, or clients. Links expire in 7 days.
      </p>

      <button
        onClick={generate}
        disabled={generating || links.length >= 5}
        className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 font-mono text-xs font-bold text-[#1a1a2e] hover:bg-[#4f46e5] disabled:opacity-60 transition"
      >
        {generating ? (
          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
        ) : (
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        )}
        {generating ? "Generating…" : "Generate shareable link"}
      </button>
      {links.length >= 5 && (
        <p className="font-mono text-[9px] text-[#f59e0b]">Max 5 active links. Revoke one to create another.</p>
      )}
      {error && <p className="font-mono text-[9px] text-red-400">{error}</p>}

      {loading ? (
        <p className="font-mono text-[10px] text-[#58588a]">Loading links…</p>
      ) : links.length === 0 ? (
        <p className="font-mono text-[10px] text-[#58588a]">No active share links.</p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.token} className="flex items-center gap-3 rounded-xl border border-[#eeeef4] bg-[#f5f5f7] px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[10px] text-[#3a3a58] truncate">/share/{link.token}</p>
                <p className="font-mono text-[9px] text-[#58588a] mt-0.5">
                  {daysLeft(link.expires_at)} · {link.view_count} view{link.view_count !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => copy(link.token)}
                className="flex items-center gap-1 rounded-lg border border-[#eeeef4] px-2.5 py-1.5 font-mono text-[9px] text-[#6a6a90] hover:text-[#1a1a2e] transition"
              >
                {copied === link.token ? (
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                )}
                {copied === link.token ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => revoke(link.token)}
                disabled={revoking === link.token}
                className="rounded-lg border border-red-500/20 px-2.5 py-1.5 font-mono text-[9px] text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition disabled:opacity-50"
              >
                {revoking === link.token ? "…" : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



// ── NAV ITEMS ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "account",      label: "Account",        color: "#6366f1" },
  { id: "business",     label: "Business",       color: "#a78bfa" },
  { id: "subscription", label: "Subscription",   color: "#10b981" },
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function SettingsTab({ email, isPremium, connectedPlatforms, currencies, isDemo = false }: SettingsTabProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("account");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [authProvider, setAuthProvider] = useState<string>("email");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [subDetails, setSubDetails] = useState<{ price: string; renewal: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // ── Business profile state ─────────────────────────────────────────────
  const [bizWebsite, setBizWebsite]       = useState("");
  const [bizDescription, setBizDescription] = useState("");
  const [bizIndustry, setBizIndustry]     = useState("");
  const [bizProfileLoaded, setBizProfileLoaded] = useState(false);
  const [bizSaving, setBizSaving]         = useState(false);
  const [bizSaveMsg, setBizSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [bizAnalysing, setBizAnalysing]   = useState(false);
  const [bizAnalyseMsg, setBizAnalyseMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.app_metadata?.provider) {
        setAuthProvider(data.user.app_metadata.provider as string);
      }
    });
    if (isPremium) {
      fetch("/api/stripe/subscription")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.price && d?.renewal) setSubDetails({ price: d.price, renewal: d.renewal });
        })
        .catch(() => {});
    }
    // Load business profile
    fetch("/api/onboarding/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setBizWebsite(d.websiteUrl ?? "");
        setBizDescription(d.businessDescription ?? "");
        setBizIndustry(d.businessIndustry ?? "");
        setBizProfileLoaded(true);
      })
      .catch(() => { setBizProfileLoaded(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBizSave() {
    setBizSaving(true);
    setBizSaveMsg(null);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl:          bizWebsite.trim(),
          businessDescription: bizDescription.trim(),
          businessIndustry:    bizIndustry.trim(),
        }),
      });
      if (res.ok) {
        setBizSaveMsg({ ok: true, text: "Saved!" });
      } else {
        const d = await res.json().catch(() => ({}));
        setBizSaveMsg({ ok: false, text: d.error ?? "Failed to save." });
      }
    } catch {
      setBizSaveMsg({ ok: false, text: "Network error." });
    } finally {
      setBizSaving(false);
      setTimeout(() => setBizSaveMsg(null), 3000);
    }
  }

  async function handleBizAnalyse() {
    const url = bizWebsite.trim();
    if (!url) return;
    setBizAnalysing(true);
    setBizAnalyseMsg(null);
    try {
      const res = await fetch("/api/onboarding/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await res.json();
      if (res.ok && d.description) {
        setBizDescription(d.description);
        if (d.industry) setBizIndustry(d.industry);
        setBizAnalyseMsg("✓ Description extracted — review and save.");
      } else {
        setBizAnalyseMsg(d.error ?? "Could not extract description.");
      }
    } catch {
      setBizAnalyseMsg("Network error.");
    } finally {
      setBizAnalysing(false);
    }
  }

  async function handleChangeEmail() {
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    setEmailMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailLoading(false);
    if (error) {
      setEmailMsg({ ok: false, text: error.message });
    } else {
      setEmailMsg({ ok: true, text: `Confirmation link sent to ${newEmail.trim()} — click it to complete the change.` });
      setNewEmail("");
      // Keep form open so the user sees the pending message
    }
  }

  async function handleChangePassword() {
    setPwLoading(true);
    setPwMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setPwLoading(false);
    if (error) {
      setPwMsg({ ok: false, text: error.message });
    } else {
      setPwMsg({ ok: true, text: "Password reset link sent to your email." });
      setShowPasswordForm(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/user/delete", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const knownParams = new Set(["tab", "connect", "syncing"]);
    const hasJunkParams = Array.from(params.keys()).some((k) => !knownParams.has(k));
    if (hasJunkParams) {
      router.replace("/dashboard?tab=settings");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intersection observer for active nav state
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(sectionRefs.current).forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handlePortal() {
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setPortalError(data.error ?? "Something went wrong."); setPortalLoading(false); return; }
      window.location.href = data.url;
    } catch {
      setPortalError("Network error. Please try again.");
      setPortalLoading(false);
    }
  }

  async function handleCheckout() {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setCheckoutLoading(false);
    } catch { setCheckoutLoading(false); }
  }

  return (
    <div className="flex flex-col lg:flex-row w-full" style={{ background: "#f5f5f7" }}>

      {/* ── Left sidebar — desktop only ─────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[180px] shrink-0 sticky top-0 h-screen pt-8 pb-6 border-r border-[#eeeef4]">
        {/* Header */}
        <div className="px-5 mb-5">
          <div className="flex items-center gap-2">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#6a6a90" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" /><circle cx="12" cy="12" r="3" />
            </svg>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#6a6a90]">Settings</span>
          </div>
        </div>
        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all"
                style={{ backgroundColor: isActive ? `${item.color}12` : "transparent" }}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                )}
                <span
                  className="font-mono text-[13px] font-medium transition-colors"
                  style={{ color: isActive ? item.color : "#6a6a90" }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
        {/* Premium badge at bottom */}
        {isPremium && (
          <div className="mt-auto px-5">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#10b981]/20 bg-[#10b981]/8 px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span className="font-mono text-[9px] font-semibold text-[#10b981]">Premium Active</span>
            </div>
          </div>
        )}
      </aside>

      {/* ── Mobile nav — horizontal pill strip ─────────────────────────── */}
      <div className="lg:hidden sticky top-0 z-10 flex gap-1 overflow-x-auto scrollbar-none border-b border-[#eeeef4] px-4 py-2" style={{ background: "#f5f5f7" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="shrink-0 rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold border transition-all whitespace-nowrap"
              style={{
                backgroundColor: isActive ? `${item.color}15` : "transparent",
                borderColor: isActive ? `${item.color}40` : "rgba(0,0,0,0.07)",
                color: isActive ? item.color : "#6a6a90",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto pb-16">
        <div className="mx-auto max-w-[680px] px-6 lg:px-8 space-y-8 pt-8">

          {/* Page header — desktop only (mobile uses the pill strip above) */}
          <div className="hidden lg:flex items-center justify-between gap-4">
            <h1 className="font-mono text-lg font-bold text-[#1a1a2e]">
              {NAV_ITEMS.find((i) => i.id === activeSection)?.label ?? "Settings"}
            </h1>
          </div>

          {/* ── Section tab strip — REMOVED (replaced by left sidebar) ── */}

          {/* ── ACCOUNT ──────────────────────────────────────────────── */}
          <section id="account" ref={(el) => { sectionRefs.current.account = el; }}>
            <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-6 space-y-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
              {/* Avatar + email */}
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold uppercase select-none" style={{ backgroundColor: "#6366f118", color: "#6366f1", border: "1px solid #6366f130" }}>
                  {email.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1a1a2e] truncate">{email}</p>
                  <p className="font-mono text-[10px] text-[#6a6a90] mt-0.5">Signed in via {authProvider.charAt(0).toUpperCase() + authProvider.slice(1)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* <button
                    onClick={() => { setShowEmailForm((v) => !v); setEmailMsg(null); }}
                    className="rounded-lg border border-[#eeeef4] bg-[#f5f5f7] px-3.5 py-2 font-mono text-xs text-[#4a4a6a] hover:border-[#6366f1]/30 hover:text-[#6366f1] transition-all"
                  >
                    Change email
                  </button> */}
                  <button
                    onClick={() => { if (!isDemo) { setShowPasswordForm((v) => !v); setPwMsg(null); } }}
                    disabled={isDemo}
                    title={isDemo ? "Not available in demo" : undefined}
                    className="rounded-lg border border-[#eeeef4] bg-[#f5f5f7] px-3.5 py-2 font-mono text-xs text-[#4a4a6a] hover:border-[#6366f1]/30 hover:text-[#6366f1] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Change password
                  </button>
                  {isDemo && (
                    <span className="font-mono text-[11px] text-[#6a6a90]">Not available in demo</span>
                  )}
                </div>
                {showEmailForm && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="New email address"
                      className="rounded-lg border border-[#eeeef4] bg-[#f5f5f7] px-3 py-1.5 font-mono text-xs text-[#1a1a2e] placeholder-[#58588a] focus:outline-none focus:border-[#6366f1]/40 transition-all w-56"
                    />
                    <button
                      onClick={handleChangeEmail}
                      disabled={emailLoading || !newEmail.trim()}
                      className="rounded-lg bg-[#6366f1] px-3.5 py-1.5 font-mono text-xs font-semibold text-[#1a1a2e] hover:bg-[#5254cc] disabled:opacity-50 transition-all"
                    >
                      {emailLoading ? "Saving…" : "Update"}
                    </button>
                    <button onClick={() => setShowEmailForm(false)} className="font-mono text-[11px] text-[#6a6a90] hover:text-[#4a4a6a] transition-colors">Cancel</button>
                  </div>
                )}
                {emailMsg && <p className={`font-mono text-[11px] ${emailMsg.ok ? "text-[#10b981]" : "text-red-400"}`}>{emailMsg.text}</p>}
                {showPasswordForm && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-[11px] text-[#4a4a6a]">A reset link will be sent to <span className="text-[#1a1a2e]">{email}</span>.</p>
                    <button
                      onClick={handleChangePassword}
                      disabled={pwLoading}
                      className="rounded-lg bg-[#6366f1] px-3.5 py-1.5 font-mono text-xs font-semibold text-[#1a1a2e] hover:bg-[#5254cc] disabled:opacity-50 transition-all"
                    >
                      {pwLoading ? "Sending…" : "Send reset link"}
                    </button>
                    <button onClick={() => setShowPasswordForm(false)} className="font-mono text-[11px] text-[#6a6a90] hover:text-[#4a4a6a] transition-colors">Cancel</button>
                  </div>
                )}
                {pwMsg && <p className={`font-mono text-[11px] ${pwMsg.ok ? "text-[#10b981]" : "text-red-400"}`}>{pwMsg.text}</p>}
              </div>

              {/* Danger zone */}
              {/* <div className="border-t border-[#eeeef4] pt-5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#ef4444]/70 mb-3">Danger zone</p>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-lg border border-red-500/20 px-3.5 py-2 font-mono text-xs font-semibold text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
                  >
                    Delete account
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-xs text-[#1a1a2e]">Are you sure? This is permanent.</p>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                      className="rounded-lg bg-red-500 px-3.5 py-2 font-mono text-xs font-bold text-[#1a1a2e] hover:bg-red-600 disabled:opacity-60 transition-all"
                    >
                      {deleteLoading ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="rounded-lg border border-[#eeeef4] px-3.5 py-2 font-mono text-xs text-[#6a6a90] hover:text-[#4a4a6a] transition-all">
                      Cancel
                    </button>
                  </div>
                )}
              </div> */}
            </div>
          </section>

          {/* ── BUSINESS PROFILE ─────────────────────────────────────── */}
          <section id="business" ref={(el) => { sectionRefs.current.business = el; }}>
            <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-6 space-y-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
              <div>
                <SectionLabel color="#a78bfa">Business Profile</SectionLabel>
                <p className="font-mono text-[10px] text-[#58588a] mt-1">
                  This context is fed to the AI Advisor to personalise every insight.
                </p>
              </div>

              {/* Website URL */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#6a6a90]">Website URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={bizWebsite}
                    onChange={(e) => setBizWebsite(e.target.value)}
                    placeholder="https://yourdomain.com"
                    className="flex-1 min-w-0 rounded-lg border border-[#eeeef4] bg-[#f5f5f7] px-3 py-2 font-mono text-xs text-[#1a1a2e] placeholder-[#58588a] focus:outline-none focus:border-[#a78bfa]/40 transition-all"
                  />
                  <button
                    onClick={handleBizAnalyse}
                    disabled={bizAnalysing || !bizWebsite.trim()}
                    title="AI-extract description from website"
                    className="shrink-0 flex items-center gap-1.5 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/8 px-3 py-2 font-mono text-[10px] font-semibold text-[#a78bfa] hover:bg-[#a78bfa]/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {bizAnalysing ? (
                      <svg className="animate-spin" width="11" height="11" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    ) : (
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                      </svg>
                    )}
                    {bizAnalysing ? "Analysing…" : "Analyse"}
                  </button>
                </div>
                {bizAnalyseMsg && (
                  <p className={`font-mono text-[10px] mt-1 ${bizAnalyseMsg.startsWith("✓") ? "text-[#10b981]" : "text-red-400"}`}>
                    {bizAnalyseMsg}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#6a6a90]">Business Description</label>
                <textarea
                  value={bizDescription}
                  onChange={(e) => setBizDescription(e.target.value)}
                  placeholder="What does your business do? Who is it for? What problem does it solve?"
                  rows={4}
                  className="w-full rounded-lg border border-[#eeeef4] bg-[#f5f5f7] px-3 py-2 font-mono text-xs text-[#1a1a2e] placeholder-[#58588a] focus:outline-none focus:border-[#a78bfa]/40 transition-all resize-y"
                />
                <p className="font-mono text-[9px] text-[#58588a]">{bizDescription.length}/500 chars</p>
              </div>

              {/* Industry */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#6a6a90]">Industry</label>
                <div className="flex flex-wrap gap-1.5">
                  {["SaaS", "E-commerce", "Agency", "Media & Content", "Marketplace", "Consumer App", "Fintech", "Healthcare", "Education", "Other"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setBizIndustry(opt === bizIndustry ? "" : opt)}
                      className="rounded-lg border px-3 py-1.5 font-mono text-[11px] font-medium transition-all"
                      style={{
                        backgroundColor: bizIndustry === opt ? "rgba(167,139,250,0.12)" : "#f5f5f7",
                        borderColor:     bizIndustry === opt ? "rgba(167,139,250,0.35)" : "rgba(0,0,0,0.07)",
                        color:           bizIndustry === opt ? "#a78bfa" : "#58588a",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleBizSave}
                  disabled={bizSaving || !bizProfileLoaded}
                  className="rounded-lg bg-[#a78bfa] px-4 py-2 font-mono text-xs font-semibold text-[#1a1a2e] hover:bg-[#9061f9] disabled:opacity-50 transition-all"
                >
                  {bizSaving ? "Saving…" : "Save profile"}
                </button>
                {bizSaveMsg && (
                  <p className={`font-mono text-[10px] ${bizSaveMsg.ok ? "text-[#10b981]" : "text-red-400"}`}>
                    {bizSaveMsg.text}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── SUBSCRIPTION ─────────────────────────────────────────── */}
          <section id="subscription" ref={(el) => { sectionRefs.current.subscription = el; }}>
            <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
              {isPremium ? (
                <div className="space-y-5">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#10b981]/20 bg-[#10b981]/10">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#1a1a2e]">Premium — Active</p>
                        <span className="rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#10b981]">✓ Active</span>
                      </div>
                      <p className="font-mono text-[10px] text-[#6a6a90] mt-0.5">
                        {subDetails ? `${subDetails.price} · Renews ${subDetails.renewal}` : "$19 / month"}
                      </p>
                    </div>
                  </div>

                  {/* Includes */}
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#58588a] mb-2">Included</p>
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-6">
                      {["All integrations", "AI Advisor", "Daily insights", "Website analyzer", "Anomaly alerts", "Priority support"].map((item) => (
                        <div key={item} className="flex items-center gap-1.5">
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <p className="font-mono text-[11px] text-[#4a4a6a]">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Manage button */}
                  {portalError && <p className="text-xs text-red-400">{portalError}</p>}
                  <button
                    onClick={handlePortal} disabled={portalLoading}
                    className="flex items-center gap-2 rounded-xl border border-[#eeeef4] bg-[#f5f5f7] px-4 py-2 font-mono text-xs text-[#4a4a6a] hover:border-[#10b981]/30 hover:text-[#10b981] disabled:opacity-60 transition-all"
                  >
                    {portalLoading ? (
                      <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Opening…</>
                    ) : (
                      <><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>Manage billing</>
                    )}
                  </button>
                  <p className="font-mono text-[9px] text-[#58588a]">Redirects to Stripe's secure portal.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#8b5cf6]/15 bg-[#8b5cf6]/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6]">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1a1a2e]">Upgrade to Premium</p>
                        <p className="mt-0.5 text-xs text-[#4a4a6a]">Analytics, AI advisor, website optimizer & all integrations.</p>
                        <p className="mt-1.5 font-mono text-xs font-bold text-[#1a1a2e]">$19<span className="font-normal text-[#6a6a90]">/month</span> <span className="ml-1.5 rounded-full bg-[#10b981]/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-[#10b981]">7-day free trial</span></p>
                      </div>
                    </div>
                  </div>
                  <button onClick={handleCheckout} disabled={checkoutLoading} className="inline-flex items-center gap-2 rounded-xl bg-[#10b981] px-5 py-2 font-mono text-sm font-bold text-[#1a1a2e] hover:bg-[#059669] transition disabled:opacity-60">
                    {checkoutLoading ? "Redirecting…" : "Start free trial →"}
                  </button>
                  <p className="font-mono text-[9px] text-[#58588a]">Card required · $19/mo after 7 days · cancel anytime</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

    </div>
  );
}