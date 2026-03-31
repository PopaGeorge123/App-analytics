import { NextRequest, NextResponse } from "next/server";
import { handleSegmentOAuthCallback } from "@/lib/integrations/segment/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&segment=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleSegmentOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&segment=connected&syncing=segment", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Segment OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&segment=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
