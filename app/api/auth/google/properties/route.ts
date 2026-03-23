import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listGA4Properties } from "@/lib/integrations/ga4/callback";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const properties = await listGA4Properties(user.id);
    return NextResponse.json({ properties });
  } catch (err) {
    console.error("List GA4 properties error:", err);
    return NextResponse.json({ error: "Failed to list properties" }, { status: 500 });
  }
}
