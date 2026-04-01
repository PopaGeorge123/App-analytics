import { NextRequest, NextResponse } from "next/server";
import { handleWooCommerceOAuthCallback } from "@/lib/integrations/woocommerce/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&woocommerce=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleWooCommerceOAuthCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&woocommerce=connected&syncing=woocommerce", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("WooCommerce OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&woocommerce=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
