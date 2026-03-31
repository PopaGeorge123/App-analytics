export function getYouTubeAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`,
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Minimal YouTube credential validator.
 * We accept an OAuth access token and a channelId. We verify by calling the
 * YouTube Data API to fetch channel statistics for the provided channel.
 */
export async function validateYouTubeCredentials(accessToken: string, channelId: string) {
  if (!accessToken || !channelId) return { valid: false, error: "accessToken and channelId required" };

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(channelId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { valid: false, error: `YouTube API error: ${res.status} ${body}` };
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.items) || data.items.length === 0) return { valid: false, error: "Channel not found or access not permitted" };
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message ?? "Network error" };
  }
}
