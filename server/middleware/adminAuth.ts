import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { query, queryOne } from "../db/pool.js";
import { ApiError } from "../lib/errors.js";
import { clientIp } from "../lib/rateLimit.js";

export const ADMIN_COOKIE = "sf_admin";

export const adminCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.isProd,
  // Telegram Web embeds Mini Apps in an iframe, which needs SameSite=None (Secure).
  // Mutations stay protected by the per-session CSRF header.
  sameSite: config.isProd ? "none" : "strict",
  path: "/api/admin",
  maxAge: config.adminSessionTtlSeconds * 1000,
});

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createAdminSession(adminId: number, req: Request): Promise<{ token: string; csrf: string }> {
  const token = randomBytes(32).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  await query(
    `INSERT INTO admin_sessions (id, admin_id, csrf_token, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))`,
    [sha256(token), adminId, csrf, String(req.headers["user-agent"] || "").slice(0, 300), clientIp(req), config.adminSessionTtlSeconds],
  );
  await query(`DELETE FROM admin_sessions WHERE expires_at < now()`);
  return { token, csrf };
}

export async function destroyAdminSession(sessionId: string): Promise<void> {
  await query(`DELETE FROM admin_sessions WHERE id = $1`, [sessionId]);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Validates the session cookie and, for state-changing requests, the CSRF header. */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token || typeof token !== "string") throw new ApiError("UNAUTHORIZED", "Admin sign in required");
  const sessionId = sha256(token);
  const row = await queryOne<{ admin_id: number; csrf_token: string; username: string; role: "owner" | "admin" | "viewer"; active: boolean }>(
    `SELECT s.admin_id, s.csrf_token, a.username, a.role, a.active
       FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [sessionId],
  );
  if (!row || !row.active) throw new ApiError("UNAUTHORIZED", "Admin session expired");

  if (!SAFE_METHODS.has(req.method)) {
    const header = String(req.headers["x-csrf-token"] || "");
    const a = Buffer.from(header);
    const b = Buffer.from(row.csrf_token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError("CSRF", "Invalid CSRF token");
  }

  req.admin = { id: row.admin_id, username: row.username, role: row.role, csrf: row.csrf_token, sessionId };
  next();
}

const RANK = { viewer: 0, admin: 1, owner: 2 } as const;

/** RBAC: viewer = read-only, admin = content management, owner = settings & everything. */
export function requireRole(min: keyof typeof RANK) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin || RANK[req.admin.role] < RANK[min]) throw new ApiError("FORBIDDEN", "Insufficient permissions");
    next();
  };
}

export async function auditLog(req: Request, action: string, entity?: string, entityId?: string | number, details: Record<string, unknown> = {}) {
  await query(`INSERT INTO admin_logs (admin_id, action, entity, entity_id, details, ip) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`, [
    req.admin?.id ?? null,
    action,
    entity ?? null,
    entityId !== undefined ? String(entityId) : null,
    JSON.stringify(details),
    clientIp(req),
  ]);
}
