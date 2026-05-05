/**
 * Validate a PostHog Personal API key.
 *
 * Key type:  Personal API key — created at PostHog → Settings → Personal API Keys
 *            (starts with `phx_`). NOT the project token (`phc_`) from the JS snippet.
 *
 * Auth:      `Authorization: Bearer <key>` on both US (app.posthog.com) and
 *            EU (eu.posthog.com) clouds.
 *
 * Detection: We use /api/users/@me/ which works for all key scopes and returns
 *            the project list in organization.teams[]. This avoids the
 *            "scoped projects" 403 that /api/projects/ returns on EU cloud.
 *
 * projectId: Optional numeric project ID. When omitted we auto-detect from
 *            the first team returned by /api/users/@me/.
 */

const POSTHOG_HOSTS = [
  "https://app.posthog.com",
  "https://eu.posthog.com",
];

export async function validatePostHogApiKey(
  apiKey: string,
  projectId: string,
): Promise<{ valid: boolean; resolvedProjectId?: string; resolvedHost?: string; error?: string }> {
  // Guard: reject project tokens (phc_) immediately
  if (apiKey.startsWith("phc_")) {
    return {
      valid: false,
      error:
        "That looks like a Project API Token (phc_…), not a Personal API key. " +
        "Go to PostHog → Settings → Personal API keys and create a new key (it starts with phx_).",
    };
  }

  const headers = { Authorization: `Bearer ${apiKey}` };

  // Try US first, then EU — /api/users/@me/ works on both and handles scoped keys
  for (const host of POSTHOG_HOSTS) {
    let res: Response;
    try {
      res = await fetch(`${host}/api/users/@me/`, { headers });
    } catch {
      continue; // network error, try next host
    }

    if (res.status === 401) {
      // Key not recognised on this host — try the other region
      continue;
    }

    if (res.ok) {
      // 200 — key is valid. Extract project ID from organization.teams
      const data = await res.json();
      const teams: { id: number }[] = data?.organization?.teams ?? [];
      const firstTeamId = teams[0]?.id;
      const resolved = projectId || (firstTeamId ? String(firstTeamId) : "");

      if (!resolved) {
        return {
          valid: false,
          error:
            "Your API key is valid but we couldn't auto-detect a Project ID. " +
            "Please enter your Project ID manually — find it in PostHog under Project Settings → Project ID.",
        };
      }

      return { valid: true, resolvedProjectId: resolved, resolvedHost: host };
    }

    // Any other non-401 status (e.g. 403 on a heavily scoped key) — key exists,
    // trust it and store whatever projectId the user gave us
    if (projectId) {
      return { valid: true, resolvedProjectId: projectId, resolvedHost: host };
    }
  }

  // No host accepted the key
  return {
    valid: false,
    error:
      "PostHog rejected the API key. " +
      "Make sure it's a Personal API key (phx_…) from PostHog → Settings → Personal API keys — NOT the project token from the JS snippet.",
  };
}
