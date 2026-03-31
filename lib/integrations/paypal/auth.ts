const PAYPAL_CLIENT_ID  = process.env.PAYPAL_CLIENT_ID!;
const REDIRECT_URI      = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/paypal/callback`;

export function getPayPalAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     PAYPAL_CLIENT_ID,
    scope:         "openid https://uri.paypal.com/services/reporting/search/read",
    redirect_uri:  REDIRECT_URI,
    state:         userId,
  });
  return `https://www.paypal.com/signin/authorize?${params}`;
}
