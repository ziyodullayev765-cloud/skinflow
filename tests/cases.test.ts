import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query, queryOne } from "../server/db/pool.js";
import { app, guest, resetDb, setCoins, setSetting } from "./helpers.js";

beforeAll(resetDb);
beforeEach(() => setSetting("open_cooldown_seconds", 0));

describe("case listing", () => {
  it("lists active cases with visible odds that sum to 1", async () => {
    const g = await guest();
    const r = await request(app).get("/api/cases").set(...g.auth).expect(200);
    expect(r.body.cases).toHaveLength(6);
    for (const c of r.body.cases) {
      const sum = Object.values(c.rarityOdds as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
      expect(c.items.length).toBe(c.itemCount);
    }
  });
});

describe("case opening", () => {
  it("deducts cost, stores the server-chosen item and returns a consistent reel", async () => {
    const g = await guest();
    const before = (await request(app).get("/api/me").set(...g.auth)).body.user.coins;
    const kase = await queryOne(`SELECT id, cost FROM cases WHERE slug = 'neon'`);
    const r = await request(app)
      .post(`/api/cases/${kase.id}/open`)
      .set(...g.auth)
      .send({ skinId: 1, rarity: "legendary", balance: 999999 }) // ignored by the server
      .expect(200);
    expect(r.body.balance).toBe(before - kase.cost);
    expect(r.body.reel[r.body.winIndex].id).toBe(r.body.skin.id);
    const inCase = await queryOne(`SELECT 1 FROM case_items WHERE case_id = $1 AND skin_id = $2`, [kase.id, r.body.skin.id]);
    expect(inCase).toBeTruthy();
    const inv = await queryOne(`SELECT quantity FROM inventory WHERE user_id = $1 AND skin_id = $2`, [g.userId, r.body.skin.id]);
    expect(inv.quantity).toBe(1);
    const opening = await queryOne(`SELECT * FROM openings WHERE id = $1`, [r.body.openingId]);
    expect(opening.skin_id).toBe(r.body.skin.id);
  });

  it("refuses with INSUFFICIENT_COINS and changes nothing", async () => {
    const g = await guest();
    await setCoins(g.userId, 10);
    const r = await request(app).post("/api/cases/1/open").set(...g.auth).expect(402);
    expect(r.body.error.code).toBe("INSUFFICIENT_COINS");
    const u = await queryOne(`SELECT virtual_coins FROM users WHERE id = $1`, [g.userId]);
    expect(u.virtual_coins).toBe(10);
    const n = await queryOne(`SELECT count(*)::int AS n FROM openings WHERE user_id = $1`, [g.userId]);
    expect(n.n).toBe(0);
  });

  it("enforces the server-side cooldown", async () => {
    await setSetting("open_cooldown_seconds", 30);
    const g = await guest();
    await request(app).post("/api/cases/1/open").set(...g.auth).expect(200);
    const r = await request(app).post("/api/cases/1/open").set(...g.auth).expect(429);
    expect(r.body.error.code).toBe("COOLDOWN");
  });

  it("rejects inactive, unknown and globally paused cases", async () => {
    const g = await guest();
    await query(`UPDATE cases SET active = FALSE WHERE id = 2`);
    expect((await request(app).post("/api/cases/2/open").set(...g.auth).expect(410)).body.error.code).toBe("CASE_UNAVAILABLE");
    await request(app).post("/api/cases/99999/open").set(...g.auth).expect(410);
    await request(app).post("/api/cases/abc/open").set(...g.auth).expect(400);
    await query(`UPDATE cases SET active = TRUE WHERE id = 2`);
    await setSetting("cases_enabled", false);
    await request(app).post("/api/cases/2/open").set(...g.auth).expect(410);
    await setSetting("cases_enabled", true);
  });

  it("never drops inactive skins", async () => {
    const g = await guest();
    await setCoins(g.userId, 100000);
    const kase = await queryOne(`SELECT id FROM cases WHERE slug = 'starter'`);
    const keep = await queryOne(`SELECT skin_id FROM case_items WHERE case_id = $1 ORDER BY skin_id LIMIT 1`, [kase.id]);
    await query(`UPDATE skins SET active = FALSE WHERE id IN (SELECT skin_id FROM case_items WHERE case_id = $1) AND id <> $2`, [kase.id, keep.skin_id]);
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post(`/api/cases/${kase.id}/open`).set(...g.auth).expect(200);
      expect(r.body.skin.id).toBe(keep.skin_id);
    }
    await query(`UPDATE skins SET active = TRUE`);
  });

  it("requires authentication", async () => {
    await request(app).post("/api/cases/1/open").expect(401);
  });
});
