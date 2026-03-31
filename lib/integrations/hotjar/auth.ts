/**
 * Hotjar – validate credentials using the Trends API.
 * Bearer token auth.
 */
export async function validateHotjarCredentials(
  accessToken: string,
  siteId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.hotjar.com/v1/sites/${encodeURIComponent(siteId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Hotjar access token or site ID" };
    }
    if (!res.ok && res.status !== 404) {
      return { valid: false, error: `Hotjar API error: ${res.status}` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Could not connect to Hotjar" };
  }
}
