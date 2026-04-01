import { NextRequest, NextResponse } from "next/server";
import { handleConvertKitOAuthCallback } from "@/lib/integrations/convertkit/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&convertkit=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleConvertKitOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&convertkit=connected&syncing=convertkit", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("ConvertKit OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&convertkit=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
