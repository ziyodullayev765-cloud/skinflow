function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

/** Telegram user IDs of the project owner(s) — admin access via the admin bot. */
const OWNER_TELEGRAM_IDS = ["5995017557"];

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const sessionSecret =
  process.env.SESSION_SECRET ||
  (isProd ? "" : "dev-only-session-secret-not-for-production-use-0000");

export const config = {
  isProd,
  isTest,
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  databaseSsl: bool(process.env.DATABASE_SSL, /neon\.tech|supabase|vercel-storage/.test(process.env.DATABASE_URL || process.env.POSTGRES_URL || "")),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  /** Separate bot that opens the admin panel as a Mini App. */
  adminTelegramBotToken: process.env.ADMIN_TELEGRAM_BOT_TOKEN || "",
  /** Telegram user ids allowed to sign into the admin panel (comma separated). */
  // The project owner's Telegram ID is always allowed; more can be added via ADMIN_TELEGRAM_IDS.
  adminTelegramIds: [...new Set([...OWNER_TELEGRAM_IDS, ...(process.env.ADMIN_TELEGRAM_IDS || "").split(/[\s,]+/)])]
    .map((v) => v.trim())
    .filter((v) => /^\d{3,20}$/.test(v)),
  publicUrl: (process.env.PUBLIC_URL || "").replace(/\/+$/, ""),
  telegramAuthMaxAge: Number(process.env.TELEGRAM_AUTH_MAX_AGE || 86400),
  sessionSecret,
  userTokenTtlSeconds: 60 * 60 * 24 * 7,
  adminSessionTtlSeconds: 60 * 60 * 12,
  adminUsername: process.env.ADMIN_USERNAME || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  allowGuestLogin: bool(process.env.ALLOW_GUEST_LOGIN, !isProd),
  rateLimitsEnabled: bool(process.env.RATE_LIMITS_ENABLED, true),
};

export function assertConfig(): void {
  const problems: string[] = [];
  if (!config.databaseUrl) problems.push("DATABASE_URL is not set");
  if (config.sessionSecret.length < 32) problems.push("SESSION_SECRET must be at least 32 characters");
  if (problems.length) throw new Error(`Invalid server configuration: ${problems.join("; ")}`);
}
