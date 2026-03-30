/**
 * Fire-and-forget POST to the sync server to trigger a per-user backfill.
 * Called after each OAuth platform connect. Never throws — failures are logged only.
 *
 * Pass newAccountId when the user may be connecting a different account so the
 * daemon can clear stale snapshots/digests/share_tokens before backfilling.
 *
 * Required env vars (set in .env and on the upbid.dev server):
 *   SYNC_SECRET        – shared secret, must match server-side SYNC_SECRET
 *   SYNC_TRIGGER_URL   – full URL incl. path, e.g. https://upbid.dev/sync-trigger
 */
export function triggerRemoteBackfill(
  userId: string,
  platform: string,
  newAccountId?: string
): void {
  const secret     = process.env.SYNC_SECRET;
  const triggerUrl = process.env.SYNC_TRIGGER_URL ?? "https://upbid.dev/sync-trigger";

  if (!secret) {
    console.warn("[triggerRemoteBackfill] SYNC_SECRET not set — skipping remote trigger");
    return;
  }

  fetch(triggerUrl, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${secret}`,
    },
    body: JSON.stringify({
      userId,
      platform,
      ...(newAccountId ? { newAccountId } : {}),
    }),
  }).catch((e: Error) =>
    console.error(`[triggerRemoteBackfill] POST to ${triggerUrl} failed: ${e.message}`)
  );
}
