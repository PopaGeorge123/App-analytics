"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Property {
  id: string;
  displayName: string;
  accountName: string;
}

export default function GA4SetupPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/google/properties")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setProperties(data.properties ?? []);
          if (data.properties?.length === 1) {
            setSelected(data.properties[0].id);
          }
        }
      })
      .catch(() => setError("Failed to load properties."))
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google/select-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        setSaving(false);
        return;
      }
      router.push("/dashboard?tab=settings&google=connected&syncing=ga4");
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#13131f] px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#363650] bg-[#1c1c2a] p-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f59e0b]/10">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.3 0-7.99 2.47-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#f8f8fc]">Select GA4 Property</h1>
            <p className="text-xs text-[#8585aa]">Choose which website to track</p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="h-6 w-6 animate-spin text-[#00d4aa]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="ml-3 text-sm text-[#8585aa]">Loading properties…</span>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
            <button
              onClick={() => router.push("/dashboard?tab=settings")}
              className="mt-3 block text-xs text-[#8585aa] underline hover:text-[#bcbcd8]"
            >
              ← Back to Settings
            </button>
          </div>
        ) : properties.length === 0 ? (
          <div className="rounded-lg border border-[#363650] bg-[#222235] p-6 text-center">
            <p className="text-sm text-[#8585aa]">No GA4 properties found on this Google account.</p>
            <p className="mt-1 text-xs text-[#8585aa]">Make sure Google Analytics 4 is set up at analytics.google.com</p>
            <button
              onClick={() => router.push("/dashboard?tab=settings")}
              className="mt-4 text-xs text-[#8585aa] underline hover:text-[#bcbcd8]"
            >
              ← Back to Settings
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-6">
              {properties.map((prop) => (
                <label
                  key={prop.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                    selected === prop.id
                      ? "border-[#00d4aa]/40 bg-[#00d4aa]/5"
                      : "border-[#363650] bg-[#222235] hover:border-[#8585aa]"
                  }`}
                >
                  <input
                    type="radio"
                    name="property"
                    value={prop.id}
                    checked={selected === prop.id}
                    onChange={() => setSelected(prop.id)}
                    className="accent-[#00d4aa]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#f8f8fc]">{prop.displayName}</p>
                    <p className="truncate text-xs text-[#8585aa]">
                      {prop.accountName} · Property {prop.id}
                    </p>
                  </div>
                  {selected === prop.id && (
                    <svg className="h-4 w-4 shrink-0 text-[#00d4aa]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
              ))}
            </div>

            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard?tab=settings")}
                className="rounded-xl border border-[#363650] px-4 py-2.5 text-sm text-[#8585aa] transition-all hover:text-[#bcbcd8]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selected || saving}
                className="flex-1 rounded-xl bg-[#00d4aa] px-4 py-2.5 text-sm font-semibold text-[#13131f] transition-all hover:bg-[#00bfa0] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Connecting…
                  </>
                ) : (
                  "Connect Property →"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
