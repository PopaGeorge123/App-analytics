import { NextRequest, NextResponse } from "next/server";
import { handlePaddleOAuthCallback } from "@/lib/integrations/paddle/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&paddle=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handlePaddleOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&paddle=connected&syncing=paddle", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Paddle OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&paddle=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
