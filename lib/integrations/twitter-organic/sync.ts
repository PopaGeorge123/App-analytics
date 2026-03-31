import { createServiceClient } from "@/lib/supabase/service";

/**
 * Simple Twitter organic sync — fetch user public_metrics and store followers & tweet count
 */
export async function syncTwitterOrganicDay(userId: string, bearerToken: string, accountId: string, date: string) {
  const supabase = createServiceClient();

  let followers = 0;
  let tweetCount = 0;

  try {
    const res = await fetch(`https://api.twitter.com/2/users/${encodeURIComponent(accountId)}?user.fields=public_metrics`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      const m = data?.data?.public_metrics ?? {};
      followers = Number(m.followers_count ?? 0);
      tweetCount = Number(m.tweet_count ?? 0);
    }
  } catch (_) { /* ignore */ }

  const metrics = { followers, tweetCount };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "twitter-organic", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}

export async function syncTwitterOrganic(userId: string, integration: { access_token: string; account_id: string }) {
  const date = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await syncTwitterOrganicDay(userId, integration.access_token, integration.account_id, date);
  return { date };
}
