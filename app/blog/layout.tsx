import Link from "next/link";
import type { ReactNode } from "react";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#13131f] text-[#f8f8fc]">
      <header className="sticky top-0 z-40 border-b border-[#363650] bg-[#1c1c2a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/fold-icon.svg" alt="Fold" className="h-7 w-auto transition-opacity group-hover:opacity-80" />
            <span className="font-mono text-sm font-semibold text-[#f8f8fc]">Fold</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/blog" className="font-mono text-[11px] text-[#8585aa] hover:text-[#f8f8fc]">← Blog</Link>
            <Link href="/signup" className="rounded-xl bg-[#00d4aa] px-4 py-2 font-mono text-[11px] font-bold text-[#13131f] transition hover:bg-[#00bfa0]">
              Try Free →
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-[#363650] py-8 text-center font-mono text-[11px] text-[#58588a]">
        © {new Date().getFullYear()} Fold Analytics ·{" "}
        <Link href="/privacy" className="hover:text-[#8585aa]">Privacy</Link> ·{" "}
        <Link href="/terms" className="hover:text-[#8585aa]">Terms</Link>
      </footer>
    </div>
  );
}
