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

  it("has no endpoints to sell, trade, withdraw or edit items/prices", async () => {
    const g = await guest();
    for (const [method, path] of [
      ["post", "/api/inventory/1/sell"],
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
