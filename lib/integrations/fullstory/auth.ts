/**
 * FullStory – validate credentials using the v2 API.
 * API key is passed as Authorization: Basic base64(apiKey:)
 */
export async function validateFullStoryCredentials(
  apiKey: string,
  orgId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const token = Buffer.from(`${apiKey}:`).toString("base64");
    const res = await fetch(
      `https://api.fullstory.com/v2/segments?org_id=${encodeURIComponent(orgId)}&type=EVERYONE`,
      {
        headers: {
          Authorization: `Basic ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid FullStory API Key or Org ID" };
    }
    if (!res.ok && res.status !== 404) {
      return { valid: false, error: `FullStory API error: ${res.status}` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Could not connect to FullStory" };
  }
}
