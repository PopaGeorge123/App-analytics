import { NextRequest, NextResponse } from "next/server";
import { handleLinkedInAdsOAuthCallback } from "@/lib/integrations/linkedin-ads/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&linkedin-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleLinkedInAdsOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&linkedin-ads=connected&syncing=linkedin-ads", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("LinkedIn Ads OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&linkedin-ads=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
