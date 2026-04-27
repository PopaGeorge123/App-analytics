import { NextRequest, NextResponse } from "next/server";
import { handleGoogleAdsOAuthCallback } from "@/lib/integrations/google-ads/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&google-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  try {
    await handleGoogleAdsOAuthCallback(state, code);
    await notifyIntegrationConnected(state, "google-ads");
    return NextResponse.redirect(
      new URL(
        "/dashboard?tab=settings&google-ads=connected&syncing=google-ads",
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
  } catch (err) {
    console.error("Google Ads OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&google-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
