"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "success";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase sets the session from the URL hash automatically
    // We just need to wait a tick for it to be available
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        // No session — the link may be invalid or expired
        setError("This reset link is invalid or has expired. Please request a new one.");
        setReady(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setStep("success");
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  if (step === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6 py-24">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-125 w-125 rounded-full bg-[#00d4aa]/4 blur-3xl" />
        </div>
        <div className="relative w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#00d4aa]/40 bg-[#00d4aa]/10">
            <svg
              className="h-7 w-7 text-[#00d4aa]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">
            Done
          </p>
          <h1 className="mb-4 font-mono text-2xl font-bold text-[#f0f0f5]">
            Password updated!
          </h1>
          <p className="text-sm text-[#8888aa]">
            Redirecting you to the dashboard…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6 py-24">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-125 w-125 rounded-full bg-[#00d4aa]/4 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/">
            <span className="font-mono text-2xl font-bold tracking-tight text-[#f0f0f5]">
              FOLD
            </span>
          </Link>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#4a4a6a]">
            AI Business Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/80 p-8 backdrop-blur-sm">
          <div className="mb-6">
            <h1 className="font-mono text-xl font-bold text-[#f0f0f5]">
              Set new password
            </h1>
            <p className="mt-1 text-sm text-[#8888aa]">
              Choose a strong password for your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* New Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-[#4a4a6a]"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={loading || !ready}
                className="w-full rounded-xl border border-[#1e1e2e] bg-[#12121a] px-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a6a] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-[#4a4a6a]"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading || !ready}
                className="w-full rounded-xl border border-[#1e1e2e] bg-[#12121a] px-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a6a] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
              />
            </div>

            {/* Password strength */}
            {password.length > 0 && (
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      password.length >= [4, 8, 12, 16][i]
                        ? i < 2
                          ? "bg-red-500"
                          : i === 2
                          ? "bg-yellow-500"
                          : "bg-[#00d4aa]"
                        : "bg-[#1e1e2e]"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <p
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400"
                role="alert"
              >
                {error}{" "}
                {error.includes("invalid or expired") && (
                  <Link href="/forgot-password" className="underline text-red-300">
                    Request a new one.
                  </Link>
                )}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !ready || !password || !confirmPassword}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4aa] py-3 font-semibold text-sm text-[#0a0a0f] transition-all hover:bg-[#00bfa0] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
