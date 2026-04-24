"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handleGoogleSignIn() {
    setOauthLoading(true);
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${redirectTo}`,
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
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Incorrect email or password. Please try again."
          : authError.message
      );
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#13131f] px-6 py-24">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-125 w-125 rounded-full bg-[#00d4aa]/4 blur-3xl" />
      </div>
      {/* Subtle dot grid */}
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(#363650 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <div className="relative w-full max-w-md mx-auto">
        {/* Logo */}
        <div className="mb-10 text-center w-full flex items-center justify-center">
          <Link href="/">
            <img src="/fold-primary-dark.svg" alt="Fold Logo" className="mx-auto h-12 w-auto" />
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#363650] bg-[#1c1c2a]/90 p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-7">
            <h1 className="font-mono text-xl font-bold text-[#f8f8fc]">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-[#bcbcd8]">
              Sign in to your Fold account
            </p>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
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
              <label
                htmlFor="email"
                className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-[#8585aa]"
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
                className="w-full rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 text-sm text-[#f8f8fc] placeholder-[#8585aa] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="font-mono text-xs font-semibold uppercase tracking-wider text-[#8585aa]"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="font-mono text-[10px] text-[#00d4aa] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full rounded-xl border border-[#363650] bg-[#222235] px-4 py-3 text-sm text-[#f8f8fc] placeholder-[#8585aa] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
              />
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
              disabled={loading || !email || !password}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4aa] py-3 font-semibold text-sm text-[#13131f] transition-all hover:bg-[#00bfa0] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <svg className="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>

            {/* Legal consent */}
            <p className="text-center font-mono text-[10px] leading-relaxed text-[#3a3a55]">
              By signing in you agree to our{" "}
              <Link href="/terms" className="text-[#58588a] underline underline-offset-2 hover:text-[#8585aa]">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-[#58588a] underline underline-offset-2 hover:text-[#8585aa]">Privacy Policy</Link>.
            </p>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-[#8585aa]">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[#00d4aa] hover:underline underline-offset-4"
          >
            Create one →
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-[#58588a]">
          Just browsing?{" "}
          <Link href="/demo" className="text-[#a78bfa] hover:underline underline-offset-4">
            Try the live demo →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
