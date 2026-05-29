import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// The Upstash integration exposes credentials as KV_REST_API_URL/TOKEN.
// Fall back to the classic UPSTASH_* names so either configuration works.
const redisRestUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisRestToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const redis = new Redis({
  url: redisRestUrl as string,
  token: redisRestToken as string,
});

// The locker can use a dedicated instance if configured, otherwise it reuses
// the primary Redis connection.
export const lockerRedisClient = new Redis({
  url: (process.env.UPSTASH_REDIS_REST_LOCKER_URL || redisRestUrl) as string,
  token: (process.env.UPSTASH_REDIS_REST_LOCKER_TOKEN ||
    redisRestToken) as string,
});

// Create a new ratelimiter, that allows 10 requests per 10 seconds by default
export const ratelimit = (
  requests: number = 10,
  seconds:
    | `${number} ms`
    | `${number} s`
    | `${number} m`
    | `${number} h`
    | `${number} d` = "10 s",
) => {
  return new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(requests, seconds),
    analytics: true,
    prefix: "papermark",
  });
};
