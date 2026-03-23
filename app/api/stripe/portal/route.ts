import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// POST /api/stripe/portal
// Creates a Stripe Customer Portal session so the user can manage their subscription
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const customerId = dbUser?.stripe_customer_id as string | undefined;

  if (!customerId) {
    return NextResponse.json(
      { error: "No active subscription found." },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/dashboard?tab=settings`,
  });

  return NextResponse.json({ url: portalSession.url });
}
