import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { ensureDatabase } from "./db/migrate.js";

/**
 * Standalone server for local development and non-Vercel hosting.
 * In production it also serves the built SPA from /dist.
 */
const app = createApp();
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");

if (config.isProd && existsSync(dist)) {
  app.use("/static", express.static(path.join(dist, "static"), { immutable: true, maxAge: "1y" }));
  app.use("/assets", express.static(path.join(dist, "assets"), { maxAge: "7d" }));
  app.use(express.static(dist, { index: false, maxAge: 0 }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

ensureDatabase()
  .then(() => {
    app.listen(config.port, () => console.log(`[skinflow] API listening on http://localhost:${config.port}`));
  })
  .catch((err) => {
    console.error("[skinflow] failed to start", err);
    process.exit(1);
  });
