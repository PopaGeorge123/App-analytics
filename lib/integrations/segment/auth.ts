export function getSegmentAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SEGMENT_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/segment/callback`,
    response_type: "code",
    state: userId,
  });
  return `https://app.segment.com/oauth/authorize?${params.toString()}`;
}

/**
 * Segment Config API — validate via GET /v1beta/workspaces
 * accessToken: Segment Public API token
 */
export async function validateSegmentAccessToken(
  accessToken: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.segmentapis.com/workspaces", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid Segment access token." };
    }
    if (!res.ok) return { valid: false, error: `Segment returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
