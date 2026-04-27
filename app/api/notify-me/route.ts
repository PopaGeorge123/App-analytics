import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  try {
    const { integration_id } = await req.json();
    if (!integration_id || typeof integration_id !== "string") {
      return NextResponse.json({ error: "Missing integration_id" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from("integration_waitlist")
      .upsert(
        { email: user.email, integration_id, user_id: user.id },
        { onConflict: "email,integration_id" }
      );

    if (error) {
      console.error("[notify-me] DB error:", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notify-me]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
