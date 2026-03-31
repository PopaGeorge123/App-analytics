import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIntercomAuthUrl } from "@/lib/integrations/intercom/auth";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  return NextResponse.redirect(getIntercomAuthUrl(user.id));
}
