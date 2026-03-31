import { NextRequest, NextResponse } from "next/server";
import { handleTwitterOrganicOAuthCallback } from "@/lib/integrations/twitter-organic/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const codeVerifier = request.cookies.get("twitter_organic_cv")?.value ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&twitter-organic=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleTwitterOrganicOAuthCallback(state, code, codeVerifier);
    const response = NextResponse.redirect(
      new URL("/dashboard?tab=settings&twitter-organic=connected&syncing=twitter-organic", process.env.NEXT_PUBLIC_APP_URL),
    );
    response.cookies.delete("twitter_organic_cv");
    return response;
  } catch (err) {
    console.error("Twitter Organic OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&twitter-organic=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
