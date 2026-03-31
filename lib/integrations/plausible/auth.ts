export async function validatePlausibleApiKey(
  apiKey: string,
  siteId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://plausible.io/api/v1/stats/aggregate?site_id=${encodeURIComponent(siteId)}&period=30d&metrics=visitors`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key or site ID." };
    }
    if (res.status === 404) {
      return { valid: false, error: "Site not found. Check your Site ID." };
    }
    if (!res.ok) return { valid: false, error: `Plausible returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
