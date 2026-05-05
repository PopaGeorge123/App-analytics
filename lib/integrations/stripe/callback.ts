import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";
import Stripe from "stripe";

export async function handleStripeCallback(
  userId: string,
  code: string
): Promise<void> {
  // Stripe Connect OAuth token exchange
  const tokenRes = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_secret: process.env.STRIPE_SECRET_KEY!,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    throw new Error(err?.error_description ?? "Stripe OAuth token exchange failed");
  }

  const response = await tokenRes.json();
  const accessToken = response.access_token as string;
  const accountId = response.stripe_user_id as string;

  // Fetch the account's default currency from Stripe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = new Stripe(accessToken, { apiVersion: "2026-02-25.clover" as any });
  let stripeCurrency = "USD";
  try {
    const account = await stripe.accounts.retrieve(accountId);
    if (account.default_currency) {
      stripeCurrency = account.default_currency.toUpperCase();
    } else {
      // Fallback: read from the account's balance (always has a currency)
      const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
      const firstEntry = balance.available?.[0] ?? balance.pending?.[0];
      if (firstEntry?.currency) stripeCurrency = firstEntry.currency.toUpperCase();
    }
  } catch (err) {
    console.error("[stripe-callback] Could not detect account currency, defaulting to USD:", err);
  }

  // Fetch current account_id before overwriting so the daemon can detect a change
  const db = createServiceClient();
  const { data: existing } = await db
    .from("integrations")
    .select("account_id")
    .eq("user_id", userId)
    .eq("platform", "stripe")
    .maybeSingle();

  await db.from("integrations").upsert(
    {
      user_id: userId,
      platform: "stripe",
      access_token: accessToken,
      account_id: accountId,
      currency: stripeCurrency,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  // Trigger remote backfill — pass newAccountId so the daemon clears stale data
  // if the account changed. All data population happens on the remote sync server.
  triggerRemoteBackfill(userId, "stripe", existing?.account_id !== accountId ? accountId : undefined);
}
