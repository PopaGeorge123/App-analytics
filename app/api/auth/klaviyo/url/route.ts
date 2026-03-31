import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getKlaviyoAuthUrl } from "@/lib/integrations/klaviyo/auth";
import { generatePKCE } from "@/lib/utils/pkce";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  const { codeChallenge, codeVerifier } = await generatePKCE();
  // Store verifier in cookie for use in callback
  const response = NextResponse.redirect(
    getKlaviyoAuthUrl(user.id).replace("PKCE_PLACEHOLDER", codeChallenge),
  );
  response.cookies.set("klaviyo_cv", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
