import { randomBytes } from "node:crypto";
import { query, queryOne, withTransaction } from "../db/pool.js";
import { cleanText } from "../lib/sanitize.js";
import type { TelegramUser } from "../lib/telegram.js";
import { levelForXp, nextUtcMidnight, utcDateKey, xpForLevel } from "../lib/time.js";
import { trackMission } from "./missions.js";
import { getSettings } from "./settings.js";

const LANGS = new Set(["en", "ru", "uz"]);

function pickLang(code?: string): string {
  const short = (code || "en").slice(0, 2).toLowerCase();
  return LANGS.has(short) ? short : "en";
}

function safeAvatar(url?: string): string | null {
  if (!url) return null;
  return /^https:\/\/[^\s"'<>]+$/.test(url) && url.length < 500 ? url : null;
}

export async function upsertTelegramUser(tg: TelegramUser): Promise<number> {
  const settings = await getSettings();
  const row = await queryOne<{ id: number }>(
    `INSERT INTO users (telegram_id, username, first_name, last_name, avatar_url, language, virtual_coins)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (telegram_id) DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
       updated_at = now()
     RETURNING id`,
    [
      tg.id,
      tg.username ? cleanText(tg.username).slice(0, 64) : null,
      cleanText(tg.first_name || "").slice(0, 64) || "Player",
      tg.last_name ? cleanText(tg.last_name).slice(0, 64) : null,
      safeAvatar(tg.photo_url),
      pickLang(tg.language_code),
      settings.starting_coins,
    ],
  );
  return row!.id;
}

export async function createGuestUser(): Promise<number> {
  const settings = await getSettings();
  const tag = randomBytes(2).toString("hex").toUpperCase();
  const row = await queryOne<{ id: number }>(
    `INSERT INTO users (is_guest, first_name, username, virtual_coins) VALUES (TRUE, $1, NULL, $2) RETURNING id`,
    [`Guest ${tag}`, settings.starting_coins],
  );
  return row!.id;
}

/** Records today's visit and updates the consecutive-day streak (UTC days). */
export async function checkIn(userId: number): Promise<void> {
  const today = utcDateKey();
  await withTransaction(async (client) => {
    const u = (await query<{ last_seen_date: string | null; streak_days: number }>(
      `SELECT to_char(last_seen_date, 'YYYY-MM-DD') AS last_seen_date, streak_days FROM users WHERE id = $1 FOR UPDATE`,
      [userId],
      client,
    ))[0];
    if (!u || u.last_seen_date === today) return;
    const yesterday = utcDateKey(new Date(Date.now() - 86400000));
    const streak = u.last_seen_date === yesterday ? u.streak_days + 1 : 1;
    await query(`UPDATE users SET last_seen_date = $2::date, streak_days = $3, updated_at = now() WHERE id = $1`, [userId, today, streak], client);
    await trackMission(client, userId, "login_streak", streak, "set");
  });
}

export async function getMe(userId: number) {
  const u = await queryOne(
    `SELECT u.*,
       (SELECT count(*)::int FROM openings o WHERE o.user_id = u.id) AS total_openings,
       (SELECT COALESCE(sum(quantity),0)::int FROM inventory i WHERE i.user_id = u.id) AS total_skins,
       (SELECT count(*)::int FROM inventory i WHERE i.user_id = u.id AND i.quantity > 0) AS unique_skins,
       EXISTS (SELECT 1 FROM daily_rewards d WHERE d.user_id = u.id AND d.claim_date = (now() AT TIME ZONE 'UTC')::date) AS daily_claimed
     FROM users u WHERE u.id = $1`,
    [userId],
  );
  if (!u) return null;
  const settings = await getSettings();
  const level = levelForXp(u.xp);
  return {
    id: u.id,
    telegramId: u.telegram_id,
    isGuest: u.is_guest,
    username: u.username,
    firstName: u.first_name,
    lastName: u.last_name,
    avatarUrl: u.avatar_url,
    language: u.language,
    coins: u.virtual_coins,
    xp: u.xp,
    level,
    levelXp: xpForLevel(level),
    nextLevelXp: xpForLevel(level + 1),
    streakDays: u.streak_days,
    totalOpenings: u.total_openings,
    totalSkins: u.total_skins,
    uniqueSkins: u.unique_skins,
    daily: {
      claimed: u.daily_claimed,
      amount: settings.daily_reward_amount,
      nextAt: nextUtcMidnight().toISOString(),
    },
    createdAt: u.created_at,
  };
}
