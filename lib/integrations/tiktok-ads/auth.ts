export function getTikTokAdsAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    app_id: process.env.TIKTOK_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok-ads/callback`,
    state: userId,
  });
  return `https://ads.tiktok.com/marketing_api/auth?${params.toString()}`;
}

export async function validateTikTokAdsCredentials(
  accessToken: string,
  advertiserId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      fields: JSON.stringify(["advertiser_id", "advertiser_name"]),
    });
    const res = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?${params}`,
      { headers: { "Access-Token": accessToken } },
    );
    if (res.status === 401 || res.status === 40001) {
      return { valid: false, error: "Invalid access token." };
    }
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { valid: false, error: e?.message ?? `TikTok Ads returned ${res.status}` };
    }
    const body = await res.json();
    if (body?.code !== 0) {
      return { valid: false, error: body?.message ?? "TikTok Ads validation failed." };
    }
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
