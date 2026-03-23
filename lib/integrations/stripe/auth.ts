export function getStripeAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.STRIPE_CLIENT_ID!,
    scope: "read_write",
    state: userId,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/stripe/callback`,
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}
