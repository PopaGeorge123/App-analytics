"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { gtagConversion, gtagEvent, CONVERSIONS } from "@/lib/utils/gtag";

/**
 * Drop this into your dashboard page (or layout).
 * It reads the URL params your OAuth callbacks already set
 * and fires the appropriate Google Ads conversion.
 *
 * Params detected:
 *   ?syncing=<platform>   → fires INTEGRATION_CONNECT conversion
 *   ?signup=1             → fires SIGN_UP conversion (add this param after auth)
 */
export default function ConversionTracker() {
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;

    const syncing = searchParams.get("syncing");
    const signup  = searchParams.get("signup");

    if (syncing) {
      gtagConversion(CONVERSIONS.INTEGRATION_CONNECT);
      gtagEvent("integration_connected", { platform: syncing });
      fired.current = true;
    }

    if (signup === "1") {
      gtagConversion(CONVERSIONS.SIGN_UP);
      gtagEvent("sign_up", { method: "email" });
      fired.current = true;
    }
  }, [searchParams]);

  return null;
}
