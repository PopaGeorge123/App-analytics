import Link from "next/link";
import type { ReactNode } from "react";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f8] text-[#1a1a2e]">
      <header className="sticky top-0 z-40 border-b border-[#d4d4e8] bg-[#f0f0f8]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/fold-icon.svg" alt="Fold" className="h-7 w-auto transition-opacity group-hover:opacity-80" />
            <span className="font-mono text-sm font-semibold text-[#1a1a2e]">Fold</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/blog" className="font-mono text-[11px] text-[#6a6a90] hover:text-[#1a1a2e]">← Blog</Link>
            <Link href="/signup" className="rounded-xl bg-[#00d4aa] px-4 py-2 font-mono text-[11px] font-bold text-[#3a3a4e] transition hover:bg-[#00bfa0]">
              Try Free →
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-[#d4d4e8] py-8 text-center font-mono text-[11px] text-[#58588a]">
        © {new Date().getFullYear()} Fold Analytics ·{" "}
        <Link href="/privacy" className="hover:text-[#5a5a7a]">Privacy</Link> ·{" "}
        <Link href="/terms" className="hover:text-[#5a5a7a]">Terms</Link>
      </footer>
    </div>
  );
}
