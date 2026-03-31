export async function validateMixpanelCredentials(
  projectToken: string,
  serviceAccountUser: string,
  serviceAccountSecret: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const credentials = Buffer.from(`${serviceAccountUser}:${serviceAccountSecret}`).toString("base64");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split("T")[0];

    const params = new URLSearchParams({
      project_id: projectToken,
      from_date:  date,
      to_date:    date,
      unit:       "day",
    });

    const res = await fetch(`https://data.mixpanel.com/api/2.0/export?${params}`, {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid credentials." };
    }
    // 200 or 400 (no data) both indicate valid credentials
    if (res.status === 200 || res.status === 400) return { valid: true };
    return { valid: false, error: `Mixpanel returned ${res.status}.` };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
