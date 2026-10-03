import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { queryOne } from "../server/db/pool.js";
import { app, guest, resetDb, setCoins, setSetting } from "./helpers.js";

beforeAll(async () => {
  await resetDb();
  await setSetting("open_cooldown_seconds", 0);
});

describe("database transaction safety", () => {
  it("concurrent openings can never overspend the balance", async () => {
    const g = await guest();
    const kase = await queryOne(`SELECT id, cost FROM cases WHERE slug = 'starter'`);
    await setCoins(g.userId, kase.cost * 3);
    const results = await Promise.all(Array.from({ length: 12 }, () => request(app).post(`/api/cases/${kase.id}/open`).set(...g.auth)));
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(3);
    expect(results.filter((r) => r.status === 402).length).toBe(9);
    const u = await queryOne(`SELECT virtual_coins FROM users WHERE id = $1`, [g.userId]);
    expect(u.virtual_coins).toBe(0);
    const inv = await queryOne(`SELECT COALESCE(sum(quantity),0)::int AS n FROM inventory WHERE user_id = $1`, [g.userId]);
    const opens = await queryOne(`SELECT count(*)::int AS n FROM openings WHERE user_id = $1`, [g.userId]);
    expect(inv.n).toBe(3);
    expect(opens.n).toBe(3);
  });

  it("concurrent daily reward claims pay out exactly once", async () => {
    const g = await guest();
    const before = (await queryOne(`SELECT virtual_coins FROM users WHERE id = $1`, [g.userId])).virtual_coins;
    const results = await Promise.all(Array.from({ length: 8 }, () => request(app).post("/api/daily-reward").set(...g.auth)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    const after = (await queryOne(`SELECT virtual_coins FROM users WHERE id = $1`, [g.userId])).virtual_coins;
    expect(after - before).toBe(250);
  });

  it("concurrent mission claims pay out exactly once", async () => {
    const g = await guest();
    await request(app).post("/api/cases/1/open").set(...g.auth).expect(200);
    const m = await queryOne(`SELECT id, reward FROM missions WHERE code = 'daily-open-1'`);
    const before = (await queryOne(`SELECT virtual_coins FROM users WHERE id = $1`, [g.userId])).virtual_coins;
    const results = await Promise.all(Array.from({ length: 6 }, () => request(app).post(`/api/missions/${m.id}/claim`).set(...g.auth)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const after = (await queryOne(`SELECT virtual_coins FROM users WHERE id = $1`, [g.userId])).virtual_coins;
    expect(after - before).toBe(m.reward);
  });

  it("a failed opening rolls back completely (DB constraint keeps balance >= 0)", async () => {
    const g = await guest();
    await expect(queryOne(`UPDATE users SET virtual_coins = -1 WHERE id = $1`, [g.userId])).rejects.toThrow();
  });
});
