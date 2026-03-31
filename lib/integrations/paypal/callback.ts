import { createServiceClient } from "@/lib/supabase/service";
import { triggerRemoteBackfill } from "@/lib/utils/triggerBackfill";

const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;
const REDIRECT_URI         = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/paypal/callback`;

export async function handlePayPalCallback(userId: string, code: string): Promise<void> {
  // Exchange authorization code for tokens
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

  const tokenRes = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(`PayPal token exchange failed: ${err?.error_description ?? err?.error ?? tokenRes.status}`);
  }

  const tokens = await tokenRes.json();
  const accessToken  = tokens.access_token  as string;
  const refreshToken = tokens.refresh_token as string | undefined;

  // Fetch merchant/payer ID from /v1/identity/oauth2/userinfo
  let merchantId = "";
  try {
    const userRes = await fetch("https://api-m.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userRes.ok) {
      const userInfo = await userRes.json();
      merchantId = (userInfo.payer_id as string) ?? "";
    }
  } catch {
    // optional
  }

  // Save to integrations table
  const supabase = createServiceClient();
  const { error } = await supabase.from("integrations").upsert(
    {
      user_id:       userId,
      platform:      "paypal",
      access_token:  accessToken,
      refresh_token: refreshToken ?? null,
      account_id:    merchantId,
      connected_at:  new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (error) throw new Error(`Failed to save PayPal integration: ${error.message}`);

  // Fire backfill
  await triggerRemoteBackfill(userId, "paypal");
}
