import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../../db/pool.js";
import { ApiError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { validateInitData } from "../../lib/telegram.js";
import { randomBytes } from "node:crypto";
import { clientIp, hitRateLimit, resetRateLimit } from "../../lib/rateLimit.js";
import { parse } from "../../lib/validate.js";
import { config } from "../../config.js";
import { ADMIN_COOKIE, adminCookieOptions, auditLog, createAdminSession, destroyAdminSession, requireAdmin } from "../../middleware/adminAuth.js";

export const adminAuthRouter = Router();

// A precomputed hash so unknown usernames take the same time as wrong passwords.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

adminAuthRouter.post("/login", async (req, res) => {
  const body = parse(z.object({ username: z.string().trim().min(1).max(120), password: z.string().min(1).max(200) }), req.body);
  const login = body.username.toLowerCase();
  const ip = clientIp(req);

  if (config.rateLimitsEnabled) {
    const [byIp, byUser] = await Promise.all([hitRateLimit(`admin-login-ip:${ip}`, 10, 900), hitRateLimit(`admin-login-user:${login}`, 5, 900)]);
    if (!byIp.allowed || !byUser.allowed) {
      const retry = Math.max(byIp.retryAfter, byUser.retryAfter);
      res.setHeader("Retry-After", String(retry));
      throw new ApiError("RATE_LIMITED", "Too many login attempts. Try again later.", undefined, retry);
    }
  }

  const admin = await queryOne<{ id: number; username: string; role: string; password_hash: string; active: boolean }>(
    `SELECT id, username, role, password_hash, active FROM admin_users WHERE username = $1 OR lower(email) = $1`,
    [login],
  );
  const ok = await verifyPassword(body.password, admin?.password_hash ?? DUMMY_HASH);
  if (!admin || !ok || !admin.active) {
    await query(`INSERT INTO admin_logs (admin_id, action, details, ip) VALUES ($1, 'login_failed', $2::jsonb, $3)`, [
      admin?.id ?? null,
      JSON.stringify({ username: login.slice(0, 60) }),
      ip,
    ]);
    throw new ApiError("UNAUTHORIZED", "Invalid username or password");
  }

  await resetRateLimit(`admin-login-user:${login}`);
  const { token, csrf } = await createAdminSession(admin.id, req);
  await query(`UPDATE admin_users SET last_login_at = now() WHERE id = $1`, [admin.id]);
  req.admin = { id: admin.id, username: admin.username, role: admin.role as "owner", csrf, sessionId: "" };
  await auditLog(req, "login");
  res.cookie(ADMIN_COOKIE, token, adminCookieOptions());
  res.json({ admin: { id: admin.id, username: admin.username, role: admin.role }, csrfToken: csrf });
});

/**
 * Admin Mini App login: initData signed by the ADMIN bot, user id must be
 * linked to an admin account or listed in ADMIN_TELEGRAM_IDS.
 */
adminAuthRouter.post("/login/telegram", async (req, res) => {
  const { initData } = parse(z.object({ initData: z.string().min(1).max(8192) }), req.body);
  const ip = clientIp(req);
  if (config.rateLimitsEnabled) {
    const r = await hitRateLimit(`admin-login-tg:${ip}`, 20, 900);
    if (!r.allowed) throw new ApiError("RATE_LIMITED", "Too many login attempts. Try again later.", undefined, r.retryAfter);
  }
  if (!config.adminTelegramBotToken) throw new ApiError("FORBIDDEN", "Telegram admin login is not configured.");
  const v = validateInitData(initData, config.adminTelegramBotToken, 3600);
  if (!v.ok) throw new ApiError("INVALID_SESSION", "Invalid Telegram session. Reopen the admin panel from the admin bot.", { reason: v.reason });
  const tgId = v.user.id;

  let admin = await queryOne<{ id: number; username: string; role: string; active: boolean }>(
    `SELECT id, username, role, active FROM admin_users WHERE telegram_id = $1`,
    [tgId],
  );
  if (!admin && config.adminTelegramIds.includes(String(tgId))) {
    const uname = (v.user.username ? `tg_${v.user.username}` : `tg_${tgId}`).toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);
    admin = await queryOne(
      `INSERT INTO admin_users (username, telegram_id, password_hash, role) VALUES ($1, $2, $3, 'owner')
       ON CONFLICT (username) DO UPDATE SET telegram_id = EXCLUDED.telegram_id RETURNING id, username, role, active`,
      [uname, tgId, await hashPassword(randomBytes(32).toString("hex"))],
    );
  }
  if (!admin || !admin.active) {
    await query(`INSERT INTO admin_logs (action, details, ip) VALUES ('login_failed', $1::jsonb, $2)`, [JSON.stringify({ telegramId: tgId, via: "telegram" }), ip]);
    throw new ApiError("FORBIDDEN", "This Telegram account is not an admin.", { telegramId: tgId });
  }
  const { token, csrf } = await createAdminSession(admin.id, req);
  await query(`UPDATE admin_users SET last_login_at = now() WHERE id = $1`, [admin.id]);
  req.admin = { id: admin.id, username: admin.username, role: admin.role as "owner", csrf, sessionId: "" };
  await auditLog(req, "login", undefined, undefined, { via: "telegram", telegramId: tgId });
  res.cookie(ADMIN_COOKIE, token, adminCookieOptions());
  res.json({ admin: { id: admin.id, username: admin.username, role: admin.role }, csrfToken: csrf });
});

adminAuthRouter.post("/logout", requireAdmin, async (req, res) => {
  await destroyAdminSession(req.admin!.sessionId);
  await auditLog(req, "logout");
  res.clearCookie(ADMIN_COOKIE, { ...adminCookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

adminAuthRouter.get("/me", requireAdmin, async (req, res) => {
  const a = req.admin!;
  res.json({ admin: { id: a.id, username: a.username, role: a.role }, csrfToken: a.csrf });
});
