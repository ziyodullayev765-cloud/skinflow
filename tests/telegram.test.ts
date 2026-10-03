import { describe, expect, it } from "vitest";
import { signInitData, validateInitData } from "../server/lib/telegram.js";

const TOKEN = "123456:ABC-test-token";
const now = Math.floor(Date.now() / 1000);
const user = { id: 42, first_name: "Ann", username: "ann" };
const make = (fields: Record<string, string>, token = TOKEN) => signInitData(fields, token);

describe("Telegram initData validation", () => {
  it("accepts correctly signed, fresh data", () => {
    const r = validateInitData(make({ auth_date: String(now), user: JSON.stringify(user) }), TOKEN);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.id).toBe(42);
  });

  it("rejects tampered fields", () => {
    const data = make({ auth_date: String(now), user: JSON.stringify(user) }).replace("ann", "eve");
    expect(validateInitData(data, TOKEN)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects data signed with another bot token", () => {
    const data = make({ auth_date: String(now), user: JSON.stringify(user) }, "999:other");
    expect(validateInitData(data, TOKEN).ok).toBe(false);
  });

  it("rejects expired data", () => {
    const data = make({ auth_date: String(now - 100_000), user: JSON.stringify(user) });
    expect(validateInitData(data, TOKEN, 86400)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects missing hash, missing user and empty input", () => {
    expect(validateInitData("auth_date=1&user=%7B%7D", TOKEN)).toEqual({ ok: false, reason: "malformed" });
    expect(validateInitData(make({ auth_date: String(now) }), TOKEN)).toEqual({ ok: false, reason: "no_user" });
    expect(validateInitData("", TOKEN)).toEqual({ ok: false, reason: "missing" });
  });

  it("refuses to validate without a configured bot token", () => {
    expect(validateInitData("x", "")).toEqual({ ok: false, reason: "no_token" });
  });
});

import { normalizeConnectionString } from "../server/db/pool.js";
describe("database URL normalisation", () => {
  it("makes Neon's sslmode explicit without touching other params", () => {
    expect(normalizeConnectionString("postgres://u:p@h/db?sslmode=require&channel_binding=require")).toBe("postgres://u:p@h/db?sslmode=verify-full&channel_binding=require");
    expect(normalizeConnectionString("postgres://u:p@h/db?channel_binding=require&sslmode=prefer")).toBe("postgres://u:p@h/db?channel_binding=require&sslmode=verify-full");
    expect(normalizeConnectionString("postgres://u:p@localhost/db")).toBe("postgres://u:p@localhost/db");
  });
});
