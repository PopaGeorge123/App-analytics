import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTwitterAdsAuthUrl } from "@/lib/integrations/twitter-ads/auth";
import { generatePKCE } from "@/lib/utils/pkce";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  const { codeChallenge, codeVerifier } = await generatePKCE();
  const response = NextResponse.redirect(
    getTwitterAdsAuthUrl(user.id).replace("PKCE_PLACEHOLDER", codeChallenge),
  );
  response.cookies.set("twitter_ads_cv", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
