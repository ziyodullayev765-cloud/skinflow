import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { query, queryOne } from "../server/db/pool.js";
import { app, guest, resetDb, setCoins, setSetting } from "./helpers.js";

beforeAll(async () => {
  await resetDb();
  await setSetting("open_cooldown_seconds", 0);
});

describe("inventory", () => {
  it("stacks duplicates into one row with quantity", async () => {
    const g = await guest();
    await setCoins(g.userId, 100000);
    // Make the starter case contain exactly one skin so every drop is a duplicate.
    const kase = await queryOne(`SELECT id FROM cases WHERE slug = 'starter'`);
    const only = await queryOne(`SELECT skin_id FROM case_items WHERE case_id = $1 ORDER BY skin_id LIMIT 1`, [kase.id]);
    await query(`DELETE FROM case_items WHERE case_id = $1 AND skin_id <> $2`, [kase.id, only.skin_id]);
    for (let i = 0; i < 3; i++) await request(app).post(`/api/cases/${kase.id}/open`).set(...g.auth).expect(200);
    const rows = await query(`SELECT * FROM inventory WHERE user_id = $1`, [g.userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(3);
    expect(rows[0].acquired_at).toBeTruthy();
    const r = await request(app).get("/api/inventory").set(...g.auth).expect(200);
    expect(r.body.items[0].quantity).toBe(3);
    expect(r.body.items[0].skin.virtualPrice).toBeGreaterThan(0);
  });

  it("returns detail only for owned skins and tracks views", async () => {
    const g = await guest();
    await request(app).get("/api/inventory/1").set(...g.auth).expect(404);
    const open = await request(app).post("/api/cases/1/open").set(...g.auth).expect(200);
    const d = await request(app).get(`/api/inventory/${open.body.skin.id}`).set(...g.auth).expect(200);
    expect(d.body.item.skin.id).toBe(open.body.skin.id);
    const missions = await request(app).get("/api/missions").set(...g.auth);
    expect(missions.body.missions.find((m: { type: string }) => m.type === "view_skins").progress).toBe(1);
  });

  it("toggles favorites and completes the profile mission", async () => {
    const g = await guest();
    const open = await request(app).post("/api/cases/1/open").set(...g.auth).expect(200);
    await request(app).post(`/api/inventory/${open.body.skin.id}/favorite`).set(...g.auth).send({ favorite: true }).expect(200);
    const p = await request(app).get("/api/profile").set(...g.auth).expect(200);
    expect(p.body.favoriteSkin.id).toBe(open.body.skin.id);
    const missions = await request(app).get("/api/missions").set(...g.auth);
    expect(missions.body.missions.find((m: { type: string }) => m.type === "complete_profile").completed).toBe(true);
    await request(app).post(`/api/inventory/99999/favorite`).set(...g.auth).send({ favorite: true }).expect(404);
    await request(app).post(`/api/inventory/${open.body.skin.id}/favorite`).set(...g.auth).send({ favorite: "yes" }).expect(400);
  });

  it("sells skins back for virtual coins at the server-side price only", async () => {
    const g = await guest();
    await setCoins(g.userId, 100000);
    const kase = await queryOne(`SELECT id FROM cases WHERE slug = 'neon'`);
    const only = await queryOne(`SELECT ci.skin_id, s.virtual_price FROM case_items ci JOIN skins s ON s.id = ci.skin_id WHERE case_id = $1 ORDER BY skin_id LIMIT 1`, [kase.id]);
    await query(`DELETE FROM case_items WHERE case_id = $1 AND skin_id <> $2`, [kase.id, only.skin_id]);
    for (let i = 0; i < 3; i++) await request(app).post(`/api/cases/${kase.id}/open`).set(...g.auth).expect(200);
    const before = (await queryOne(`SELECT virtual_coins FROM users WHERE id = $1`, [g.userId])).virtual_coins;
    const r = await request(app).post(`/api/inventory/${only.skin_id}/sell`).set(...g.auth).send({ quantity: 2, price: 999999 }).expect(200);
    expect(r.body).toMatchObject({ sold: 2, remaining: 1, earned: only.virtual_price * 2, balance: before + only.virtual_price * 2 });
    await request(app).post(`/api/inventory/${only.skin_id}/sell`).set(...g.auth).send({ quantity: 5 }).expect(400);
    await request(app).post(`/api/inventory/${only.skin_id}/sell`).set(...g.auth).send({ quantity: 1 }).expect(200);
    await request(app).post(`/api/inventory/${only.skin_id}/sell`).set(...g.auth).send({ quantity: 1 }).expect(404);
    const inv = await request(app).get("/api/inventory").set(...g.auth);
    expect(inv.body.items.find((i: { skin: { id: number } }) => i.skin.id === only.skin_id)).toBeUndefined();
    const sales = await queryOne(`SELECT COALESCE(sum(quantity),0)::int AS n FROM sales WHERE user_id = $1`, [g.userId]);
    expect(sales.n).toBe(3);
  });

  it("concurrent sells can never sell more than owned", async () => {
    const g = await guest();
    const open = await request(app).post("/api/cases/1/open").set(...g.auth).expect(200);
    const results = await Promise.all(Array.from({ length: 6 }, () => request(app).post(`/api/inventory/${open.body.skin.id}/sell`).set(...g.auth).send({ quantity: 1 })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it("redeems promo codes once per player for virtual coins", async () => {
    await query(`INSERT INTO promo_codes (code, reward, max_uses) VALUES ('WELCOME', 300, 2)`);
    await query(`INSERT INTO promo_codes (code, reward, expires_at) VALUES ('OLD', 300, now() - interval '1 day')`);
    const a = await guest();
    const b = await guest();
    const c = await guest();
    const before = (await queryOne(`SELECT virtual_coins FROM users WHERE id = $1`, [a.userId])).virtual_coins;
    const r = await request(app).post("/api/promo/redeem").set(...a.auth).send({ code: "welcome" }).expect(200);
    expect(r.body).toMatchObject({ reward: 300, balance: before + 300 });
    await request(app).post("/api/promo/redeem").set(...a.auth).send({ code: "WELCOME" }).expect(409);
    await request(app).post("/api/promo/redeem").set(...b.auth).send({ code: "WELCOME" }).expect(200);
    await request(app).post("/api/promo/redeem").set(...c.auth).send({ code: "WELCOME" }).expect(409);
    await request(app).post("/api/promo/redeem").set(...c.auth).send({ code: "OLD" }).expect(404);
    await request(app).post("/api/promo/redeem").set(...c.auth).send({ code: "NOPE" }).expect(404);
    await request(app).post("/api/promo/redeem").set(...c.auth).send({ code: "<x>" }).expect(400);
  });

  it("has no endpoints to trade, withdraw, deposit or edit items/prices", async () => {
    const g = await guest();
    for (const [method, path] of [
      ["post", "/api/withdraw"],
      ["post", "/api/trade"],
      ["put", "/api/skins/1"],
      ["put", "/api/inventory/1"],
      ["post", "/api/deposit"],
    ] as const) {
      await request(app)[method](path).set(...g.auth).send({ virtualPrice: 1 }).expect(404);
    }
  });
});
