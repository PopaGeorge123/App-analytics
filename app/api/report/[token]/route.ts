import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// GET /api/report/[token]
// Public — no auth required. Validates token, increments view count, returns payload.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const db = createServiceClient();

  const { data: row, error } = await db
    .from("share_tokens")
    .select("id, token, label, date_from, date_to, platforms, payload, expires_at, view_count, created_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "This report link has expired" }, { status: 410 });
  }

  // Increment view count (fire-and-forget)
  db.from("share_tokens")
    .update({ view_count: (row.view_count ?? 0) + 1 })
    .eq("id", row.id)
    .then(() => {});

  return NextResponse.json({
    label:    row.label,
    dateFrom: row.date_from,
    dateTo:   row.date_to,
    platforms: row.platforms,
    payload:  row.payload,
    expiresAt: row.expires_at,
    viewCount: row.view_count,
    createdAt: row.created_at,
  });
}
