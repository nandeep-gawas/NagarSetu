import { NextRequest, NextResponse } from "next/server";

interface RateLimitRecord {
  timestamps: number[];
}

const cache = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of cache.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 10 * 60 * 1000);
      if (record.timestamps.length === 0) {
        cache.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * In-memory sliding window rate limiter
 * @param req NextRequest
 * @param keyPrefix e.g. "login", "report", "assistant"
 * @param limit maximum requests allowed in window
 * @param windowMs time window in milliseconds (default 60 seconds)
 */
export function checkRateLimit(
  req: NextRequest,
  keyPrefix: string,
  limit: number = 30,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetMs: number } {
  // Extract client IP or fallback identifier
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
  const key = `${keyPrefix}:${ip}`;

  const now = Date.now();
  const record = cache.get(key) || { timestamps: [] };

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  cache.set(key, record);

  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  };
}

export function rateLimitResponse(resetMs: number) {
  const retryAfterSec = Math.ceil(resetMs / 1000);
  return NextResponse.json(
    {
      ok: false,
      error: `Too many requests. Please wait ${retryAfterSec} second(s) before trying again.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
