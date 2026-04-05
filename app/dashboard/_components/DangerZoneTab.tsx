"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DangerZoneTab({ email }: { email: string }) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const CONFIRM_PHRASE = "delete my account";
  const isReady = confirm.toLowerCase() === CONFIRM_PHRASE;

  async function handleDelete() {
    if (!isReady) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Sign out locally then redirect to homepage
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <h1 className="font-mono text-lg font-bold text-[#f8f8fc]">Danger Zone</h1>
        </div>
        <p className="font-mono text-xs text-[#8585aa]">
          Irreversible actions — read carefully before proceeding.
        </p>
      </div>

      {/* Export data reminder */}
      <div className="rounded-xl border border-[#363650] bg-[#1c1c2a]/60 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#363650] bg-[#222235] text-[#8585aa]">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
          <div>
            <p className="font-mono text-xs font-semibold text-[#bcbcd8] mb-1">Before you delete</p>
            <p className="font-mono text-[11px] text-[#8585aa] leading-relaxed">
              Your connected integrations, all synced data, AI conversations, website analysis, and account settings will be permanently deleted. This cannot be undone.
            </p>
            <p className="font-mono text-[11px] text-[#8585aa] leading-relaxed mt-1">
              Your data in Stripe, Google Analytics, and other platforms is not affected — only your Fold account is removed.
            </p>
          </div>
        </div>
      </div>

      {/* Delete account card */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-sm font-bold text-red-400 mb-1">Delete account</p>
            <p className="font-mono text-[11px] text-[#8585aa] leading-relaxed">
              Permanently deletes your account for{" "}
              <span className="text-[#bcbcd8] font-semibold">{email}</span> and all associated data.
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </div>
        </div>

        {/* What gets deleted */}
        <div className="grid grid-cols-2 gap-2">
          {[
            "All synced data & snapshots",
            "AI conversations & messages",
            "Website analysis & tasks",
            "Connected integrations",
            "Alert rules & notifications",
            "Goals & KPI targets",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="font-mono text-[10px] text-[#8585aa]">{item}</span>
            </div>
          ))}
        </div>

        {/* Confirmation input */}
        <div className="space-y-2">
          <label className="block font-mono text-[11px] text-[#8585aa]">
            Type{" "}
            <span className="font-semibold text-[#bcbcd8] select-all">
              delete my account
            </span>{" "}
            to confirm:
          </label>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="delete my account"
            disabled={loading}
            className="w-full rounded-lg border border-[#363650] bg-[#13131f] px-3 py-2.5 font-mono text-sm text-[#f8f8fc] placeholder:text-[#4a4a6a] focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="font-mono text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={!isReady || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 font-mono text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Deleting account…
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Permanently delete my account
            </>
          )}
        </button>
      </div>
    </div>
  );
}
