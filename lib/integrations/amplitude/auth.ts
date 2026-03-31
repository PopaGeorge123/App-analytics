export async function validateAmplitudeCredentials(
  apiKey: string,
  secretKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split("T")[0].replace(/-/g, "");

    const res = await fetch(
      `https://amplitude.com/api/2/events/segmentation?e=%7B%22event_type%22%3A%22_active%22%7D&start=${date}&end=${date}`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key or secret." };
    }
    if (res.status === 200 || res.status === 400) return { valid: true };
    return { valid: false, error: `Amplitude returned ${res.status}.` };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
