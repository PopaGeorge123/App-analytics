import { NextRequest, NextResponse } from "next/server";
import { handleActiveCampaignOAuthCallback } from "@/lib/integrations/activecampaign/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&activecampaign=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleActiveCampaignOAuthCallback(state, code);
    await notifyIntegrationConnected(state, "activecampaign");
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&activecampaign=connected&syncing=activecampaign", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("ActiveCampaign OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&activecampaign=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
