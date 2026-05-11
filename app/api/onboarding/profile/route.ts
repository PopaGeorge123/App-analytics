import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("users")
    .select("website_url, business_description, business_industry, employee_count, monthly_revenue, referral_source, onboarding_step")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    websiteUrl:           data?.website_url          ?? "",
    businessDescription:  data?.business_description ?? "",
    businessIndustry:     data?.business_industry    ?? "",
    employeeCount:        data?.employee_count        ?? "",
    monthlyRevenue:       data?.monthly_revenue       ?? "",
    referralSource:       data?.referral_source       ?? "",
    onboardingStep:       data?.onboarding_step       ?? 1,
  });
}


export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("websiteUrl"           in body) update.website_url            = body.websiteUrl;
  if ("businessDescription"  in body) update.business_description   = body.businessDescription;
  if ("businessIndustry"     in body) update.business_industry      = body.businessIndustry;
  if ("employeeCount"        in body) update.employee_count         = body.employeeCount;
  if ("monthlyRevenue"       in body) update.monthly_revenue        = body.monthlyRevenue;
  if ("referralSource"       in body) update.referral_source        = body.referralSource;
  if ("onboardingStep"       in body) update.onboarding_step        = body.onboardingStep;

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db.from("users").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
