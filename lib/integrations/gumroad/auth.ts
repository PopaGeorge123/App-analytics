export function getGumroadAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GUMROAD_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gumroad/callback`,
    response_type: "code",
    scope: "view_sales",
    state: userId,
  });
  return `https://gumroad.com/oauth/authorize?${params.toString()}`;
}

export async function validateGumroadApiKey(
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.gumroad.com/v2/user", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key." };
    }
    if (!res.ok) {
      return { valid: false, error: `Gumroad returned ${res.status}.` };
    }
    const body = await res.json();
    if (!body.success) return { valid: false, error: "Gumroad rejected the key." };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
