import { NextRequest, NextResponse } from "next/server";
import { handleTwitterAdsOAuthCallback } from "@/lib/integrations/twitter-ads/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const codeVerifier = request.cookies.get("twitter_ads_cv")?.value ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&twitter-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  try {
    await handleTwitterAdsOAuthCallback(state, code, codeVerifier);
    const response = NextResponse.redirect(
      new URL(
        "/dashboard?tab=settings&twitter-ads=connected&syncing=twitter-ads",
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
    response.cookies.delete("twitter_ads_cv");
    return response;
  } catch (err) {
    console.error("Twitter Ads OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&twitter-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
