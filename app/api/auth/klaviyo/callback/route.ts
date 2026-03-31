import { NextRequest, NextResponse } from "next/server";
import { handleKlaviyoOAuthCallback } from "@/lib/integrations/klaviyo/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const codeVerifier = request.cookies.get("klaviyo_cv")?.value ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&klaviyo=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleKlaviyoOAuthCallback(state, code, codeVerifier);
    const response = NextResponse.redirect(
      new URL("/dashboard?tab=settings&klaviyo=connected&syncing=klaviyo", process.env.NEXT_PUBLIC_APP_URL),
    );
    response.cookies.delete("klaviyo_cv");
    return response;
  } catch (err) {
    console.error("Klaviyo OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&klaviyo=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
