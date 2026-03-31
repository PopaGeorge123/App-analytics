export function getNotionAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID!,
    response_type: "code",
    owner: "user",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/notion/callback`,
    state: userId,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

/**
 * Notion API — validate via /users/me (requires integration token)
 * apiToken: Internal Integration Token from Notion developers page
 */
export async function validateNotionApiToken(
  apiToken: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    });
    if (res.status === 401) return { valid: false, error: "Invalid Notion integration token." };
    if (!res.ok) return { valid: false, error: `Notion returned ${res.status}.` };
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
