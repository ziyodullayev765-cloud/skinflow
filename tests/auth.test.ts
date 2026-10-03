import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { signUserToken } from "../server/lib/token.js";
import { app, resetDb, tgInitData } from "./helpers.js";

beforeAll(resetDb);

describe("Telegram authentication", () => {
  it("creates a user from valid initData and returns a session token", async () => {
    const r = await request(app)
      .post("/api/auth/telegram")
      .send({ initData: tgInitData({ id: 5001, first_name: "Aziz", username: "aziz", language_code: "uz" }) })
      .expect(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.firstName).toBe("Aziz");
    expect(r.body.user.language).toBe("uz");
    expect(r.body.user.coins).toBe(1000);
    const me = await request(app).get("/api/me").set("Authorization", `Bearer ${r.body.token}`).expect(200);
    expect(me.body.user.telegramId).toBe(5001);
  });

  it("re-login keeps the same account and balance", async () => {
    const a = await request(app).post("/api/auth/telegram").send({ initData: tgInitData({ id: 5002, first_name: "B" }) });
    const b = await request(app).post("/api/auth/telegram").send({ initData: tgInitData({ id: 5002, first_name: "B2" }) });
    expect(a.body.user.id).toBe(b.body.user.id);
    expect(b.body.user.firstName).toBe("B2");
  });

  it("rejects forged initData", async () => {
    const forged = tgInitData({ id: 1, first_name: "x" }, "000:wrong-token");
    const r = await request(app).post("/api/auth/telegram").send({ initData: forged }).expect(401);
    expect(r.body.error.code).toBe("INVALID_SESSION");
  });

  it("rejects stale initData", async () => {
    const old = tgInitData({ id: 2, first_name: "x" }, undefined, Math.floor(Date.now() / 1000) - 200000);
    await request(app).post("/api/auth/telegram").send({ initData: old }).expect(401);
  });

  it("rejects raw client-supplied user data without a signature", async () => {
    await request(app).post("/api/auth/telegram").send({ initData: `user=${encodeURIComponent('{"id":1,"first_name":"x"}')}&auth_date=1` }).expect(401);
    await request(app).post("/api/auth/telegram").send({ user: { id: 1 } }).expect(400);
  });
});

describe("session tokens", () => {
  it("requires a token", async () => {
    const r = await request(app).get("/api/me").expect(401);
    expect(r.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects tampered and unknown-user tokens", async () => {
    const t = signUserToken(1);
    const tampered = t.slice(0, -2) + (t.endsWith("a") ? "bb" : "aa");
    await request(app).get("/api/me").set("Authorization", `Bearer ${tampered}`).expect(401);
    await request(app).get("/api/me").set("Authorization", `Bearer ${signUserToken(999999)}`).expect(401);
  });

  it("rejects expired tokens", async () => {
    await request(app).get("/api/me").set("Authorization", `Bearer ${signUserToken(1, -10)}`).expect(401);
  });

  it("creates server-side guest accounts", async () => {
    const r = await request(app).post("/api/auth/guest").expect(201);
    expect(r.body.user.isGuest).toBe(true);
  });
});
