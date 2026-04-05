import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// Admin client — bypasses RLS so we can delete user data + auth record
function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function DELETE() {
  // 1. Verify the caller is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const admin = getAdminClient();

  // 2. Delete all user data in order (FK children first, then parent)
  //    Each delete is best-effort — we log failures but continue so the
  //    auth record is always removed even if some tables are already empty.
  const tables = [
    "ai_messages",
    "ai_conversations",
    "alert_rules",
    "notifications",
    "goals",
    "daily_snapshots",
    "website_tasks",
    "website_profiles",
    "integrations",
    "customers",
    "users",
  ];

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) {
      console.error(`[delete-account] Failed to delete from ${table}:`, error.message);
    }
  }

  // 3. Delete the Supabase Auth user (the account itself)
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("[delete-account] Failed to delete auth user:", authError.message);
    return NextResponse.json(
      { error: "Could not delete account. Please contact support." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
