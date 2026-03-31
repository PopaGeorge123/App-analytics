import { NextRequest, NextResponse } from "next/server";
import { handleHubSpotOAuthCallback } from "@/lib/integrations/hubspot/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&hubspot=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  try {
    await handleHubSpotOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&hubspot=connected&syncing=hubspot", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("HubSpot OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&hubspot=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
