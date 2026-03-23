import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// POST /api/stripe/checkout
// Creates a Stripe Checkout Session for the Premium subscription
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  // Fetch existing Stripe customer ID from our DB (if any)
  const { data: dbUser } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = dbUser?.stripe_customer_id as string | undefined;

  // Create a Stripe customer if one doesn't exist yet
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    // Persist the customer ID immediately
    await supabase
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price: process.env.STRIPE_PREMIUM_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/dashboard?tab=overview&upgraded=true`,
    cancel_url: `${baseUrl}/dashboard?tab=overview`,
    metadata: { supabase_user_id: user.id },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
  });

  return NextResponse.json({ url: session.url });
}
