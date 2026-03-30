import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Stripe sends raw body — Next.js must NOT parse it
export const runtime = "nodejs";

// Admin Supabase client (bypasses RLS) — only used in this server route
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const admin = getAdminClient();

  switch (event.type) {
    // ── User completes checkout → mark as premium ──────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (userId) {
        // Fetch the subscription to check if a trial was granted
        let hadTrial = false;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          hadTrial = sub.trial_end !== null;
        }

        const { error } = await admin
          .from("users")
          .update({
            is_premium: true,
            stripe_subscription_id: subscriptionId ?? null,
            // Mark trial as used so they can never get another one
            ...(hadTrial ? { trial_used: true } : {}),
          })
          .eq("id", userId);

        if (error) console.error("[webhook] checkout.session.completed update error:", error);
      }
      break;
    }

    // ── Subscription renewed / updated ────────────────────────────────
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;

      if (userId) {
        const isActive = sub.status === "active" || sub.status === "trialing";
        const { error } = await admin
          .from("users")
          .update({ is_premium: isActive })
          .eq("id", userId);

        if (error) console.error("[webhook] subscription.updated error:", error);
      }
      break;
    }

    // ── Subscription cancelled / expired → revoke premium ─────────────
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;

      if (userId) {
        const { error } = await admin
          .from("users")
          .update({
            is_premium: false,
            stripe_subscription_id: null,
          })
          .eq("id", userId);

        if (error) console.error("[webhook] subscription.deleted error:", error);
      }
      break;
    }

    // ── Invoice payment failed → optionally revoke ─────────────────────
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

      if (customerId) {
        const { error } = await admin
          .from("users")
          .update({ is_premium: false })
          .eq("stripe_customer_id", customerId);

        if (error) console.error("[webhook] invoice.payment_failed error:", error);
      }
      break;
    }

    // ── Real-time revenue snapshot ─────────────────────────────────────
    // Upsert today's daily_snapshot whenever a payment succeeds so the
    // dashboard shows live revenue without waiting for the nightly cron.
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.status !== "succeeded") break;

      // Resolve the Stripe Connect account ID (stored in integrations.account_id)
      const connectedAccountId = (event.account as string | undefined) ?? null;
      if (!connectedAccountId) break; // only process Connect charges

      // Find the user who owns this Stripe account
      const { data: integration } = await admin
        .from("integrations")
        .select("user_id")
        .eq("platform", "stripe")
        .eq("account_id", connectedAccountId)
        .maybeSingle();

      if (!integration?.user_id) break;

      const userId = integration.user_id;
      const todayStr = new Date().toISOString().slice(0, 10);

      // Fetch today's existing snapshot so we can increment it
      const { data: existing } = await admin
        .from("daily_snapshots")
        .select("data")
        .eq("user_id", userId)
        .eq("provider", "stripe")
        .eq("date", todayStr)
        .maybeSingle();

      const prev = (existing?.data ?? {}) as Record<string, number>;
      const amount = pi.amount_received ?? pi.amount ?? 0;

      const updated = {
        revenue:      (prev.revenue      ?? 0) + amount,
        txCount:      (prev.txCount      ?? 0) + 1,
        refunds:       prev.refunds      ?? 0,
        newCustomers:  prev.newCustomers ?? 0,
      };

      const { error: upsertErr } = await admin
        .from("daily_snapshots")
        .upsert(
          { user_id: userId, provider: "stripe", date: todayStr, data: updated },
          { onConflict: "user_id,provider,date" }
        );

      if (upsertErr) console.error("[webhook] payment_intent.succeeded upsert error:", upsertErr);
      break;
    }

    default:
      // Unknown event — ignore
      break;
  }

  return NextResponse.json({ received: true });
}
