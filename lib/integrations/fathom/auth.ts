/**
 * Fathom OAuth2
 * Docs: https://usefathom.com/docs/api/authenticate
 * App registration: https://app.usefathom.com/account/settings/apps/new
 */
export function getFathomAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FATHOM_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/fathom/callback`,
    response_type: "code",
    scope: "site:read,account:read",
    state: userId,
  });
  return `https://app.usefathom.com/oauth/authorize?${params.toString()}`;
}

export async function validateFathomApiKey(
  apiKey: string,
  siteId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.usefathom.com/v1/sites/${encodeURIComponent(siteId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key." };
    }
    if (res.status === 404) {
      return { valid: false, error: "Site not found. Check your Site ID." };
    }
    if (!res.ok) return { valid: false, error: `Fathom returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
