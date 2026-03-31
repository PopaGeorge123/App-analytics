export function getMailchimpAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MAILCHIMP_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/mailchimp/callback`,
    state: userId,
  });
  return `https://login.mailchimp.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Mailchimp API — validate via account info endpoint.
 * apiKey format: {key}-{dc}  (e.g. abc123-us1)
 * The dc (datacenter) determines the API endpoint.
 */
export async function validateMailchimpApiKey(
  apiKey: string,
): Promise<{ valid: boolean; dc?: string; error?: string }> {
  try {
    const dc = apiKey.split("-").pop();
    if (!dc) return { valid: false, error: "Invalid API key format (expected key-dc)." };

    const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
      },
    });
    if (res.status === 401) return { valid: false, error: "Invalid API key." };
    if (!res.ok) return { valid: false, error: `Mailchimp returned ${res.status}.` };
    return { valid: true, dc };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
