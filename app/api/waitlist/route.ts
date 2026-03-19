import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/email";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter: max 5 requests per IP per 60 seconds
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function getRateLimitKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;

  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/waitlist
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Rate limit
  const ipKey = getRateLimitKey(req);
  if (!checkRateLimit(ipKey)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // Parse body
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();

  // Validate
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 422 });
  }

  // Check for existing entry
  const { data: existing } = await supabase
    .from("waitlist_entries")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "This email is already on the waitlist." },
      { status: 409 }
    );
  }

  // Create entry
  const confirmationToken = crypto.randomUUID();
  const { error: insertError } = await supabase.from("waitlist_entries").insert({
    email,
    status: "pending",
    confirmation_token: confirmationToken,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    // Unique constraint violation — race condition duplicate
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "This email is already on the waitlist." },
        { status: 409 }
      );
    }
    console.error("[waitlist] Insert error:", insertError);
    return NextResponse.json({ error: "Failed to save. Please try again." }, { status: 500 });
  }

  // Send confirmation email
  try {
    await sendConfirmationEmail(email, confirmationToken);
    await sendConfirmationEmail("popageo02@gmail.com", confirmationToken);
  } catch (err) {
    console.error("[waitlist] Failed to send confirmation email:", err);
    // Still return success — entry is saved, email failure is non-fatal
  }

  return NextResponse.json(
    { message: "Check your inbox to confirm your waitlist spot!" },
    { status: 201 }
  );
}
