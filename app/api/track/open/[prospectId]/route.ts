import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Track email opens via 1x1 tracking pixel
 * GET /api/track/open/[prospectId]
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
    
    // Log the open event
    await db.from("outbound_email_events").insert({
      prospect_id: prospectId,
      event_type: "open",
      user_agent: userAgent,
      ip_address: ip,
      metadata: {
        referer: request.headers.get("referer"),
        timestamp: new Date().toISOString(),
      },
    });
    
    console.log(`📧 Email opened by prospect ${prospectId}`);
  } catch (err) {
    console.error("❌ Failed to track email open:", err);
  }
  
  // Return a 1x1 transparent GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  
  return new NextResponse(pixel, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
