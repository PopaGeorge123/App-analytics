import { NextRequest, NextResponse } from "next/server";
import { handleShopifyOAuthCallback } from "@/lib/integrations/shopify/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const shop = searchParams.get("shop") ?? "";
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&shopify=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  try {
    await handleShopifyOAuthCallback(state, shop, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&shopify=connected&syncing=shopify", process.env.NEXT_PUBLIC_APP_URL),
    );
  } catch (err) {
    console.error("Shopify OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&shopify=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
