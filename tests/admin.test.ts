import { readFileSync } from "node:fs";
import sharp from "sharp";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { query, queryOne } from "../server/db/pool.js";
import { hashPassword } from "../server/lib/password.js";
import { adminAgent, app, guest, resetDb, setSetting, tgInitData } from "./helpers.js";

let png: Buffer;

beforeAll(async () => {
  await resetDb();
  await setSetting("open_cooldown_seconds", 0);
  png = await sharp({ create: { width: 600, height: 300, channels: 4, background: { r: 200, g: 60, b: 90, alpha: 0.9 } } }).png().toBuffer();
  await query(`INSERT INTO admin_users (username, password_hash, role) VALUES ('viewer1', $1, 'viewer')`, [await hashPassword("viewer-password-1")]);
});

function upload(agent: ReturnType<typeof request.agent>, csrf: string, body: Buffer = png, type = "image/png") {
  return agent.post("/api/admin/uploads").set("X-CSRF-Token", csrf).set("Content-Type", type).send(body);
}

describe("admin authentication", () => {
  it("rejects wrong credentials", async () => {
    const r = await request(app).post("/api/admin/login").send({ username: "owner", password: "nope" }).expect(401);
    expect(r.body.error.code).toBe("UNAUTHORIZED");
  });

  it("sets an httpOnly session cookie and returns a CSRF token", async () => {
    const r = await request(app).post("/api/admin/login").send({ username: "owner", password: "owner-password-123" }).expect(200);
    const cookie = String(r.headers["set-cookie"]);
    expect(cookie).toMatch(/sf_admin=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(r.body.csrfToken).toBeTruthy();
    expect(JSON.stringify(r.body)).not.toMatch(/password/i);
  });

  it("blocks admin endpoints without a session, and user tokens are not admin sessions", async () => {
    await request(app).get("/api/admin/dashboard").expect(401);
    const g = await guest();
    await request(app).get("/api/admin/dashboard").set(...g.auth).expect(401);
  });

  it("requires a CSRF token for mutations", async () => {
    const { agent } = await adminAgent();
    const r = await agent.post("/api/admin/collections").send({ name: "No CSRF" }).expect(403);
    expect(r.body.error.code).toBe("CSRF");
  });

  it("logs out and invalidates the session", async () => {
    const { agent, csrf } = await adminAgent();
    await agent.post("/api/admin/logout").set("X-CSRF-Token", csrf).expect(200);
    await agent.get("/api/admin/me").expect(401);
  });

  it("supports Telegram login via the admin bot for allowed IDs only", async () => {
    const ok = await request(app)
      .post("/api/admin/login/telegram")
      .send({ initData: tgInitData({ id: 777000111, first_name: "Boss", username: "boss" }, process.env.ADMIN_TELEGRAM_BOT_TOKEN) })
      .expect(200);
    expect(ok.body.admin.role).toBe("owner");
    const denied = await request(app)
      .post("/api/admin/login/telegram")
      .send({ initData: tgInitData({ id: 123, first_name: "Rando" }, process.env.ADMIN_TELEGRAM_BOT_TOKEN) })
      .expect(403);
    expect(denied.body.error.details.telegramId).toBe(123);
    // initData from the PLAYER bot must not open the admin panel.
    await request(app)
      .post("/api/admin/login/telegram")
      .send({ initData: tgInitData({ id: 777000111, first_name: "Boss" }) })
      .expect(401);
  });
});

describe("owner Telegram account", () => {
  it("lets the project owner's Telegram ID into the admin panel by default", async () => {
    const r = await request(app)
      .post("/api/admin/login/telegram")
      .send({ initData: tgInitData({ id: 5995017557, first_name: "Owner" }, process.env.ADMIN_TELEGRAM_BOT_TOKEN) })
      .expect(200);
    expect(r.body.admin.role).toBe("owner");
  });
});

describe("admin RBAC", () => {
  it("viewer can read but not mutate; settings are owner-only", async () => {
    const { agent, csrf } = await adminAgent("viewer1", "viewer-password-1");
    await agent.get("/api/admin/skins").expect(200);
    await agent.post("/api/admin/collections").set("X-CSRF-Token", csrf).send({ name: "X" }).expect(403);
    await upload(agent, csrf).expect(403);
    await agent.put("/api/admin/settings").set("X-CSRF-Token", csrf).send({}).expect(403);
  });
});

describe("skin management", () => {
  it("uploads, optimizes to WebP + thumbnail and stores files outside the DB", async () => {
    const { agent, csrf } = await adminAgent();
    const r = await upload(agent, csrf).expect(201);
    expect(r.body.upload.optimizedUrl).toMatch(/optimized\.webp$/);
    expect(r.body.upload.thumbnailUrl).toMatch(/thumb\.webp$/);
    const file = readFileSync(`/tmp/skinflow-test-uploads/skins/${r.body.upload.id}/optimized.webp`);
    expect(file.subarray(8, 12).toString()).toBe("WEBP");
    const thumbMeta = await sharp(readFileSync(`/tmp/skinflow-test-uploads/skins/${r.body.upload.id}/thumb.webp`)).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(320);
    const cols = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'uploads' AND data_type = 'bytea'`);
    expect(cols).toHaveLength(0);
  });

  it("rejects disguised, oversized and unsupported uploads", async () => {
    const { agent, csrf } = await adminAgent();
    await upload(agent, csrf, Buffer.from("<svg onload=alert(1)>"), "image/png").expect(400);
    await upload(agent, csrf, png, "image/svg+xml").expect(400);
    await upload(agent, csrf, Buffer.alloc(5 * 1024 * 1024, 1), "image/png").expect(413);
  });

  it("creates a skin with validation, then edits, duplicates, toggles and deletes", async () => {
    const { agent, csrf } = await adminAgent();
    const up = (await upload(agent, csrf)).body.upload;

    const bad = await agent.post("/api/admin/skins").set("X-CSRF-Token", csrf).send({ name: "", weaponType: "rifle", rarity: "rare", virtualPrice: -1 }).expect(400);
    const paths = bad.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["name", "virtualPrice"]));
    const noImg = await agent.post("/api/admin/skins").set("X-CSRF-Token", csrf).send({ name: "No Image", weaponType: "rifle", rarity: "rare", virtualPrice: 10 }).expect(400);
    expect(noImg.body.error.details[0].path).toBe("uploadId");
    await agent.post("/api/admin/skins").set("X-CSRF-Token", csrf).send({ name: "Too pricey", weaponType: "rifle", rarity: "rare", virtualPrice: 1_000_000_001, uploadId: up.id }).expect(400);
    await agent.post("/api/admin/skins").set("X-CSRF-Token", csrf).send({ name: "Float", weaponType: "rifle", rarity: "rare", virtualPrice: 10.5, uploadId: up.id }).expect(400);
    await agent.post("/api/admin/skins").set("X-CSRF-Token", csrf).send({ name: "Long", weaponType: "rifle", rarity: "rare", virtualPrice: 10, uploadId: up.id, description: "x".repeat(501) }).expect(400);
    await agent.post("/api/admin/skins").set("X-CSRF-Token", csrf).send({ name: "Url inject", weaponType: "rifle", rarity: "rare", virtualPrice: 10, imageUrl: "javascript:alert(1)" }).expect(400);

    const created = await agent
      .post("/api/admin/skins")
      .set("X-CSRF-Token", csrf)
      .send({ name: "<b>Carbon</b> Pulse X", weaponType: "rifle", rarity: "epic", virtualPrice: 1000, description: "Test", newCollection: "Admin Test", uploadId: up.id, featured: true })
      .expect(201);
    const s = created.body.skin;
    expect(s.name).toBe("bCarbon/b Pulse X"); // angle brackets stripped
    expect(s.virtualPrice).toBe(1000);
    expect(s.collection).toBe("Admin Test");
    expect(s.featured).toBe(true);
    expect(s.image).toBe(up.optimizedUrl);
    expect(s.thumbnail).toBe(up.thumbnailUrl);

    const edited = await agent
      .put(`/api/admin/skins/${s.id}`)
      .set("X-CSRF-Token", csrf)
      .send({ name: "Carbon Pulse X", weaponType: "smg", rarity: "rare", virtualPrice: 1200, description: "Edited", collectionId: s.collectionId, active: true, featured: false })
      .expect(200);
    expect(edited.body.skin.weaponType).toBe("smg");
    expect(edited.body.skin.image).toBe(up.optimizedUrl); // image kept when not re-uploaded

    const dup = await agent.post(`/api/admin/skins/${s.id}/duplicate`).set("X-CSRF-Token", csrf).expect(201);
    expect(dup.body.skin.name).toBe("Carbon Pulse X (copy)");
    expect(dup.body.skin.active).toBe(false);

    const off = await agent.patch(`/api/admin/skins/${s.id}/status`).set("X-CSRF-Token", csrf).send({ active: false }).expect(200);
    expect(off.body.skin.active).toBe(false);

    await agent.delete(`/api/admin/skins/${dup.body.skin.id}`).set("X-CSRF-Token", csrf).expect(200);
    await agent.get(`/api/admin/skins/${dup.body.skin.id}`).expect(404);

    const logs = await queryOne(`SELECT count(*)::int AS n FROM admin_logs WHERE action LIKE 'skin.%'`);
    expect(logs.n).toBeGreaterThanOrEqual(5);
  });

  it("accepts prices up to 1,000,000,000 and BIGINT balances never overflow", async () => {
    const { agent, csrf } = await adminAgent();
    const up = (await upload(agent, csrf)).body.upload;
    const created = await agent
      .post("/api/admin/skins")
      .set("X-CSRF-Token", csrf)
      .send({ name: "Billion", weaponType: "knife", rarity: "legendary", virtualPrice: 1_000_000_000, uploadId: up.id })
      .expect(201);
    expect(created.body.skin.virtualPrice).toBe(1_000_000_000);
    const g = await guest();
    await query(`INSERT INTO inventory (user_id, skin_id, quantity) VALUES ($1, $2, 3)`, [g.userId, created.body.skin.id]);
    const sold = await request(app).post(`/api/inventory/${created.body.skin.id}/sell`).set(...g.auth).send({ quantity: 3 }).expect(200);
    expect(sold.body.earned).toBe(3_000_000_000);
    expect(sold.body.balance).toBeGreaterThan(3_000_000_000);
    const me = await request(app).get("/api/me").set(...g.auth).expect(200);
    expect(me.body.user.coins).toBe(sold.body.balance);
    await agent.post(`/api/admin/users/${g.userId}/coins`).set("X-CSRF-Token", csrf).send({ delta: 1_000_000_000, reason: "test limit" }).expect(200);
    await agent.post(`/api/admin/users/${g.userId}/coins`).set("X-CSRF-Token", csrf).send({ delta: 1_000_000_001, reason: "too much" }).expect(400);
    await agent.post("/api/admin/promo-codes").set("X-CSRF-Token", csrf).send({ code: "BILLION", reward: 1_000_000_000 }).expect(201);
  });

  it("upgrades legacy INTEGER coin columns to BIGINT on startup", async () => {
    await query(`ALTER TABLE users ALTER COLUMN virtual_coins TYPE INTEGER USING LEAST(virtual_coins, 2000000000)::int`);
    await query(`ALTER TABLE skins DROP CONSTRAINT skins_virtual_price_check`);
    await query(`UPDATE skins SET virtual_price = LEAST(virtual_price, 10000000)`);
    await query(`ALTER TABLE skins ADD CONSTRAINT skins_virtual_price_check CHECK (virtual_price > 0 AND virtual_price <= 10000000)`);
    const { schemaSql } = await import("../server/db/schema.js");
    await query(schemaSql);
    const col = await queryOne(`SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'virtual_coins'`);
    expect(col.data_type).toBe("bigint");
    const chk = await queryOne(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'skins_virtual_price_check'`);
    expect(chk.d).toContain("1000000000");
  });

  it("assigns skins to cases from the skin form and players see the change immediately", async () => {
    const { agent, csrf } = await adminAgent();
    const up = (await upload(agent, csrf)).body.upload;
    const cases = await query(`SELECT id FROM cases WHERE active ORDER BY id LIMIT 2`);
    const created = await agent
      .post("/api/admin/skins")
      .set("X-CSRF-Token", csrf)
      .send({ name: "Linked Skin", weaponType: "rifle", rarity: "epic", virtualPrice: 4321, uploadId: up.id, caseIds: [cases[0].id, cases[1].id], featured: true })
      .expect(201);
    const id = created.body.skin.id;
    expect(created.body.skin.caseIds).toEqual([cases[0].id, cases[1].id]);
    const w = await queryOne(`SELECT weight FROM case_items WHERE case_id = $1 AND skin_id = $2`, [cases[0].id, id]);
    expect(w.weight).toBe(80); // default epic weight

    // Player sees it in the case contents and in featured skins.
    const g = await guest();
    const c = await request(app).get(`/api/cases/${cases[0].id}`).set(...g.auth).expect(200);
    expect(c.body.case.items.find((i: { id: number }) => i.id === id).virtualPrice).toBe(4321);
    const f = await request(app).get("/api/featured").set(...g.auth).expect(200);
    expect(f.body.skins.find((s: { id: number }) => s.id === id).caseId).toBe(cases[0].id);

    // Custom weight survives an edit; removing a case removes the item; price change is visible to players.
    await query(`UPDATE case_items SET weight = 7 WHERE case_id = $1 AND skin_id = $2`, [cases[0].id, id]);
    await agent
      .put(`/api/admin/skins/${id}`)
      .set("X-CSRF-Token", csrf)
      .send({ name: "Linked Skin", weaponType: "rifle", rarity: "epic", virtualPrice: 999_000_000, caseIds: [cases[0].id], active: true, featured: true })
      .expect(200);
    expect((await queryOne(`SELECT weight FROM case_items WHERE case_id = $1 AND skin_id = $2`, [cases[0].id, id])).weight).toBe(7);
    expect(await queryOne(`SELECT 1 FROM case_items WHERE case_id = $1 AND skin_id = $2`, [cases[1].id, id])).toBeNull();
    const c2 = await request(app).get(`/api/cases/${cases[0].id}`).set(...g.auth).expect(200);
    expect(c2.body.case.items.find((i: { id: number }) => i.id === id).virtualPrice).toBe(999_000_000);

    // Omitting caseIds leaves membership untouched; unknown case ids are rejected.
    await agent.put(`/api/admin/skins/${id}`).set("X-CSRF-Token", csrf).send({ name: "Linked Skin", weaponType: "rifle", rarity: "epic", virtualPrice: 5, active: true }).expect(200);
    expect(await queryOne(`SELECT 1 FROM case_items WHERE case_id = $1 AND skin_id = $2`, [cases[0].id, id])).toBeTruthy();
    await agent.put(`/api/admin/skins/${id}`).set("X-CSRF-Token", csrf).send({ name: "Linked Skin", weaponType: "rifle", rarity: "epic", virtualPrice: 5, caseIds: [999999] }).expect(400);
  });

  it("refuses to hard-delete skins that players own", async () => {
    const { agent, csrf } = await adminAgent();
    const g = await guest();
    const r = await request(app).post("/api/cases/1/open").set(...g.auth).expect(200);
    const del = await agent.delete(`/api/admin/skins/${r.body.skin.id}`).set("X-CSRF-Token", csrf).expect(409);
    expect(del.body.error.code).toBe("CONFLICT");
  });
});

describe("weapon names and promo codes", () => {
  it("renames a weapon across all skins", async () => {
    const { agent, csrf } = await adminAgent();
    const list = await agent.get("/api/admin/weapon-names").expect(200);
    const ak = list.body.rows.find((r: { name: string }) => r.name === "AK-47");
    expect(ak.skins).toBeGreaterThan(1);
    const r = await agent.put("/api/admin/weapon-names").set("X-CSRF-Token", csrf).send({ from: "AK-47", to: "AK-47 Custom" }).expect(200);
    expect(r.body.updated).toBe(ak.skins);
    expect((await queryOne(`SELECT count(*)::int AS n FROM skins WHERE weapon_name = 'AK-47 Custom'`)).n).toBe(ak.skins);
    await agent.put("/api/admin/weapon-names").set("X-CSRF-Token", csrf).send({ from: "AK-47 Custom", to: "AK-47" }).expect(200);
    await agent.put("/api/admin/weapon-names").set("X-CSRF-Token", csrf).send({ from: "Nope", to: "X" }).expect(404);
  });

  it("creates, edits and deletes promo codes with validation", async () => {
    const { agent, csrf } = await adminAgent();
    const c = await agent.post("/api/admin/promo-codes").set("X-CSRF-Token", csrf).send({ code: "summer-26", reward: 750, maxUses: 100 }).expect(201);
    expect(c.body.promo.code).toBe("SUMMER-26");
    await agent.post("/api/admin/promo-codes").set("X-CSRF-Token", csrf).send({ code: "SUMMER-26", reward: 1 }).expect(409);
    await agent.post("/api/admin/promo-codes").set("X-CSRF-Token", csrf).send({ code: "BAD", reward: -5 }).expect(400);
    const e = await agent.put(`/api/admin/promo-codes/${c.body.promo.id}`).set("X-CSRF-Token", csrf).send({ code: "SUMMER-26", reward: 900, maxUses: null, active: false }).expect(200);
    expect(e.body.promo).toMatchObject({ reward: 900, maxUses: null, active: false });
    await agent.delete(`/api/admin/promo-codes/${c.body.promo.id}`).set("X-CSRF-Token", csrf).expect(200);
    const { agent: viewer, csrf: vcsrf } = await adminAgent("viewer1", "viewer-password-1");
    await viewer.post("/api/admin/promo-codes").set("X-CSRF-Token", vcsrf).send({ code: "NOPE1", reward: 5 }).expect(403);
  });
});

describe("case management", () => {
  it("assigns skins with explicit weights and previews odds without touching players", async () => {
    const { agent, csrf } = await adminAgent();
    const created = await agent
      .post("/api/admin/cases")
      .set("X-CSRF-Token", csrf)
      .send({ name: "QA Case", description: "", image: "/assets/cases/placeholder.svg", accent: "#112233", cost: 500, featured: false, sortOrder: 9, active: true })
      .expect(201);
    const id = created.body.case.id;
    const skins = await query(`SELECT id FROM skins WHERE active ORDER BY id LIMIT 2`);
    const set = await agent
      .put(`/api/admin/cases/${id}/items`)
      .set("X-CSRF-Token", csrf)
      .send({ items: [{ skinId: skins[0].id, weight: 3 }, { skinId: skins[1].id, weight: 1 }] })
      .expect(200);
    expect(set.body.case.items.map((i: { probability: number }) => i.probability).sort()).toEqual([0.25, 0.75]);
    await agent.put(`/api/admin/cases/${id}/items`).set("X-CSRF-Token", csrf).send({ items: [{ skinId: skins[0].id, weight: 0 }] }).expect(400);
    const openingsBefore = await queryOne(`SELECT count(*)::int AS n FROM openings`);
    const prev = await agent.post(`/api/admin/cases/${id}/preview`).set("X-CSRF-Token", csrf).send({ count: 4000 }).expect(200);
    const heavy = prev.body.results.find((x: { expected: number }) => x.expected === 0.75);
    expect(heavy.observed).toBeGreaterThan(0.7);
    expect((await queryOne(`SELECT count(*)::int AS n FROM openings`)).n).toBe(openingsBefore.n);
    await agent.delete(`/api/admin/cases/${id}`).set("X-CSRF-Token", csrf).expect(200);
    expect((await queryOne(`SELECT active FROM cases WHERE id = $1`, [id])).active).toBe(false);
  });

  it("reports system status without leaking secrets", async () => {
    const { agent } = await adminAgent();
    const r = await agent.get("/api/admin/system").expect(200);
    expect(r.body.db.ok).toBe(true);
    expect(r.body.imageLib.ok).toBe(true);
    expect(r.body.env.SESSION_SECRET).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain(process.env.SESSION_SECRET!);
    expect(JSON.stringify(r.body)).not.toContain(process.env.TELEGRAM_BOT_TOKEN!);
  });

  it("media proxy only serves safe skin keys", async () => {
    await request(app).get("/api/media/..%2F..%2Fetc%2Fpasswd").expect(404);
    await request(app).get("/api/media/other/x.png").expect(404);
  });

  it("dashboard, users, openings, logs and settings work for owners", async () => {
    const { agent, csrf } = await adminAgent();
    const d = await agent.get("/api/admin/dashboard").expect(200);
    expect(d.body.totals.total_users).toBeGreaterThan(0);
    expect(d.body.usersPerDay).toHaveLength(14);
    await agent.get("/api/admin/users?q=Guest").expect(200);
    await agent.get("/api/admin/openings").expect(200);
    await agent.get("/api/admin/logs").expect(200);
    const s = (await agent.get("/api/admin/settings")).body.settings;
    const saved = await agent.put("/api/admin/settings").set("X-CSRF-Token", csrf).send({ ...s, daily_reward_amount: 300 }).expect(200);
    expect(saved.body.settings.daily_reward_amount).toBe(300);
    await agent.put("/api/admin/settings").set("X-CSRF-Token", csrf).send({ ...s, daily_reward_amount: -5 }).expect(400);
  });
});
