import { NextRequest, NextResponse } from "next/server";
import { handleMetaCallback } from "@/lib/integrations/meta/callback";
import { backfillMetaHistory } from "@/lib/integrations/meta/backfill";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&meta=error", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  try {
    await handleMetaCallback(state, code);

    // Kick off backfill in background — don't await so redirect is instant
    backfillMetaHistory(state).catch((e) =>
      console.error("[meta/callback] backfill error:", e)
    );

    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&meta=connected", process.env.NEXT_PUBLIC_APP_URL)
    );
  } catch (err) {
    console.error("Meta OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&meta=error", process.env.NEXT_PUBLIC_APP_URL)
    );
  }
}
