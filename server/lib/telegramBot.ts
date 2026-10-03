import { createHmac } from "node:crypto";
import { config } from "../config.js";

export type BotKind = "app" | "admin";

export function botToken(kind: BotKind): string {
  return kind === "app" ? config.telegramBotToken : config.adminTelegramBotToken;
}

/** Secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token for webhook calls. */
export function webhookSecret(kind: BotKind): string {
  return createHmac("sha256", config.sessionSecret).update(`telegram-webhook:${kind}:${botToken(kind)}`).digest("hex").slice(0, 48);
}

export async function botApi<T = unknown>(kind: BotKind, method: string, payload: Record<string, unknown> = {}): Promise<T> {
  const token = botToken(kind);
  if (!token) throw new Error(`${kind} bot token is not configured`);
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? res.status}`);
  return data.result as T;
}
