/**
 * Brevo (Sendinblue) API v3 — validate via account endpoint.
 * API key stored in access_token.
 */
export async function validateBrevoApiKey(
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": apiKey, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Brevo API key." };
    }
    if (!res.ok) return { valid: false, error: `Brevo returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
