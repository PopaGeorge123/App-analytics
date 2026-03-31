export async function validatePostHogApiKey(
  apiKey: string,
  projectId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://app.posthog.com/api/projects/${encodeURIComponent(projectId)}/`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key." };
    }
    if (res.status === 404) {
      return { valid: false, error: "Project not found. Check your Project ID." };
    }
    if (!res.ok) return { valid: false, error: `PostHog returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
