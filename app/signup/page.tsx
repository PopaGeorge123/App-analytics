"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "check-email";

const AVATARS = ["J", "S", "T", "M", "A"];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [step, setStep] = useState<Step>("form");

  async function handleGoogleSignUp() {
    setOauthLoading(true);
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setOauthLoading(false);
    }
  }

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

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setStep("check-email");
  }

  // ── Check-email screen ──────────────────────────────────────────────────
  if (step === "check-email") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#13131f] px-6 py-24">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-[#00d4aa]/4 blur-3xl" />
        </div>
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(#363650 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00d4aa]/30 bg-[#00d4aa]/10">
            <svg className="h-7 w-7 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#00d4aa]">Almost there</p>
          <h1 className="mb-4 font-mono text-2xl font-bold text-[#f8f8fc]">Check your inbox</h1>
          <p className="text-sm leading-relaxed text-[#bcbcd8]">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-[#f8f8fc]">{email}</span>.{" "}
            Click it to activate your account.
          </p>
          <p className="mt-8 text-xs text-[#8585aa]">
            Already confirmed?{" "}
            <Link href="/login" className="font-semibold text-[#00d4aa] hover:underline underline-offset-4">Sign in →</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Main signup screen ──────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#13131f] px-6 py-16">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-[#00d4aa]/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[#6366f1]/6 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(#363650 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <img src="/fold-primary-dark.svg" alt="Fold" className="h-8 w-auto" />
          </Link>
        </div>

        {/* Above-card hook */}
        <div className="mb-5 text-center">
          <h1 className="font-mono text-2xl font-bold leading-snug text-[#f8f8fc]">
            Your whole business,<br />
            <span className="text-[#00d4aa]">understood in seconds.</span>
          </h1>
        </div>

        {/* Social proof strip */}
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <div className="flex -space-x-2">
            {AVATARS.map((a, i) => (
              <div
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#13131f] bg-[#363650] font-mono text-[9px] font-bold text-[#00d4aa]"
              >
                {a}
              </div>
            ))}
          </div>
          <p className="font-mono text-[10px] text-[#8585aa]">
            <span className="text-[#f8f8fc] font-semibold">340+ founders</span> joined this week
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/90 p-8 shadow-2xl backdrop-blur-md">

          {/* 3-item value strip */}
          {/* <div className="mb-6 grid grid-cols-3 gap-2">
            {[
              { icon: "⚡", label: "Live KPIs" },
              { icon: "🤖", label: "AI insights" },
              { icon: "🚨", label: "Anomaly alerts" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1 rounded-xl border border-[#363650] bg-[#222235] py-2.5 px-1">
                <span className="text-base">{item.icon}</span>
                <span className="font-mono text-[9px] font-semibold text-[#8585aa]">{item.label}</span>
              </div>
            ))}
          </div> */}

          {/* Trial badge */}
          <div className="mb-5 flex items-center justify-center gap-2 rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span className="font-mono text-[10px] font-semibold text-[#00d4aa]">7-day free trial · No card required</span>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={oauthLoading || loading}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-[#363650] bg-[#222235] py-3 font-mono text-sm font-semibold text-[#f8f8fc] transition-all hover:border-[#8585aa] hover:bg-[#2a2a40] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {oauthLoading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {oauthLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="relative mb-4 flex items-center">
            <div className="flex-1 border-t border-[#363650]" />
            <span className="mx-3 font-mono text-[10px] text-[#58588a]">OR</span>
            <div className="flex-1 border-t border-[#363650]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
            {/* Email */}
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email"
              disabled={loading}
              className="w-full rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 text-sm text-[#f8f8fc] placeholder-[#8585aa] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
            />

            {/* Password */}
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (8+ characters)"
              disabled={loading}
              className="w-full rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 text-sm text-[#f8f8fc] placeholder-[#8585aa] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
            />

            {/* Confirm Password */}
            <div>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                disabled={loading}
                className="w-full rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 text-sm text-[#f8f8fc] placeholder-[#8585aa] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
              />
              {confirmPassword.length > 0 && (
                <p className={`mt-1 font-mono text-[10px] ${password === confirmPassword ? "text-[#00d4aa]" : "text-[#f87171]"}`}>
                  {password === confirmPassword ? "✓ Passwords match" : "✗ Passwords don't match"}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400" role="alert">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password || !confirmPassword}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4aa] py-3.5 font-mono text-sm font-bold text-[#13131f] transition-all hover:bg-[#00bfa0] hover:shadow-[0_0_28px_rgba(0,212,170,0.3)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating account…
                </>
              ) : (
                <>
                  Start free trial
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-sm text-[#8585aa]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#00d4aa] hover:underline underline-offset-4">Sign in →</Link>
        </p>
      </div>
    </div>
  );
}

