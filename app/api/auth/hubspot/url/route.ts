import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHubSpotAuthUrl } from "@/lib/integrations/hubspot/auth";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  return NextResponse.redirect(getHubSpotAuthUrl(user.id));
}
