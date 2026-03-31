import { NextRequest, NextResponse }    from "next/server";
import { handlePayPalCallback }         from "@/lib/integrations/paypal/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&paypal=error", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  try {
    await handlePayPalCallback(state, code);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&paypal=connected&syncing=paypal", process.env.NEXT_PUBLIC_APP_URL)
    );
  } catch (err) {
    console.error("PayPal OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&paypal=error", process.env.NEXT_PUBLIC_APP_URL)
    );
  }
}
