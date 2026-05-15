import type { Metadata } from "next";
import Link from "next/link";
import { posts, categoryLabel, categoryColor } from "./_data/posts";

export const metadata: Metadata = {
  title: "Blog — Fold Analytics | Guides, Comparisons & Strategies for Founders",
  description:
    "In-depth guides on SaaS metrics, revenue analytics, and how to grow a bootstrapped business. Real advice for founders who don't have a data team.",
  openGraph: {
    title: "Fold Analytics Blog",
    description:
      "In-depth guides on SaaS metrics, revenue analytics, and how to grow a bootstrapped business.",
    url: "https://usefold.io/blog",
    siteName: "Fold Analytics",
    type: "website",
  },
};

export default function BlogIndex() {
  const sorted = [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      {/* Hero */}
      <div className="mb-14 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#363650] bg-[#2e2e3c] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#8585aa]">Fold Blog</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#f8f8fc] sm:text-4xl">
          Guides, strategies &amp; comparisons
          <br />
          <span className="text-[#00d4aa]">for founders who track their numbers.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-mono text-sm text-[#8585aa]">
          No fluff. Just the analytics knowledge, tool comparisons, and growth playbooks that
          help bootstrapped founders make better decisions faster.
        </p>
      </div>

      {/* Posts grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((post) => {
          const color = categoryColor[post.category];
          const label = categoryLabel[post.category];
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-[#363650] bg-[#2e2e3c] p-5 transition-all duration-150 hover:border-[#00d4aa]/30 hover:bg-[#222236]"
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest"
                  style={{ color, background: color + "20", border: `1px solid ${color}40` }}
                >
                  {label}
                </span>
                <span className="font-mono text-[10px] text-[#58588a]">{post.readMinutes} min read</span>
              </div>
              <h2 className="mb-2 flex-1 font-mono text-sm font-bold leading-snug text-[#f8f8fc] group-hover:text-[#00d4aa] transition-colors">
                {post.title}
              </h2>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-[#8585aa] line-clamp-3">
                {post.description}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#58588a]">
                  {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="font-mono text-[10px] text-[#00d4aa] opacity-0 transition-opacity group-hover:opacity-100">
                  Read →
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-20 rounded-2xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 p-10 text-center">
        <h2 className="mb-3 font-mono text-xl font-bold text-[#f8f8fc]">
          Stop reading about metrics. Start tracking them.
        </h2>
        <p className="mx-auto mb-6 max-w-md font-mono text-sm text-[#8585aa]">
          Fold connects to Stripe, Meta, Google Ads, GA4, and 20+ other platforms in minutes.
          Your complete business picture — in one dashboard.
        </p>
        <Link
          href="/signup"
          className="inline-block rounded-xl bg-[#00d4aa] px-8 py-3 font-mono text-sm font-bold text-[#252531] transition hover:bg-[#00bfa0]"
        >
          Start free trial →
        </Link>
      </div>
    </main>
  );
}
