import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Admin API: Get outbound prospecting stats and recent prospects
 * GET /api/admin/prospects?limit=50&category=SaaS&status=opened
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    
    const db = createServiceClient();
    
    // Build query
    let query = db
      .from("outbound_prospects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    
    if (category) {
      query = query.eq("category", category);
    }
    
    if (status) {
      query = query.eq("status", status);
    }
    
    const { data: prospects, error } = await query;
    
    if (error) throw error;
    
    // Get summary stats
    const { data: stats } = await db
      .from("outbound_prospects")
      .select("category, status")
      .then(result => {
        if (!result.data) return { data: null };
        
        const summary = {
          total: result.data.length,
          byCategory: {} as Record<string, number>,
          byStatus: {} as Record<string, number>,
          emailsSent: result.data.filter(p => p.status !== 'scraped').length,
          opened: result.data.filter(p => p.status === 'opened' || p.status === 'clicked' || p.status === 'converted').length,
          clicked: result.data.filter(p => p.status === 'clicked' || p.status === 'converted').length,
          converted: result.data.filter(p => p.status === 'converted').length,
        };
        
        result.data.forEach(p => {
          summary.byCategory[p.category] = (summary.byCategory[p.category] || 0) + 1;
          summary.byStatus[p.status] = (summary.byStatus[p.status] || 0) + 1;
        });
        
        return { data: summary };
      });
    
    // Calculate rates
    const openRate = stats && stats.emailsSent > 0 
      ? ((stats.opened / stats.emailsSent) * 100).toFixed(2) 
      : "0";
    
    const clickRate = stats && stats.emailsSent > 0
      ? ((stats.clicked / stats.emailsSent) * 100).toFixed(2)
      : "0";
    
    return NextResponse.json({
      prospects,
      stats: {
        ...stats,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
      },
    });
  } catch (error) {
    console.error("❌ Admin prospects API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prospects" },
      { status: 500 }
    );
  }
}
