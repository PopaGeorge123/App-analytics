import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// GET /api/user/settings — returns alert_rules and goals for the current user
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("users")
    .select("alert_rules, goals, digest_subscribed, digest_day, newsletter_emails")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    alertRules:        data?.alert_rules        ?? null,
    goals:             data?.goals              ?? null,
    digestSubscribed:  data?.digest_subscribed  ?? false,
    digestDay:         data?.digest_day         ?? 1, // Monday default
    newsletterEmails:  data?.newsletter_emails  ?? true,
  });
}

// PATCH /api/user/settings — updates alert_rules and/or goals
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("alertRules" in body) update.alert_rules = body.alertRules;
  if ("goals" in body) update.goals = body.goals;
  if ("digestSubscribed" in body) update.digest_subscribed = body.digestSubscribed;
  if ("digestDay" in body) update.digest_day = body.digestDay;
  if ("newsletterEmails" in body) update.newsletter_emails = body.newsletterEmails;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db
    .from("users")
    .update(update)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
