/**
 * Heap – validate credentials using the REST API.
 * Docs: https://developers.heap.io/reference/
 *
 * App ID: numeric ID from Heap → Account → Privacy & Security → App ID
 * API Key: from Heap → Account → Privacy & Security → Manage API Keys
 *
 * Auth: Authorization: Basic base64("<appId>:<apiKey>")
 * Validation: GET /api/v0/app/<appId>/events?limit=1 — lists events
 */
export async function validateHeapCredentials(
  appId: string,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  if (!appId?.trim() || !apiKey?.trim()) {
    return { valid: false, error: "App ID and API Key are required" };
  }

  try {
    const token = Buffer.from(`${appId}:${apiKey}`).toString("base64");
    // Use the /api/v0/app endpoint — returns app details, works with Basic auth
    const res = await fetch(
      `https://heapanalytics.com/api/v0/app/${encodeURIComponent(appId)}/events?limit=1`,
      {
        headers: {
          Authorization: `Basic ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (res.status === 401 || res.status === 403) {
      return {
        valid: false,
        error:
          "Invalid Heap App ID or API Key. Find these at Heap → Account → Privacy & Security → API Keys.",
      };
    }
    // 404 means the app ID doesn't exist
    if (res.status === 404) {
      return { valid: false, error: "Heap App ID not found. Check your App ID." };
    }
    // 200 or 400 (no events yet) both indicate valid credentials
    if (res.ok || res.status === 400) {
      return { valid: true };
    }
    return { valid: false, error: `Heap API error: ${res.status}` };
  } catch {
    return { valid: false, error: "Could not connect to Heap" };
  }
}
