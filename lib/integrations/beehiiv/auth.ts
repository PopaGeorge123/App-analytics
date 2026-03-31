/**
 * Beehiiv API v2 — validate via publications list.
 * API key stored in access_token. Publication ID stored in account_id.
 */
export async function validateBeehiivApiKey(
  apiKey: string,
  publicationId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${encodeURIComponent(publicationId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Beehiiv API key." };
    }
    if (res.status === 404) {
      return { valid: false, error: "Publication ID not found." };
    }
    if (!res.ok) return { valid: false, error: `Beehiiv returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
