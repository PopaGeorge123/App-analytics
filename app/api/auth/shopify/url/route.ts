import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShopifyAuthUrl } from "@/lib/integrations/shopify/auth";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  const shop = request.nextUrl.searchParams.get("shop") ?? "";
  if (!shop) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&shopify=missing_shop", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  const url = getShopifyAuthUrl(user.id, shop);
  return NextResponse.redirect(url);
}
