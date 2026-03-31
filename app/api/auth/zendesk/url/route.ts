import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getZendeskAuthUrl } from "@/lib/integrations/zendesk/auth";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  const subdomain = request.nextUrl.searchParams.get("subdomain") ?? "";
  if (!subdomain) {
    return NextResponse.redirect(
      new URL("/dashboard?tab=settings&zendesk=missing_subdomain", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  return NextResponse.redirect(getZendeskAuthUrl(user.id, subdomain));
}
