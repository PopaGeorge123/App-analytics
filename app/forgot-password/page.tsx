"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "check-email";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("form");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      }
    );

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setStep("check-email");
  }

  if (step === "check-email") {
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
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">
            Check your email
          </p>
          <h1 className="mb-4 font-mono text-2xl font-bold text-[#f0f0f5]">
            Reset link sent!
          </h1>
          <p className="text-sm leading-relaxed text-[#8888aa]">
            If an account exists for{" "}
            <span className="font-semibold text-[#f0f0f5]">{email}</span>,
            you&apos;ll receive a password reset link shortly.
          </p>
          <p className="mt-6 text-xs text-[#4a4a6a]">
            Remembered your password?{" "}
            <Link
              href="/login"
              className="text-[#00d4aa] hover:underline underline-offset-4"
            >
              Sign in
            </Link>
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
              Forgot password?
            </h1>
            <p className="mt-1 text-sm text-[#8888aa]">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-[#4a4a6a]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                disabled={loading}
                className="w-full rounded-xl border border-[#1e1e2e] bg-[#12121a] px-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a6a] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
              />
            </div>

            {/* Error */}
            {error && (
              <p
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email}
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
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-[#4a4a6a]">
          Remembered your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#00d4aa] hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
