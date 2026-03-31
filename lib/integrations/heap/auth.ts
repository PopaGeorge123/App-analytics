/**
 * Heap – validate credentials using the REST API.
 * Heap uses Basic auth: Base64(app_id:api_key)
 */
export async function validateHeapCredentials(
  appId: string,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const token = Buffer.from(`${appId}:${apiKey}`).toString("base64");
    const res = await fetch(`https://heapanalytics.com/api/v0/reports`, {
      headers: { Authorization: `Basic ${token}`, Accept: "application/json" },
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Heap App ID or API Key" };
    }
    if (!res.ok && res.status !== 404) {
      return { valid: false, error: `Heap API error: ${res.status}` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Could not connect to Heap" };
  }
}
