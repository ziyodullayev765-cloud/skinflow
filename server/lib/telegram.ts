import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_bot?: boolean;
}

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: number }
  | { ok: false; reason: "missing" | "malformed" | "bad_signature" | "expired" | "no_user" | "no_token" };

/**
 * Validates Telegram Mini App initData exactly as described in
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
 * hash       = hex(HMAC_SHA256(key=secret_key, msg=data_check_string))
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
  nowSeconds = Math.floor(Date.now() / 1000),
): InitDataResult {
  if (!botToken) return { ok: false, reason: "no_token" };
  if (!initData || typeof initData !== "string") return { ok: false, reason: "missing" };
  if (initData.length > 8192) return { ok: false, reason: "malformed" };

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const hash = params.get("hash");
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return { ok: false, reason: "malformed" };
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: "malformed" };
  if (maxAgeSeconds > 0 && nowSeconds - authDate > maxAgeSeconds) return { ok: false, reason: "expired" };

  const rawUser = params.get("user");
  if (!rawUser) return { ok: false, reason: "no_user" };
  try {
    const user = JSON.parse(rawUser) as TelegramUser;
    if (!Number.isSafeInteger(user.id) || typeof user.first_name !== "string") return { ok: false, reason: "no_user" };
    return { ok: true, user, authDate };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

/** Test helper: builds a correctly signed initData string. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}
