import { NextRequest, NextResponse } from "next/server";
import { handleZendeskOAuthCallback } from "@/lib/integrations/zendesk/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state") ?? "";
  const error = searchParams.get("error");

  // state format: "userId:subdomain"
  const [userId, subdomain] = rawState.split(":");

  if (error || !code || !userId || !subdomain) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&zendesk=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleZendeskOAuthCallback(userId, code, subdomain);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&zendesk=connected&syncing=zendesk", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Zendesk OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&zendesk=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
