import Stripe from "stripe";

// Server-only Stripe client — never import this in client components
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});
