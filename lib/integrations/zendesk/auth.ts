export function getZendeskAuthUrl(userId: string, subdomain: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZENDESK_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zendesk/callback`,
    scope: "read",
    state: `${userId}:${subdomain}`,
  });
  return `https://${subdomain}.zendesk.com/oauth/authorizations/new?${params.toString()}`;
}

/**
 * Zendesk API — validate via /api/v2/users/me.json
 * subdomain: e.g. "mycompany" from mycompany.zendesk.com
 * email: agent email address
 * apiToken: Zendesk API token
 */
export async function validateZendeskCredentials(
  subdomain: string,
  email: string,
  apiToken: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const credentials = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
    const res = await fetch(
      `https://${subdomain}.zendesk.com/api/v2/users/me.json`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
        },
      },
    );
    if (res.status === 401) return { valid: false, error: "Invalid Zendesk credentials." };
    if (!res.ok) return { valid: false, error: `Zendesk returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
