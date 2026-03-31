/**
 * ConvertKit (Kit) API v4 — validate via account info.
 * API key stored in access_token.
 */
export async function validateConvertKitApiKey(
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.convertkit.com/v3/account?api_secret=${encodeURIComponent(apiKey)}`,
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key." };
    }
    if (!res.ok) return { valid: false, error: `ConvertKit returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
