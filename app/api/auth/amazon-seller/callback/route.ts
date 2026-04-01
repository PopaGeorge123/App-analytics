import { NextRequest, NextResponse } from "next/server";
import { handleAmazonSellerOAuthCallback } from "@/lib/integrations/amazon-seller/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Amazon SP-API returns spapi_oauth_code and selling_partner_id
  const code             = searchParams.get("spapi_oauth_code");
  const sellingPartnerId = searchParams.get("selling_partner_id") ?? "";
  const state            = searchParams.get("state");
  const error            = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&amazon-seller=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
  try {
    await handleAmazonSellerOAuthCallback(state, code, sellingPartnerId);
    return NextResponse.redirect(
      new URL(
        "/dashboard?tab=settings&amazon-seller=connected&syncing=amazon-seller",
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
  } catch (err) {
    console.error("Amazon Seller OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&amazon-seller=error", process.env.NEXT_PUBLIC_APP_URL),
    );
  }
}
