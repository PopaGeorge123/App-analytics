import { NextRequest, NextResponse } from "next/server";
import { handleBigCommerceOAuthCallback } from "@/lib/integrations/bigcommerce/callback";
import { notifyIntegrationConnected } from "@/lib/utils/notifyIntegrationConnected";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const context = searchParams.get("context") ?? ""; // "stores/{hash}"
  const error = searchParams.get("error");
  const storeHash = context.replace("stores/", "");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&bigcommerce=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleBigCommerceOAuthCallback(state, code, storeHash);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&bigcommerce=connected&syncing=bigcommerce", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("BigCommerce OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&bigcommerce=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
