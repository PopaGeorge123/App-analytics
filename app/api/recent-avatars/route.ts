import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const revalidate = 300; // cache 5 min

/**
 * GET /api/recent-avatars
 * Returns up to 5 recently-joined users that have NO profile photo.
 * Only their initials (derived from the first letter of each name part) are
 * exposed — no avatar URL, no full name, no email. This keeps the social-proof
 * strip anonymous and avoids displaying personal data without explicit consent.
 */
export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("users")
    .select("full_name")
    .is("avatar_url", null)          // only users without a profile photo
    .not("full_name", "is", null)    // must have at least a name to derive initials
    .order("created_at", { ascending: false })
    .limit(8); // fetch a few extra so we can pick 5 with valid initials

  if (error) {
    return NextResponse.json({ avatars: [] }, { status: 500 });
  }

  const avatars = (data ?? [])
    .map((u) => {
      const parts = (u.full_name as string).trim().split(/\s+/);
      const initials = parts
        .map((n: string) => n[0]?.toUpperCase() ?? "")
        .filter(Boolean)
        .slice(0, 2)
        .join("");
      return initials.length >= 1 ? { url: "", initials } : null;
    })
    .filter(Boolean)
    .slice(0, 5);

  return NextResponse.json({ avatars });
}
