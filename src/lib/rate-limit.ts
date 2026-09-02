import { db } from "@/lib/db";

export type RateLimitConfig = { limit: number; windowSeconds: number };

export { clientIpFromHeaders } from "@/lib/client-ip";

function currentWindowStart(windowSeconds: number): number {
  return Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
}

// Runs on ~10% of calls rather than needing its own cron — cheap, and keeps the table from
// growing unbounded under sustained abuse (the exact scenario this module exists to blunt).
async function sweepStaleWindows(beforeWindowStart: number): Promise<void> {
  if (Math.random() >= 0.1) return;
  await db.execute({
    sql: "DELETE FROM rate_limits WHERE window_start < ?",
    args: [beforeWindowStart],
  });
}

async function incrementAndGetCount(
  bucketKey: string,
  windowSeconds: number,
): Promise<number> {
  const windowStart = currentWindowStart(windowSeconds);
  await sweepStaleWindows(windowStart - windowSeconds);
  const result = await db.execute({
    sql: `INSERT INTO rate_limits (bucket_key, window_start, count) VALUES (?, ?, 1)
          ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1
          RETURNING count`,
    args: [bucketKey, windowStart],
  });
  return Number(result.rows[0].count);
}

// For public write endpoints with no notion of "success" vs. "failure" (e.g. registration) —
// every call counts toward the cap.
export async function checkRateLimit(
  route: string,
  identifier: string,
  config: RateLimitConfig,
): Promise<boolean> {
  const count = await incrementAndGetCount(`${route}:${identifier}`, config.windowSeconds);
  return count <= config.limit;
}

// Matches busherian-hike's audit-derived values (finding M1: "5 submissions/hour").
export const REGISTRATION_RATE_LIMIT: RateLimitConfig = { limit: 5, windowSeconds: 3600 };
// Same shape as REGISTRATION_RATE_LIMIT — gates completeRegistration, the only place a
// registration row is ever written, so this is the actual public write endpoint.
export const COMPLETE_REGISTRATION_RATE_LIMIT: RateLimitConfig = { limit: 5, windowSeconds: 3600 };
