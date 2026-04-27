import { NextRequest, NextResponse } from "next/server";
import { handleFathomOAuthCallback } from "@/lib/integrations/fathom/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&fathom=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleFathomOAuthCallback(state, code);
    await notifyIntegrationConnected(state, "fathom");
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&fathom=connected&syncing=fathom", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Fathom OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&fathom=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
