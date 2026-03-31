import { NextRequest, NextResponse } from "next/server";
import { handleTikTokAdsOAuthCallback } from "@/lib/integrations/tiktok-ads/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&tiktok-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleTikTokAdsOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&tiktok-ads=connected&syncing=tiktok-ads", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("TikTok Ads OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&tiktok-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
