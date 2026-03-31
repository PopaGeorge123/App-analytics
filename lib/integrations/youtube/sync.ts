import { createServiceClient } from "@/lib/supabase/service";

/**
 * YouTube sync — fetch channel statistics and save a per-day snapshot.
 * We make a simple call to channels.part=statistics which returns cumulative
 * totals (subscriberCount, viewCount). We store those values on the date.
 */
export async function syncYouTubeDay(userId: string, accessToken: string, channelId: string, date: string) {
  const supabase = createServiceClient();

  let subscribers = 0;
  let totalViews = 0;

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(channelId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.ok) {
      const data = await res.json();
      const item = (data?.items ?? [])[0];
      const stats = item?.statistics ?? {};
      subscribers = Number(stats.subscriberCount ?? 0);
      totalViews = Number(stats.viewCount ?? 0);
    }
  } catch (_) { /* ignore errors — we'll store zeros */ }

  const metrics = { subscribers, totalViews };

  await supabase.from("daily_snapshots").upsert(
    { user_id: userId, platform: "youtube", date, metrics },
    { onConflict: "user_id,platform,date" },
  );
}

export async function syncYouTube(userId: string, integration: { access_token: string; account_id: string }) {
  const date = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await syncYouTubeDay(userId, integration.access_token, integration.account_id, date);
  return { date };
}
