import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "./providers";
import Script from "next/script";

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
    icon: [
      { url: "/fold-icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/fold-icon.svg",
    apple: "/fold-icon.svg",
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
        url: "/api/og",
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
    images: ["/api/og"],
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
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-N3XP5NL7');`,
          }}
        />
        {/* End Google Tag Manager */}
      </head>
      <body className="min-h-full flex flex-col bg-[#13131f]">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-N3XP5NL7"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        {/* gtag.js — required for window.gtag() used by ConversionTracker */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=AW-17987006280`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17987006280');
          `}
        </Script>

        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
