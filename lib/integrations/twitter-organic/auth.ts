export function getTwitterOrganicAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.TWITTER_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter-organic/callback`,
    scope: "tweet.read users.read offline.access",
    state: userId,
    code_challenge_method: "S256",
    code_challenge: "PKCE_PLACEHOLDER",
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

/**
 * Validate a Twitter (X) bearer token + user id by calling the Users API v2
 */
export async function validateTwitterCredentials(bearerToken: string, userId: string) {
  if (!bearerToken || !userId) return { valid: false, error: "token and userId required" };
  try {
    const res = await fetch(`https://api.twitter.com/2/users/${encodeURIComponent(userId)}?user.fields=public_metrics`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { valid: false, error: `Twitter API error: ${res.status} ${txt}` };
    }
    const data = await res.json();
    if (!data || !data.data) return { valid: false, error: "User not found or access denied" };
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message ?? "Network error" };
  }
}
