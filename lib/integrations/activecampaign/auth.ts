export function getActiveCampaignAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.ACTIVECAMPAIGN_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/activecampaign/callback`,
    response_type: "code",
    state: userId,
  });
  return `https://www.activecampaign.com/oauth/authorize?${params.toString()}`;
}

/**
 * ActiveCampaign API v3 — validate via account info endpoint.
 * Credentials: apiUrl (e.g. https://youraccountname.api-us1.com) + apiKey.
 */
export async function validateActiveCampaignApiKey(
  apiUrl: string,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const base = apiUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/api/3/users/me`, {
      headers: { "Api-Token": apiKey },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key or URL." };
    }
    if (!res.ok) return { valid: false, error: `ActiveCampaign returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
