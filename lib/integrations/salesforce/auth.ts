export function getSalesforceAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SALESFORCE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/salesforce/callback`,
    scope: "api refresh_token",
    state: userId,
  });
  return `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`;
}

/**
 * Salesforce REST API — validate via instance URL + OAuth access token.
 * instanceUrl: e.g. "https://yourorg.my.salesforce.com"
 * accessToken: Salesforce OAuth2 access token (from connected app)
 */
export async function validateSalesforceCredentials(
  instanceUrl: string,
  accessToken: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const base = instanceUrl.replace(/\/$/, "");
    const res  = await fetch(`${base}/services/data/v59.0/sobjects/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Salesforce credentials." };
    }
    if (!res.ok) return { valid: false, error: `Salesforce returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
