export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
export const AW_CONVERSION_ID  = process.env.NEXT_PUBLIC_AW_CONVERSION_ID  ?? ""; // e.g. AW-123456789

/** Fire a Google Ads conversion event */
export function gtagConversion(label: string, value?: number) {
  if (typeof window === "undefined" || !AW_CONVERSION_ID) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).gtag?.("event", "conversion", {
    send_to: `${AW_CONVERSION_ID}/${label}`,
    value,
    currency: "USD",
  });
}

/** Fire a generic GA4 event */
export function gtagEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).gtag?.("event", name, params);
}

// Conversion labels — create matching entries in Google Ads → Goals → Conversions
export const CONVERSIONS = {
  SIGN_UP:              process.env.NEXT_PUBLIC_AW_LABEL_SIGNUP    ?? "",
  INTEGRATION_CONNECT:  process.env.NEXT_PUBLIC_AW_LABEL_CONNECT   ?? "",
};
