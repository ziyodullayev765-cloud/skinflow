import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../server/config.js";
import { hitRateLimit } from "../server/lib/rateLimit.js";
import { app, resetDb } from "./helpers.js";

beforeAll(async () => {
  await resetDb();
  config.rateLimitsEnabled = true;
});
afterAll(() => {
  config.rateLimitsEnabled = false;
});

describe("rate limiting", () => {
  it("counts hits inside a window and resets afterwards", async () => {
    for (let i = 1; i <= 3; i++) expect((await hitRateLimit("unit:test", 3, 60)).allowed).toBe(true);
    const blocked = await hitRateLimit("unit:test", 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    const fresh = await hitRateLimit("unit:short", 1, 1);
    expect(fresh.allowed).toBe(true);
    await new Promise((r) => setTimeout(r, 1100));
    expect((await hitRateLimit("unit:short", 1, 1)).allowed).toBe(true);
  });

  it("locks out admin brute force after 5 attempts per username", async () => {
    for (let i = 0; i < 5; i++) await request(app).post("/api/admin/login").send({ username: "owner", password: "wrong" }).expect(401);
    const r = await request(app).post("/api/admin/login").send({ username: "owner", password: "owner-password-123" }).expect(429);
    expect(r.body.error.code).toBe("RATE_LIMITED");
    expect(r.headers["retry-after"]).toBeTruthy();
  });

  it("limits guest account creation per IP", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await request(app).post("/api/auth/guest")).status;
    expect(last).toBe(429);
  });
});
