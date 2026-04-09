import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

async function createCheckoutSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const { data: dbUser } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = dbUser?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    // Card is always required — collected upfront even during the trial.
    // Stripe will not charge until the trial ends (day 4).
    payment_method_collection: "always",
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
      // No trial period here — the 3-day free trial is handled in-app (DB flag),
      // completely separate from Stripe. Checkout goes straight to paid.
      metadata: { supabase_user_id: user.id },
    },
  });

  return session;
}

// GET /api/stripe/checkout
// Used by plain <a href> links throughout the app — redirects directly to Stripe
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const session = await createCheckoutSession();

  if (!session?.url) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl}/dashboard?tab=settings`);
  }

  return NextResponse.redirect(session.url);
}

// POST /api/stripe/checkout
// Used by fetch() calls that expect a JSON { url } response
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const session = await createCheckoutSession();

  if (!session?.url) {
    return NextResponse.json({ error: "Failed to create session." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
