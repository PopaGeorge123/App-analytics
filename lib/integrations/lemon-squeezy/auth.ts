export async function validateLemonSqueezyApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.lemonsqueezy.com/v1/stores", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.api+json",
      },
    });
    if (res.ok) return { valid: true };
    if (res.status === 401 || res.status === 403)
      return { valid: false, error: "Invalid API key — check your Lemon Squeezy dashboard" };
    const body = await res.json().catch(() => ({}));
    return { valid: false, error: `Lemon Squeezy error: ${body?.errors?.[0]?.detail ?? res.status}` };
  } catch (err) {
    return { valid: false, error: `Connection failed: ${(err as Error).message}` };
  }
}
