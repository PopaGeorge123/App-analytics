export function getIntercomAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.INTERCOM_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/intercom/callback`,
    state: userId,
  });
  return `https://app.intercom.com/oauth?${params.toString()}`;
}

/**
 * Intercom API — validate via GET /me
 * accessToken: Intercom Access Token (from app settings)
 */
export async function validateIntercomAccessToken(
  accessToken: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.intercom.io/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Intercom access token." };
    }
    if (!res.ok) return { valid: false, error: `Intercom returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
