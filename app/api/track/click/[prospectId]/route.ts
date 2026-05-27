import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Track email link clicks and redirect to actual destination
 * GET /api/track/click/[prospectId]
 */

export async function GET(
  request: Request,
  { params }: { params: { prospectId: string } }
) {
  const prospectId = params.prospectId;
  
  // Get user agent and IP for tracking
  const userAgent = request.headers.get("user-agent") || "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
              request.headers.get("x-real-ip") || 
              "unknown";
  
  try {
    const db = createServiceClient();
    
    // Log the click event
    await db.from("outbound_email_events").insert({
      prospect_id: prospectId,
      event_type: "click",
      user_agent: userAgent,
      ip_address: ip,
      metadata: {
        referer: request.headers.get("referer"),
        timestamp: new Date().toISOString(),
      },
    });
    
    console.log(`🖱️  Email link clicked by prospect ${prospectId}`);
  } catch (err) {
    console.error("❌ Failed to track email click:", err);
  }
  
  // Redirect to signup page (or demo page, depending on your flow)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usefold.io";
  return NextResponse.redirect(`${baseUrl}/signup?ref=outbound`);
}
