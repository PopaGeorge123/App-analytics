import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateDigest } from "@/lib/ai/generate-digest";
import { sendDigestEmail } from "@/lib/email/send-digest";

function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  // Only generate digests for premium users who have at least one integration
  const { data: integrations } = await db
    .from("integrations")
    .select("user_id");

  const userIds = [...new Set((integrations ?? []).map((i) => i.user_id))];

  // Fetch premium users from this set
  const { data: users } = await db
    .from("users")
    .select("id, email")
    .eq("is_premium", true)
    .in("id", userIds.length > 0 ? userIds : ["__none__"]);

  const results: Record<string, string> = {};

  await Promise.allSettled(
    (users ?? []).map(async (user) => {
      try {
        const digest = await generateDigest(user.id);
        await sendDigestEmail(user.email, digest);
        results[user.id] = "ok";
      } catch (err) {
        console.error(`[cron/digest] Error for user ${user.id}:`, err);
        results[user.id] = err instanceof Error ? err.message : "unknown error";
      }
    })
  );

  console.log("[cron/digest] Completed:", JSON.stringify(results));
  return NextResponse.json({ ok: true, results });
}
