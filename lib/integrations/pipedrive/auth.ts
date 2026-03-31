export function getPipedriveAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.PIPEDRIVE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/pipedrive/callback`,
    state: userId,
  });
  return `https://oauth.pipedrive.com/oauth/authorize?${params.toString()}`;
}

/**
 * Pipedrive API — validate via /users/me
 * apiToken: Personal API token from Pipedrive account settings
 */
export async function validatePipedriveApiToken(
  apiToken: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.pipedrive.com/v1/users/me?api_token=${encodeURIComponent(apiToken)}`,
      { headers: { Accept: "application/json" } },
    );
    if (res.status === 401) return { valid: false, error: "Invalid Pipedrive API token." };
    if (!res.ok) return { valid: false, error: `Pipedrive returned ${res.status}.` };
    const data = await res.json();
    if (!data?.success) return { valid: false, error: "Pipedrive validation failed." };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
