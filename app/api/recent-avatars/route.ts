import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const revalidate = 300; // cache 5 min

/**
 * GET /api/recent-avatars
 * Returns the 5 most-recently-joined users that have a Google avatar_url.
 * Used in the signup page social-proof strip.
 */
export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("users")
    .select("avatar_url, full_name")
    .not("avatar_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ avatars: [] }, { status: 500 });
  }

  const avatars = (data ?? []).map((u) => ({
    url: u.avatar_url as string,
    initials: (u.full_name as string | null)
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?",
  }));

  return NextResponse.json({ avatars });
}
