import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = 'force-dynamic';

/**
 * Track email link clicks and redirect to actual destination
 * GET /api/track/click/[prospectId]
 * 
 * Updates prospect record and template performance metrics
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  const { prospectId } = await params;
  
  // Get user agent and IP for tracking
  const userAgent = request.headers.get("user-agent") || "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
              request.headers.get("x-real-ip") || 
              "unknown";
  
  try {
    const db = createServiceClient();
    
    // Update prospect with clicked timestamp (only if not already set)
    const { data: prospect } = await db
      .from('outbound_prospects')
      .select('id, email_clicked_at')
      .eq('id', prospectId)
      .single();
    
    if (prospect && !prospect.email_clicked_at) {
      await db
        .from('outbound_prospects')
        .update({ 
          email_clicked_at: new Date().toISOString(),
          status: 'email_clicked'
        })
        .eq('id', prospectId);
      
      console.log(`🖱️  Email link clicked by prospect ${prospectId}`);
    }
    
    // Log the click event for detailed analytics
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
  } catch (err) {
    console.error("❌ Failed to track email click:", err);
  }
  
  // Redirect to signup page (or demo page, depending on your flow)
  const baseUrl = "https://usefold.io";
  return NextResponse.redirect(`${baseUrl}/?ref=outbound`);
}
