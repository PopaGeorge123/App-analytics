/**
 * FullStory – validate credentials using the v2 API.
 * Docs: https://developer.fullstory.com/server/v2/getting-started/authentication/
 * API key: FullStory App → Settings → Integrations → API Keys (Server API Key)
 * Org ID:  visible in the FullStory URL: app.fullstory.com/ui/o/<orgId>/...
 *
 * Auth: Authorization: Basic base64("<apiKey>:") — note the trailing colon
 * We call GET /v2/users?limit=1 to verify the key is valid.
 */
export async function validateFullStoryCredentials(
  apiKey: string,
  orgId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const token = Buffer.from(`${apiKey}:`).toString("base64");
    // /v2/users is simpler and doesn't require any query params
    const res = await fetch("https://api.fullstory.com/v2/users?limit=1", {
      headers: {
        Authorization: `Basic ${token}`,
        Accept: "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid FullStory API Key. Find it at FullStory → Settings → Integrations → API Keys." };
    }
    if (!res.ok && res.status !== 404) {
      return { valid: false, error: `FullStory API error: ${res.status}` };
    }
    // orgId is stored but not used during validation — the key is already org-scoped
    void orgId;
    return { valid: true };
  } catch {
    return { valid: false, error: "Could not connect to FullStory" };
  }
}
