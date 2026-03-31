export function getHubSpotAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/hubspot/callback`,
    scope: "crm.objects.deals.read crm.objects.contacts.read",
    state: userId,
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

/**
 * HubSpot Private App API — validate via account info endpoint.
 * accessToken: HubSpot Private App token (starts with pat-)
 */
export async function validateHubSpotAccessToken(
  accessToken: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.hubapi.com/account-info/v3/details", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid HubSpot access token." };
    }
    if (!res.ok) return { valid: false, error: `HubSpot returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
