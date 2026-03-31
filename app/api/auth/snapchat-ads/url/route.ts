import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSnapchatAdsAuthUrl } from "@/lib/integrations/snapchat-ads/auth";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  return NextResponse.redirect(getSnapchatAdsAuthUrl(user.id));
}
