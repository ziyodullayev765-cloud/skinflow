import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureDatabase, resetMigrationState } from "../server/db/migrate.js";
import { query, queryOne } from "../server/db/pool.js";
import { resetDb } from "./helpers.js";

let other: pg.Client;

beforeAll(async () => {
  await resetDb();
  other = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await other.connect();
});
afterAll(async () => {
  await other.end();
});

describe("database migrations", () => {
  it("records the schema version and skips DDL on later cold starts", async () => {
    const v = await queryOne(`SELECT value #>> '{}' AS v FROM settings WHERE key = 'schema_version'`);
    expect(v.v).toMatch(/^[a-f0-9]{16}$/);
    resetMigrationState();
    const t0 = Date.now();
    await ensureDatabase();
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it("is not blocked by a stale session-level advisory lock (the old pgbouncer hang)", async () => {
    await other.query("SELECT pg_advisory_lock(727274)"); // what the old code could leave behind
    await query(`DELETE FROM settings WHERE key = 'schema_version'`);
    resetMigrationState();
    const t0 = Date.now();
    await ensureDatabase();
    expect(Date.now() - t0).toBeLessThan(10_000);
    await other.query("SELECT pg_advisory_unlock(727274)");
  });

  it("fails fast instead of hanging when another migration holds the lock", async () => {
    await other.query("BEGIN");
    await other.query("SELECT pg_advisory_xact_lock(727275)");
    await query(`DELETE FROM settings WHERE key = 'schema_version'`);
    resetMigrationState();
    const t0 = Date.now();
    await expect(ensureDatabase()).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(15_000);
    await other.query("ROLLBACK");
    resetMigrationState();
    await ensureDatabase(); // recovers once the lock is gone
  }, 30_000);
});
