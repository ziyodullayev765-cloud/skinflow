import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { queryOne } from "../db/pool.js";
import { ApiError } from "./errors.js";

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across
 * serverless instances. One atomic upsert per check.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; count: number; retryAfter: number }> {
  const row = await queryOne<{ count: number; window_start: Date }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END
     RETURNING count, window_start`,
    [key, windowSeconds],
  );
  const count = row?.count ?? 1;
  const started = row ? new Date(row.window_start).getTime() : Date.now();
  const retryAfter = Math.max(1, Math.ceil((started + windowSeconds * 1000 - Date.now()) / 1000));
  return { allowed: count <= limit, count, retryAfter };
}

export async function resetRateLimit(key: string): Promise<void> {
  await queryOne(`DELETE FROM rate_limits WHERE key = $1`, [key]);
}

export function clientIp(req: Request): string {
  return (req.ip || req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");
}

type KeyFn = (req: Request) => string;

export function rateLimit(name: string, limit: number, windowSeconds: number, keyFn: KeyFn = clientIp) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!config.rateLimitsEnabled) return next();
    const { allowed, retryAfter } = await hitRateLimit(`${name}:${keyFn(req)}`, limit, windowSeconds);
    if (!allowed) {
      res.setHeader("Retry-After", String(retryAfter));
      throw new ApiError("RATE_LIMITED", "Too many requests. Please slow down.", undefined, retryAfter);
    }
    next();
  };
}

/** Occasionally purge stale rows. */
export async function purgeRateLimits(): Promise<void> {
  await queryOne(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
}
