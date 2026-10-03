import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { assertConfig, config } from "./config.js";
import { ensureDatabase } from "./db/migrate.js";
import { ApiError } from "./lib/errors.js";
import { rateLimit } from "./lib/rateLimit.js";
import { getPrivateObject, isSafeKey, LOCAL_UPLOAD_DIR, storageDriver } from "./lib/storage.js";
import { Readable } from "node:stream";
import { adminRouter } from "./routes/admin/index.js";
import { authRouter } from "./routes/auth.js";
import { userRouter } from "./routes/user.js";
import { telegramRouter } from "./routes/telegram.js";
import { getSettings } from "./services/settings.js";

export function createApp() {
  assertConfig();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.set("etag", false);

  app.use(
    helmet({
      contentSecurityPolicy: false, // HTML is served by the static host with its own CSP
      crossOriginResourcePolicy: { policy: "same-origin" },
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  // Health check does not require the database to be migrated.
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Lazily migrate on first request (serverless cold start friendly).
  app.use("/api", async (_req, _res, next) => {
    await ensureDatabase();
    next();
  });

  app.use("/api", rateLimit("global", 600, 60));

  app.get("/api/config", async (_req, res) => {
    const s = await getSettings();
    res.json({
      appName: s.app_name,
      maintenance: s.maintenance_mode,
      animationIntensity: s.animation_intensity,
      minAppVersion: s.min_app_version,
      casesEnabled: s.cases_enabled,
      guestLogin: config.allowGuestLogin,
      telegramLogin: !!config.telegramBotToken,
      botUsername: (s as unknown as Record<string, unknown>).telegram_bot_username ?? null,
      build: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });
  });

  // Local object storage (dev / self-hosted). On Vercel, images are served from the Blob CDN.
  if (storageDriver() === "local") {
    app.use("/api/files", express.static(LOCAL_UPLOAD_DIR, { immutable: true, maxAge: "1y", index: false, dotfiles: "deny", fallthrough: false }));
  }

  // Private Vercel Blob objects are proxied here (skin art is public content, so no auth).
  app.get(/^\/api\/media\/(.+)$/, async (req, res) => {
    const key = decodeURIComponent((req.params as Record<string, string>)[0] ?? "");
    if (!isSafeKey(key) || !key.startsWith("skins/")) throw new ApiError("NOT_FOUND", "Not found");
    const obj = await getPrivateObject(key).catch(() => null);
    if (!obj) throw new ApiError("NOT_FOUND", "Not found");
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    Readable.fromWeb(obj.stream as unknown as import("node:stream/web").ReadableStream).pipe(res);
  });

  app.use("/api/telegram", telegramRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", userRouter);

  app.use("/api", (_req, _res, next) => next(new ApiError("NOT_FOUND", "Endpoint not found")));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      if (err.retryAfter) res.setHeader("Retry-After", String(err.retryAfter));
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details, retryAfter: err.retryAfter } });
      return;
    }
    const e = err as { type?: string; status?: number; message?: string };
    if (e?.type === "entity.parse.failed") {
      res.status(400).json({ error: { code: "VALIDATION", message: "Malformed JSON body" } });
      return;
    }
    if (e?.type === "entity.too.large") {
      res.status(413).json({ error: { code: "VALIDATION", message: "Request body too large" } });
      return;
    }
    console.error("[api] unhandled error", err);
    // Signed-in admins get the underlying reason to make production issues diagnosable.
    const reason = req.admin ? ` (${(err as Error)?.message ?? String(err)})`.slice(0, 400) : "";
    res.status(500).json({ error: { code: "SERVER", message: `Something went wrong on our side. Please try again.${reason}` } });
  });

  return app;
}
