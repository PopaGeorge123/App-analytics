"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "check-email";

// ── Micro social-proof quotes ─────────────────────────────────────────────
const QUOTES = [
  { text: "Saved me 4 hours every Monday. I actually understand my business now.", author: "James R.", role: "SaaS founder, $28k MRR" },
  { text: "Connected Stripe + GA4 in 2 minutes. Had my first insight before I finished my coffee.", author: "Sara M.", role: "E-commerce founder" },
  { text: "The AI advisor caught a revenue dip I would have missed for weeks.", author: "Tobias K.", role: "Newsletter creator, 18k subs" },
];

// ── What you get bullets ──────────────────────────────────────────────────
const BULLETS = [
  { icon: "⚡", text: "Live KPI dashboard — revenue, sessions, ad spend, subscribers" },
  { icon: "🤖", text: "AI business advisor explains what changed and why" },
  { icon: "🔗", text: "11+ integrations: Stripe, GA4, Meta Ads, Shopify, Mailchimp…" },
  { icon: "📬", text: "Daily email digest — your whole business in 60 seconds" },
  { icon: "🚨", text: "Anomaly alerts before small dips become big problems" },
];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [quoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));

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
    // On success Supabase redirects — no further client action needed
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

  // ── Password strength ───────────────────────────────────────────────────
  const strength =
    password.length === 0 ? 0
    : password.length < 8 ? 1
    : password.length < 12 ? 2
    : password.length < 16 ? 3
    : 4;
  const strengthLabel = ["", "Too short", "Weak", "Good", "Strong"][strength];
  const strengthColor = ["", "#f87171", "#f59e0b", "#60a5fa", "#00d4aa"][strength];

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
            Click it to activate your account — then connect your first integration in under 2 minutes.
          </p>
          <div className="mt-6 rounded-xl border border-[#363650] bg-[#1c1c2a]/60 px-5 py-4 text-left">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#8585aa] mb-3">What happens next</p>
            <ol className="space-y-2">
              {["Confirm your email (1 click)", "Connect Stripe, GA4, or any integration (90 sec)", "Your first dashboard is live"].map((s, i) => (
                <li key={s} className="flex items-center gap-3 font-mono text-xs text-[#e0e0f0]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00d4aa]/15 font-bold text-[10px] text-[#00d4aa]">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-8 text-xs text-[#8585aa]">
            Already confirmed?{" "}
            <Link href="/login" className="font-semibold text-[#00d4aa] hover:underline underline-offset-4">Sign in →</Link>
          </p>
        </div>
      </div>
    );
  }

  const quote = QUOTES[quoteIdx];

  // ── Main signup screen ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#13131f] text-[#f8f8fc]">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-[#00d4aa]/4 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#6366f1]/5 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#363650 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      </div>

      <div className="relative flex min-h-screen flex-col lg:flex-row">

        {/* ── LEFT: Value proposition ───────────────────────────────── */}
        <div className="flex flex-col justify-between px-8 py-12 lg:w-[52%] lg:px-16 lg:py-20">

          {/* Logo */}
          <Link href="/" className="mb-12 block">
            <img src="/fold-primary-dark.svg" alt="Fold" className="h-10 w-auto" />
          </Link>

          <div className="flex-1 flex flex-col justify-center max-w-lg">
            {/* Urgency hook */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/8 px-3 py-1.5 w-fit">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#f59e0b]">
                3-day free trial · No card required
              </span>
            </div>

            <h1 className="mb-4 font-mono text-3xl font-bold leading-snug tracking-tight text-[#f8f8fc] lg:text-[2.4rem] lg:leading-tight">
              Your business in one tab.{" "}
              <span className="text-[#00d4aa]">Before your first coffee.</span>
            </h1>
            <p className="mb-8 text-base leading-relaxed text-[#bcbcd8]">
              Stop switching between Stripe, GA4, Meta Ads, and Mailchimp every morning.
              Fold pulls it all together and tells you <strong className="text-[#f8f8fc] font-semibold">exactly what changed and what to do</strong>.
            </p>

            {/* Feature bullets */}
            <ul className="mb-10 space-y-3">
              {BULLETS.map((b) => (
                <li key={b.text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1c1c2a] border border-[#363650] text-sm">{b.icon}</span>
                  <span className="text-sm text-[#e0e0f0] leading-snug">{b.text}</span>
                </li>
              ))}
            </ul>

            {/* Social proof quote */}
            <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/60 p-5">
              <div className="mb-3 flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-3.5 w-3.5 text-[#f59e0b]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-[#e0e0f0]">&ldquo;{quote.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#363650] font-mono text-xs font-bold text-[#00d4aa]">
                  {quote.author[0]}
                </div>
                <div>
                  <p className="font-mono text-xs font-semibold text-[#f8f8fc]">{quote.author}</p>
                  <p className="font-mono text-[10px] text-[#8585aa]">{quote.role}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom trust bar */}
          <div className="mt-10 flex flex-wrap items-center gap-4 lg:mt-0">
            {[
              { icon: "🔒", label: "SOC 2 encrypted" },
              { icon: "🚫", label: "Never sold to third parties" },
              { icon: "🗑️", label: "Delete your data anytime" },
            ].map((t) => (
              <span key={t.label} className="flex items-center gap-1.5 font-mono text-[10px] text-[#58588a]">
                <span>{t.icon}</span>{t.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Sign-up form ───────────────────────────────────── */}
        <div className="flex items-center justify-center px-6 py-12 lg:w-[48%] lg:px-16">
          <div className="w-full max-w-sm">

            {/* Card */}
            <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/90 p-8 shadow-2xl backdrop-blur-md">

              {/* Header */}
              <div className="mb-7">
                <h2 className="font-mono text-xl font-bold text-[#f8f8fc]">Create your account</h2>
                <p className="mt-1 text-sm text-[#bcbcd8]">Free for 3 days — upgrade only if you love it</p>
              </div>

              {/* Google OAuth */}
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={oauthLoading || loading}
                className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-[#363650] bg-[#222235] py-3 font-mono text-sm font-semibold text-[#f8f8fc] transition-all hover:border-[#8585aa] hover:bg-[#2a2a40] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="relative mb-5 flex items-center">
                <div className="flex-1 border-t border-[#363650]" />
                <span className="mx-3 font-mono text-[10px] text-[#58588a]">OR</span>
                <div className="flex-1 border-t border-[#363650]" />
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-[#8585aa]">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    disabled={loading}
                    className="w-full rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 text-sm text-[#f8f8fc] placeholder-[#8585aa] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-[#8585aa]">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    disabled={loading}
                    className="w-full rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 text-sm text-[#f8f8fc] placeholder-[#8585aa] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
                  />
                  {/* Strength bar */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{ backgroundColor: i <= strength ? strengthColor : "#363650" }}
                          />
                        ))}
                      </div>
                      <p className="font-mono text-[10px]" style={{ color: strengthColor }}>{strengthLabel}</p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-[#8585aa]">
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
                    disabled={loading}
                    className="w-full rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 text-sm text-[#f8f8fc] placeholder-[#8585aa] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
                  />
                  {/* Match indicator */}
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
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4aa] py-3.5 font-mono text-sm font-bold text-[#13131f] transition-all hover:bg-[#00bfa0] hover:shadow-[0_0_24px_rgba(0,212,170,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
                      Start free — no card needed
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Micro trust row */}
                <div className="flex items-center justify-center gap-4 pt-1">
                  {["No card required", "Cancel anytime", "Takes 90 seconds"].map((t) => (
                    <span key={t} className="flex items-center gap-1 font-mono text-[9px] text-[#58588a]">
                      <svg className="h-2.5 w-2.5 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {t}
                    </span>
                  ))}
                </div>

                <p className="text-center text-[10px] text-[#8585aa]">
                  By continuing you agree to our{" "}
                  <Link href="/terms" className="text-[#00d4aa] hover:underline underline-offset-4">Terms</Link>{" "}and{" "}
                  <Link href="/privacy" className="text-[#00d4aa] hover:underline underline-offset-4">Privacy Policy</Link>.
                </p>
              </form>
            </div>

            {/* Footer */}
            <p className="mt-5 text-center text-sm text-[#8585aa]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[#00d4aa] hover:underline underline-offset-4">Sign in →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
