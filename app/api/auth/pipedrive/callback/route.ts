import { NextRequest, NextResponse } from "next/server";
import { handlePipedriveOAuthCallback } from "@/lib/integrations/pipedrive/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&pipedrive=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handlePipedriveOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&pipedrive=connected&syncing=pipedrive", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Pipedrive OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&pipedrive=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
