import { NextRequest, NextResponse } from "next/server";
import { handleMailchimpOAuthCallback } from "@/lib/integrations/mailchimp/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&mailchimp=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleMailchimpOAuthCallback(state, code);
    await notifyIntegrationConnected(state, "mailchimp");
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&mailchimp=connected&syncing=mailchimp", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Mailchimp OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&mailchimp=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
