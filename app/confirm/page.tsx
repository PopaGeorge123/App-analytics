import { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/db";

export const metadata: Metadata = {
  title: "Confirm your spot — Pulse",
  description: "Confirm your spot on the Pulse waitlist.",
};

interface ConfirmPageProps {
  searchParams: Promise<{ token?: string }>;
}

type ConfirmResult =
  | { status: "success"; email: string }
  | { status: "already_confirmed" }
  | { status: "invalid" };

async function confirmToken(token: string): Promise<ConfirmResult> {
  if (!token) return { status: "invalid" };

  const { data: entry } = await supabase
    .from("waitlist_entries")
    .select("id, email, status")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (!entry) return { status: "invalid" };

  if (entry.status === "confirmed") return { status: "already_confirmed" };

  await supabase
    .from("waitlist_entries")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", entry.id);

  return { status: "success", email: entry.email };
}

const shareText = encodeURIComponent(
  "Just joined the waitlist for Pulse — an AI-powered business dashboard for founders that connects Stripe, Mailchimp, PostHog, and your ad platforms. Looks really promising 👀"
);
const shareUrl = encodeURIComponent(
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://pulse.so"
);

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const { token } = await searchParams;
  const result = token ? await confirmToken(token) : { status: "invalid" as const };

  if (result.status === "success") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6 py-24">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-96 w-96 rounded-full bg-[#00d4aa]/5 blur-3xl" />
        </div>

        <div className="relative max-w-lg w-full text-center">
          {/* Check icon */}
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-[#00d4aa]/40 bg-[#00d4aa]/10">
            <svg
              className="h-8 w-8 text-[#00d4aa]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">
            Confirmed
          </p>
          <h1 className="mb-4 font-mono text-4xl font-bold text-[#f0f0f5] sm:text-5xl">
            You&apos;re in.&nbsp;🎉
          </h1>
          <p className="mb-10 text-base leading-relaxed text-[#8888aa]">
            Your spot is confirmed. We&apos;ll email you when Pulse is ready for early access.
          </p>

          {/* Share prompt */}
          <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d16]/60 p-6 backdrop-blur-sm">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-[#4a4a6a]">
              Know a founder who&apos;d love this?
            </p>
            <p className="mb-5 text-sm text-[#8888aa]">Share Pulse with your network:</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1e1e2e] bg-[#12121a] px-5 py-3 text-sm font-semibold text-[#f0f0f5] transition-all hover:border-[#00d4aa]/30 hover:bg-[#0a1a16] hover:text-[#00d4aa]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Share on X
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1e1e2e] bg-[#12121a] px-5 py-3 text-sm font-semibold text-[#f0f0f5] transition-all hover:border-[#00d4aa]/30 hover:bg-[#0a1a16] hover:text-[#00d4aa]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                Share on LinkedIn
              </a>
            </div>
          </div>

          <div className="mt-10">
            <Link
              href="/"
              className="text-sm text-[#4a4a6a] underline-offset-4 hover:text-[#8888aa] hover:underline"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (result.status === "already_confirmed") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6 py-24">
        <div className="max-w-lg w-full text-center">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/10">
            <svg
              className="h-8 w-8 text-[#00d4aa]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-4 font-mono text-3xl font-bold text-[#f0f0f5]">
            You&apos;re already on the list!
          </h1>
          <p className="mb-8 text-[#8888aa]">
            Your spot is already confirmed. We&apos;ll be in touch when Pulse launches.
          </p>
          <Link
            href="/"
            className="text-sm text-[#4a4a6a] underline-offset-4 hover:text-[#8888aa] hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  // Invalid / expired token
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6 py-24">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <svg
            className="h-8 w-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="mb-4 font-mono text-3xl font-bold text-[#f0f0f5]">
          Invalid or expired link
        </h1>
        <p className="mb-8 text-[#8888aa]">
          This confirmation link is invalid or has already expired. Try signing up again.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-[#00d4aa] px-6 py-3 text-sm font-semibold text-[#0a0a0f] transition-all hover:bg-[#00bfa0]"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
