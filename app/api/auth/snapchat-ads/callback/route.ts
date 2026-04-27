import { NextRequest, NextResponse } from "next/server";
import { handleSnapchatAdsOAuthCallback } from "@/lib/integrations/snapchat-ads/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&snapchat-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleSnapchatAdsOAuthCallback(state, code);
    await notifyIntegrationConnected(state, "snapchat-ads");
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&snapchat-ads=connected&syncing=snapchat-ads", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Snapchat Ads OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&snapchat-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
