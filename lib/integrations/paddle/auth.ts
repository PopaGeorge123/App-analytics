/**
 * Paddle uses API keys, not OAuth.
 * This module validates a Paddle API key by making a test request.
 */
export async function validatePaddleApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.paddle.com/products?per_page=1", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) return { valid: true };

    const body = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key — check your Paddle dashboard" };
    }
    return { valid: false, error: `Paddle API error: ${body?.error?.detail ?? res.status}` };
  } catch (err) {
    return { valid: false, error: `Connection failed: ${(err as Error).message}` };
  }
}
