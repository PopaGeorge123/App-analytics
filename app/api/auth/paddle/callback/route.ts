import { NextResponse } from "next/server";

/**
 * Paddle Billing v2 uses API keys, not OAuth.
 * This callback endpoint is no longer used — connection is handled via the settings modal
 * at /api/auth/paddle/connect (POST with { apiKey }).
 */
export async function GET() {
  return NextResponse.redirect(
    new URL("/dashboard?tab=settings&paddle=error&reason=oauth_not_supported", process.env.NEXT_PUBLIC_APP_URL),
  );
}
