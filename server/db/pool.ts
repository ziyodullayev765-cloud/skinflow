import pg from "pg";
import { config } from "../config.js";

// BIGINT (int8) columns are returned as JS numbers; all our values stay far below 2^53.
pg.types.setTypeParser(20, (v) => Number(v));
// NUMERIC
pg.types.setTypeParser(1700, (v) => Number(v));

let pool: pg.Pool | null = null;

/**
 * pg currently treats sslmode=require/prefer/verify-ca as verify-full and logs a
 * warning on every cold start. Make that explicit (same behaviour, no warning).
 */
export function normalizeConnectionString(url: string): string {
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)(?=&|$)/i, "$1verify-full");
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: normalizeConnectionString(config.databaseUrl),
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
      max: process.env.VERCEL ? 3 : 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    pool.on("error", (err) => console.error("[db] idle client error", err.message));
  }
  return pool;
}

export type Queryable = pg.Pool | pg.PoolClient;

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
  client: Queryable = getPool(),
): Promise<T[]> {
  const res = await client.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
  client: Queryable = getPool(),
): Promise<T | null> {
  const rows = await query<T>(text, params, client);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside a single database transaction. Rolls back on any thrown error.
 * Every balance / inventory mutation in the app goes through this helper.
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}
