import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { queryOne } from "../server/db/pool.js";
import { app, guest, resetDb, setSetting } from "./helpers.js";

beforeAll(async () => {
  await resetDb();
  await setSetting("open_cooldown_seconds", 0);
});

describe("missions", () => {
  it("lists missions with progress", async () => {
    const g = await guest();
    const r = await request(app).get("/api/missions").set(...g.auth).expect(200);
    expect(r.body.missions.length).toBeGreaterThanOrEqual(5);
    const streak = r.body.missions.find((m: { type: string }) => m.type === "login_streak");
    expect(streak.progress).toBe(1);
  });

  it("refuses to pay before completion, pays once after, and only in virtual coins", async () => {
    const g = await guest();
    const m = await queryOne(`SELECT id, reward FROM missions WHERE code = 'daily-open-1'`);
    expect((await request(app).post(`/api/missions/${m.id}/claim`).set(...g.auth).expect(409)).body.error.code).toBe("NOT_COMPLETED");
    const open = await request(app).post("/api/cases/1/open").set(...g.auth).expect(200);
    const claim = await request(app).post(`/api/missions/${m.id}/claim`).set(...g.auth).expect(200);
    expect(claim.body.balance).toBe(open.body.balance + m.reward);
    expect((await request(app).post(`/api/missions/${m.id}/claim`).set(...g.auth).expect(409)).body.error.code).toBe("ALREADY_CLAIMED");
  });

  it("daily reward completes its mission", async () => {
    const g = await guest();
    await request(app).post("/api/daily-reward").set(...g.auth).expect(200);
    const r = await request(app).get("/api/missions").set(...g.auth);
    expect(r.body.missions.find((m: { type: string }) => m.type === "claim_daily").completed).toBe(true);
  });

  it("ignores inactive missions", async () => {
    const g = await guest();
    await request(app).post("/api/missions/99999/claim").set(...g.auth).expect(404);
  });
});
