"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6 py-24">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-125 w-125 rounded-full bg-[#00d4aa]/4 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md mx-auto">
        {/* Logo */}
        <div className="mb-10 text-center w-full flex items-center justify-center">
          <Link href="/">
            <img src="/fold-primary-dark.svg" alt="Fold Logo" className="mx-auto h-12 w-auto" />
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/80 p-8 backdrop-blur-sm">
          <div className="mb-6">
            <h1 className="font-mono text-xl font-bold text-[#f0f0f5]">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-[#8888aa]">
              Sign in to your Fold account
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

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="font-mono text-xs font-semibold uppercase tracking-wider text-[#4a4a6a]"
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
                className="w-full rounded-xl border border-[#1e1e2e] bg-[#12121a] px-4 py-3 text-sm text-[#f0f0f5] placeholder-[#4a4a6a] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60"
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
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4aa] py-3 font-semibold text-sm text-[#0a0a0f] transition-all hover:bg-[#00bfa0] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
                "Sign in"
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-[#4a4a6a]">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[#00d4aa] hover:underline underline-offset-4"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
