import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "./providers";
import Script from "next/script";
import { GA_MEASUREMENT_ID, GADS_CONVERSION_ID } from "@/lib/analytics/gtag";
import GoogleAdsScript from "@/components/GoogleAdsScript";

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
        <Script async src="https://www.googletagmanager.com/gtag/js?id=AW-17987006280"></Script>
        <Script id="gtag-init-aw" strategy="afterInteractive" dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17987006280');
          `,
        }} />
        
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-YYVDYMF75Q" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive" dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-YYVDYMF75Q');
          `,
        }} />

        <Script id="facebook-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '2543614049387480');
            fbq('track', 'PageView');
          `,
        }} />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img height="1" width="1" style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=2543614049387480&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>

        {/* Google tag — fires on every page */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
                ${GADS_CONVERSION_ID ? `gtag('config', '${GADS_CONVERSION_ID}');` : ""}
              `}
            </Script>
          </>
        )}

        <GoogleAdsScript />
      </head>
      <body className="min-h-full flex flex-col bg-[#13131f]">
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
