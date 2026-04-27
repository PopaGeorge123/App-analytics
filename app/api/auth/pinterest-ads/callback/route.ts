import { NextRequest, NextResponse } from "next/server";
import { handlePinterestAdsOAuthCallback } from "@/lib/integrations/pinterest-ads/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&pinterest-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handlePinterestAdsOAuthCallback(state, code);
    await notifyIntegrationConnected(state, "pinterest-ads");
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&pinterest-ads=connected&syncing=pinterest-ads", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Pinterest Ads OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&pinterest-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
