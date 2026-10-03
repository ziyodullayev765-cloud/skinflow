import { assertConfig } from "../config.js";
import { ensureDatabase } from "./migrate.js";
import { closePool } from "./pool.js";

assertConfig();
ensureDatabase()
  .then(() => console.log("[db] schema and seed data are up to date"))
  .catch((err) => {
    console.error("[db] migration failed", err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
