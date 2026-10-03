import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { config } from "../config.js";
import { queryOne } from "../db/pool.js";
import { botApi, botToken, webhookSecret, type BotKind } from "../lib/telegramBot.js";

export const telegramRouter = Router();

function originFor(req: { protocol: string; get(h: string): string | undefined }) {
  return config.publicUrl || `https://${req.get("x-forwarded-host") || req.get("host")}`;
}

/**
 * Bot webhooks. Only /start is handled: it replies with a button that opens
 * the Mini App (player app or admin panel). Requests are authenticated with
 * Telegram's secret_token header.
 */
telegramRouter.post("/webhook/:kind", async (req, res) => {
  const kind = req.params.kind as BotKind;
  if ((kind !== "app" && kind !== "admin") || !botToken(kind)) return res.status(404).end();
  const header = Buffer.from(String(req.headers["x-telegram-bot-api-secret-token"] || ""));
  const expected = Buffer.from(webhookSecret(kind));
  if (header.length !== expected.length || !timingSafeEqual(header, expected)) return res.status(401).end();

  // Always acknowledge quickly so Telegram does not retry.
  const msg = req.body?.message;
  const text: string = typeof msg?.text === "string" ? msg.text : "";
  const chatId = msg?.chat?.id;
  const fromId = msg?.from?.id;
  if (!chatId || !text.startsWith("/start")) return res.json({ ok: true });

  const origin = originFor(req);
  try {
    if (kind === "app") {
      await botApi("app", "sendMessage", {
        chat_id: chatId,
        text:
          "🎯 SkinFlow — virtual CS2-inspired skin collection.\n\nOpen free cases with demo coins, collect original skins and complete missions.\n\nEntertainment only: coins and skins have no real-world value and cannot be bought, sold or withdrawn.",
        reply_markup: { inline_keyboard: [[{ text: "▶️ Open SkinFlow", web_app: { url: `${origin}/` } }]] },
      });
    } else {
      const known = await queryOne(`SELECT 1 FROM admin_users WHERE telegram_id = $1 AND active`, [fromId]);
      const allowed = !!known || config.adminTelegramIds.includes(String(fromId));
      await botApi("admin", "sendMessage", {
        chat_id: chatId,
        text: allowed
          ? `🛡 SkinFlow Admin\n\nYour Telegram ID: ${fromId}\nAccess: granted ✅`
          : `🛡 SkinFlow Admin\n\nYour Telegram ID: ${fromId}\nAccess: not granted.\n\nAdd this ID to ADMIN_TELEGRAM_IDS in the server environment (or link it in Admin → Settings) to sign in.`,
        reply_markup: allowed ? { inline_keyboard: [[{ text: "🛡 Open Admin Panel", web_app: { url: `${origin}/admin` } }]] } : undefined,
      });
    }
  } catch (err) {
    console.error("[telegram] webhook reply failed", (err as Error).message);
  }
  res.json({ ok: true });
});

/** Registers webhooks, menu buttons and commands for both bots. Called from the admin panel. */
export async function setupBots(origin: string) {
  const results: Record<string, unknown> = {};
  for (const kind of ["app", "admin"] as BotKind[]) {
    if (!botToken(kind)) {
      results[kind] = { configured: false };
      continue;
    }
    try {
      const me = await botApi<{ username: string }>(kind, "getMe");
      await botApi(kind, "setWebhook", {
        url: `${origin}/api/telegram/webhook/${kind}`,
        secret_token: webhookSecret(kind),
        allowed_updates: ["message"],
        drop_pending_updates: true,
      });
      await botApi(kind, "setChatMenuButton", {
        menu_button: { type: "web_app", text: kind === "app" ? "Play" : "Admin", web_app: { url: kind === "app" ? `${origin}/` : `${origin}/admin` } },
      });
      await botApi(kind, "setMyCommands", { commands: [{ command: "start", description: kind === "app" ? "Open SkinFlow" : "Open admin panel" }] });
      if (kind === "app") {
        await botApi(kind, "setMyDescription", {
          description: "Open free virtual cases and collect original CS2-inspired skins. Entertainment only — no real money, no cash-out.",
        }).catch(() => undefined);
      }
      results[kind] = { configured: true, username: me.username, webhook: `${origin}/api/telegram/webhook/${kind}` };
    } catch (err) {
      results[kind] = { configured: true, error: (err as Error).message };
    }
  }
  return results;
}
