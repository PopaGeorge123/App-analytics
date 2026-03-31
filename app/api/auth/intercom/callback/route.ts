import { NextRequest, NextResponse } from "next/server";
import { handleIntercomOAuthCallback } from "@/lib/integrations/intercom/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&intercom=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleIntercomOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&intercom=connected&syncing=intercom", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Intercom OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&intercom=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
