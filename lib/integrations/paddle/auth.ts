/**
 * Validates a Paddle Billing API key by calling the /event-types endpoint.
 * This endpoint always returns data without requiring any special permissions,
 * making it the ideal auth test per Paddle docs.
 * Docs: https://developer.paddle.com/api-reference/about/authentication
 */
export async function validatePaddleApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.paddle.com/event-types", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) return { valid: true };

    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      return { valid: false, error: "Invalid API key — check your Paddle dashboard under Developer Tools > Authentication" };
    }
    if (res.status === 403) {
      return { valid: false, error: "API key lacks required permissions — ensure it has read access" };
    }
    return { valid: false, error: `Paddle API error: ${body?.error?.detail ?? res.status}` };
  } catch (err) {
    return { valid: false, error: `Connection failed: ${(err as Error).message}` };
  }
}
