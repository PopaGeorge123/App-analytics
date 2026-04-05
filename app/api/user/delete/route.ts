import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function DELETE() {
  // 1. Auth check — must be signed in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Use service role to bypass RLS and delete all user data
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Delete in dependency order (child tables first)
  const tables = [
    "ai_messages",
    "ai_conversations",
    "website_tasks",
    "website_profiles",
    "daily_snapshots",
    "integrations",
    "alert_rules",
    "user_settings",
    "users",
  ];

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    // Log but don't abort — some tables may not exist or have different FK names
    if (error) console.warn(`[delete-account] ${table}:`, error.message);
  }

  // 3. Delete the auth user itself (removes login credentials)
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error("[delete-account] auth.admin.deleteUser failed:", authError);
    return NextResponse.json(
      { error: "Failed to delete account. Please contact support." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
