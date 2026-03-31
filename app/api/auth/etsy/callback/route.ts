import { NextRequest, NextResponse } from "next/server";
import { handleEtsyOAuthCallback } from "@/lib/integrations/etsy/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const codeVerifier = request.cookies.get("etsy_cv")?.value ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&etsy=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleEtsyOAuthCallback(state, code, codeVerifier);
    const response = NextResponse.redirect(
      new URL("/dashboard?tab=settings&etsy=connected&syncing=etsy", process.env.NEXT_PUBLIC_APP_URL),
    );
    response.cookies.delete("etsy_cv");
    return response;
  } catch (err) {
    console.error("Etsy OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&etsy=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
