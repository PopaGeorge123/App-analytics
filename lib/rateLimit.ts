/**
 * Lightweight in-memory rate limiter.
 * Uses a sliding window per key. Works per-process (single server instance).
 * For multi-instance deployments swap the map for a Redis/Upstash store.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets — present only when ok is false */
  retryAfter?: number;
}

/**
 * @param key      Unique identifier for the caller (e.g. user UUID)
 * @param limit    Max requests allowed per window
 * @param windowMs Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    // Start a fresh window
    bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { ok: true };
  }

  if (bucket.count < limit) {
    bucket.count += 1;
    return { ok: true };
  }

  // Over limit
  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  return { ok: false, retryAfter };
}
