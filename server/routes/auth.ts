import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { ApiError } from "../lib/errors.js";
import { rateLimit } from "../lib/rateLimit.js";
import { validateInitData } from "../lib/telegram.js";
import { signUserToken } from "../lib/token.js";
import { parse } from "../lib/validate.js";
import { checkIn, createGuestUser, getMe, upsertTelegramUser } from "../services/users.js";

export const authRouter = Router();

authRouter.post("/telegram", rateLimit("auth", 30, 60), async (req, res) => {
  const { initData } = parse(z.object({ initData: z.string().min(1).max(8192) }), req.body);
  const result = validateInitData(initData, config.telegramBotToken, config.telegramAuthMaxAge);
  if (!result.ok) {
    if (result.reason === "no_token") throw new ApiError("SERVER", "Telegram login is not configured on the server.");
    throw new ApiError("INVALID_SESSION", "Invalid Telegram session. Please reopen the app from Telegram.", { reason: result.reason });
  }
  if (result.user.is_bot) throw new ApiError("FORBIDDEN", "Bots cannot sign in");
  const userId = await upsertTelegramUser(result.user);
  await checkIn(userId);
  res.json({ token: signUserToken(userId), user: await getMe(userId) });
});

/** Browser demo: server creates the account; the client never supplies identity. */
authRouter.post("/guest", rateLimit("guest", 10, 3600), async (_req, res) => {
  if (!config.allowGuestLogin) throw new ApiError("FORBIDDEN", "Please open SkinFlow from Telegram.");
  const userId = await createGuestUser();
  await checkIn(userId);
  res.status(201).json({ token: signUserToken(userId), user: await getMe(userId) });
});
