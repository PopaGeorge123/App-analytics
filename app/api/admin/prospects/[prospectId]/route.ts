import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Admin API: Update prospect status
 * PATCH /api/admin/prospects/[prospectId]
 * Body: { status: "converted", notes: "Signed up via outbound email" }
 */

export async function PATCH(
  request: Request,
  { params }: { params: { prospectId: string } }
) {
  try {
    const prospectId = params.prospectId;
    const body = await request.json();
    
    const db = createServiceClient();
    
    const { data, error } = await db
      .from("outbound_prospects")
      .update({
        status: body.status,
        notes: body.notes || null,
      })
      .eq("id", prospectId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`✅ Updated prospect ${prospectId} to status: ${body.status}`);
    
    return NextResponse.json({ success: true, prospect: data });
  } catch (error) {
    console.error("❌ Failed to update prospect:", error);
    return NextResponse.json(
      { error: "Failed to update prospect" },
      { status: 500 }
    );
  }
}
