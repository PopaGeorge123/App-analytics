import { NextRequest, NextResponse } from "next/server";
import { handleGoogleCallback } from "@/lib/integrations/ga4/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&google=error", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  try {
    // Save the token only — backfill runs locally via:
    //   node cronscript/sync-all.mjs --backfill --user <userId> --platform ga4
    await handleGoogleCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard/ga4-setup", process.env.NEXT_PUBLIC_APP_URL)
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&google=error", process.env.NEXT_PUBLIC_APP_URL)
    );
  }
}
