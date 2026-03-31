export function getFreshdeskAuthUrl(userId: string, subdomain: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FRESHDESK_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/freshdesk/callback`,
    response_type: "code",
    state: `${userId}:${subdomain}`,
  });
  return `https://${subdomain}.freshdesk.com/auth/oauth/authorize?${params.toString()}`;
}

/**
 * Freshdesk API — validate via /api/v2/agents/me
 * subdomain: e.g. "mycompany" from mycompany.freshdesk.com
 * apiKey: Freshdesk API key
 */
export async function validateFreshdeskCredentials(
  subdomain: string,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const credentials = Buffer.from(`${apiKey}:X`).toString("base64");
    const res = await fetch(
      `https://${subdomain}.freshdesk.com/api/v2/agents/me`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
        },
      },
    );
    if (res.status === 401) return { valid: false, error: "Invalid Freshdesk credentials." };
    if (!res.ok) return { valid: false, error: `Freshdesk returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
