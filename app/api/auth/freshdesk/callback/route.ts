import { NextRequest, NextResponse } from "next/server";
import { handleFreshdeskOAuthCallback } from "@/lib/integrations/freshdesk/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state") ?? "";
  const error = searchParams.get("error");

  // state format: "userId:subdomain"
  const [userId, subdomain] = rawState.split(":");

  if (error || !code || !userId || !subdomain) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&freshdesk=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleFreshdeskOAuthCallback(userId, code, subdomain);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&freshdesk=connected&syncing=freshdesk", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Freshdesk OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&freshdesk=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
