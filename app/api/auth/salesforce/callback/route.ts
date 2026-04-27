import { NextRequest, NextResponse } from "next/server";
import { handleSalesforceOAuthCallback } from "@/lib/integrations/salesforce/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&salesforce=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleSalesforceOAuthCallback(state, code);
    await notifyIntegrationConnected(state, "salesforce");
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&salesforce=connected&syncing=salesforce", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Salesforce OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&salesforce=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
