import { NextRequest, NextResponse } from "next/server";
import { handleNotionOAuthCallback } from "@/lib/integrations/notion/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&notion=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  try {
    await handleNotionOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&notion=connected&syncing=notion", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Notion OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&notion=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
