export async function validateFathomApiKey(
  apiKey: string,
  siteId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.usefathom.com/v1/sites/${encodeURIComponent(siteId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key." };
    }
    if (res.status === 404) {
      return { valid: false, error: "Site not found. Check your Site ID." };
    }
    if (!res.ok) return { valid: false, error: `Fathom returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
