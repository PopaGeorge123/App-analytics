export function getMetaAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`,
    scope: "ads_read",
    response_type: "code",
    state: userId,
  });

  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}
