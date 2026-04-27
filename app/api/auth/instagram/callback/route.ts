import { NextRequest, NextResponse } from "next/server";
import { handleInstagramOAuthCallback } from "@/lib/integrations/instagram/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&instagram=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleInstagramOAuthCallback(state, code);
    await notifyIntegrationConnected(state, "instagram");
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&instagram=connected&syncing=instagram", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Instagram OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&instagram=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
