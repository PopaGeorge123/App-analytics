import { NextResponse } from "next/server";

/**
 * Paddle Billing v2 uses API keys, not OAuth.
 * This endpoint is no longer used — connection is handled via the settings modal.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Paddle uses API key authentication. Connect via the settings panel." },
    { status: 410 },
  );
}
