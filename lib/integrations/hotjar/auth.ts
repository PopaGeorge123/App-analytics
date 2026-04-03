/**
 * Hotjar – validate credentials using the Trends REST API.
 * Docs: https://developer.hotjar.com/api/trends/
 *
 * Access Token: generate at https://insights.hotjar.com/api/v2/data/users/me
 *   or Hotjar App → Account → API & Integrations → Personal API Token
 * Site ID: the numeric ID in the Hotjar tracking URL, e.g. hjid=1234567
 *
 * Auth: Authorization: Bearer <access_token>
 * Validation: GET /v1/sites — lists all sites for the token, no path param needed.
 */
export async function validateHotjarCredentials(
  accessToken: string,
  siteId: string,
): Promise<{ valid: boolean; error?: string }> {
  if (!accessToken?.trim()) {
    return { valid: false, error: "Access Token is required" };
  }
  if (!siteId?.trim() || !/^\d+$/.test(siteId.trim())) {
    return { valid: false, error: "Site ID must be a numeric value (e.g. 1234567)" };
  }

  try {
    // GET /v1/sites lists all accessible sites — simplest auth check that doesn't require siteId in URL
    const res = await fetch("https://api.hotjar.com/v1/sites", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (res.status === 401) {
      return {
        valid: false,
        error:
          "Invalid Hotjar Access Token. Generate one at Hotjar → Account → API & Integrations → Personal API Token.",
      };
    }
    if (res.status === 403) {
      return { valid: false, error: "Hotjar token does not have permission to access sites" };
    }
    if (!res.ok && res.status !== 404) {
      return { valid: false, error: `Hotjar API error: ${res.status}` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Could not connect to Hotjar" };
  }
}
