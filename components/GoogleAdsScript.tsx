import Script from "next/script";
import { GA_MEASUREMENT_ID, AW_CONVERSION_ID } from "@/lib/utils/gtag";

/**
 * Add this to your root app/layout.tsx inside <head> or just before </body>.
 * It loads both Google Analytics 4 + Google Ads (same gtag.js script).
 */
export default function GoogleAdsScript() {
  const id = AW_CONVERSION_ID || GA_MEASUREMENT_ID;
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          ${GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}');` : ""}
          ${AW_CONVERSION_ID  ? `gtag('config', '${AW_CONVERSION_ID}');`  : ""}
        `}
      </Script>
    </>
  );
}
