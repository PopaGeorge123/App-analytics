import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeAuthUrl } from "@/lib/integrations/stripe/auth";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  const url = getStripeAuthUrl(user.id);
  return NextResponse.redirect(url);
}
