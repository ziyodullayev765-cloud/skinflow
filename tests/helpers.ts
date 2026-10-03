import request from "supertest";
import { createApp } from "../server/app.js";
import { ensureDatabase, resetMigrationState } from "../server/db/migrate.js";
import { getPool, query } from "../server/db/pool.js";
import { signInitData } from "../server/lib/telegram.js";
import { invalidateSettings } from "../server/services/settings.js";

export const app = createApp();

/** Drops and recreates the whole schema + seed data. */
export async function resetDb() {
  await getPool().query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  resetMigrationState();
  invalidateSettings();
  await ensureDatabase();
}

export async function setSetting(key: string, value: unknown) {
  await query(`UPDATE settings SET value = $2::jsonb WHERE key = $1`, [key, JSON.stringify(value)]);
  invalidateSettings();
}

export function tgInitData(user: Record<string, unknown>, botToken = process.env.TELEGRAM_BOT_TOKEN!, authDate = Math.floor(Date.now() / 1000)) {
  return signInitData({ auth_date: String(authDate), query_id: "AAE-test", user: JSON.stringify(user) }, botToken);
}

export async function guest(): Promise<{ token: string; userId: number; auth: [string, string] }> {
  const r = await request(app).post("/api/auth/guest").expect(201);
  return { token: r.body.token, userId: r.body.user.id, auth: ["Authorization", `Bearer ${r.body.token}`] };
}

export async function adminAgent(username = "owner", password = "owner-password-123") {
  const agent = request.agent(app);
  const r = await agent.post("/api/admin/login").send({ username, password }).expect(200);
  return { agent, csrf: r.body.csrfToken as string };
}

export async function setCoins(userId: number, coins: number) {
  await query(`UPDATE users SET virtual_coins = $2, last_open_at = NULL WHERE id = $1`, [userId, coins]);
}
