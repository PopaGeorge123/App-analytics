import { NextRequest, NextResponse } from "next/server";
import { handleYouTubeOAuthCallback } from "@/lib/integrations/youtube/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&youtube=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleYouTubeOAuthCallback(state, code);
    await notifyIntegrationConnected(state, "youtube");
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&youtube=connected&syncing=youtube", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("YouTube OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&youtube=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
