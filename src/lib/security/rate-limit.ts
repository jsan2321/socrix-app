import { RateLimitError } from "@/lib/errors";

export interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowMs: number; // Duration of sliding window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in ms when window resets/opens
  retryAfterSeconds: number;
}

// In-memory sliding log store: key -> array of request timestamps (epoch ms)
const rateLimitStore = new Map<string, number[]>();

/**
 * Extract client IP address from proxy headers or fallback
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Check rate limit for a request without throwing
 */
export function checkRateLimit(
  req: Request,
  options: RateLimitOptions,
  now = Date.now()
): RateLimitResult {
  const ip = getClientIp(req);
  const key = `${options.keyPrefix}:${ip}`;
  const windowStart = now - options.windowMs;

  const timestamps = (rateLimitStore.get(key) || []).filter((t) => t > windowStart);

  if (timestamps.length >= options.limit) {
    const oldestTimestamp = timestamps[0];
    const resetTime = oldestTimestamp + options.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));

    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetTime,
      retryAfterSeconds,
    };
  }

  timestamps.push(now);
  rateLimitStore.set(key, timestamps);

  const resetTime = now + options.windowMs;
  return {
    allowed: true,
    limit: options.limit,
    remaining: options.limit - timestamps.length,
    resetTime,
    retryAfterSeconds: 0,
  };
}

/**
 * Enforce rate limit, throwing RateLimitError (429) if exceeded
 */
export function enforceRateLimit(
  req: Request,
  options: RateLimitOptions,
  now = Date.now()
): RateLimitResult {
  const result = checkRateLimit(req, options, now);
  if (!result.allowed) {
    throw new RateLimitError("Rate limit exceeded. Too many requests.", {
      retryAfter: result.retryAfterSeconds,
      limit: result.limit,
      remaining: 0,
    });
  }
  return result;
}

/**
 * Construct standard rate limit headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  return headers;
}

/**
 * Enforce distributed rate limit via Supabase Postgres RPC in production,
 * falling back to the in-memory sliding log store in tests or when RPC is unavailable.
 */
export async function enforceDistributedRateLimit(
  req: Request,
  options: RateLimitOptions,
  identifier?: string
): Promise<RateLimitResult> {
  const clientKey = identifier || getClientIp(req);
  const fullKey = `${options.keyPrefix}:${clientKey}`;

  if (process.env.NODE_ENV === "production") {
    try {
      const { getSupabaseAdminClient } = await import("@/lib/db/client");
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.rpc("check_rate_limit", {
        p_key: fullKey,
        p_limit: options.limit,
        p_window_ms: options.windowMs,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0] as {
          allowed: boolean;
          current_count: number;
          oldest_epoch_ms: number;
        };
        const now = Date.now();
        const resetTime = Number(row.oldest_epoch_ms || now) + options.windowMs;
        const retryAfterSeconds = row.allowed
          ? 0
          : Math.max(1, Math.ceil((resetTime - now) / 1000));
        const remaining = row.allowed
          ? Math.max(0, options.limit - Number(row.current_count))
          : 0;

        const result: RateLimitResult = {
          allowed: row.allowed,
          limit: options.limit,
          remaining,
          resetTime,
          retryAfterSeconds,
        };

        if (!result.allowed) {
          throw new RateLimitError("Rate limit exceeded. Too many requests.", {
            retryAfter: result.retryAfterSeconds,
            limit: result.limit,
            remaining: 0,
          });
        }
        return result;
      }
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      // Fallback to in-memory limiter if RPC is not yet migrated
    }
  }

  return enforceRateLimit(req, options);
}

/**
 * Clear in-memory rate limit store (useful for tests)
 */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}
