import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { selectGA4Property } from "@/lib/integrations/ga4/callback";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { propertyId } = await request.json();
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }

  try {
    await selectGA4Property(user.id, propertyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Select GA4 property error:", err);
    return NextResponse.json({ error: "Failed to save property" }, { status: 500 });
  }
}
