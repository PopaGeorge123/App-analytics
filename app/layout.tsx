import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://usefold.io/";

export const metadata: Metadata = {
  icons: {
    icon: "/fold-icon.svg",
  },
  title: "Fold — AI Business Intelligence for Founders",
  description:
    "Fold connects to Stripe, Mailchimp, PostHog, and your ad platforms then uses AI to tell you exactly what's happening, what went wrong, and what to do next to grow revenue.",
  metadataBase: new URL(baseUrl),
  openGraph: {
    type: "website",
    url: baseUrl,
    title: "Fold — AI Business Intelligence for Founders",
    description:
      "Your entire business, understood in seconds. AI-powered dashboard that connects Stripe, Mailchimp, PostHog, Meta Ads & Google Ads.",
    siteName: "Fold",
    images: [
      {
        url: "/fold-primary-dark.svg",
        width: 1200,
        height: 630,
        alt: "Fold — AI Business Intelligence Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fold — AI Business Intelligence for Founders",
    description:
      "Your entire business, understood in seconds. AI-powered dashboard for founders.",
    images: ["/fold-primary-dark.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0f]">
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
