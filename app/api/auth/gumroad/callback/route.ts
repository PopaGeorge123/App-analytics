import { NextRequest, NextResponse } from "next/server";
import { handleGumroadOAuthCallback } from "@/lib/integrations/gumroad/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&gumroad=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  try {
    await handleGumroadOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&gumroad=connected&syncing=gumroad", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Gumroad OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&gumroad=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
