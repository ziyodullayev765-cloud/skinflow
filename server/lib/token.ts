import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

/** Minimal HS256 JWT implementation (no external dependency). */
const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export interface UserTokenPayload {
  sub: number;
  typ: "user";
  iat: number;
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", config.sessionSecret).update(data).digest("base64url");
}

export function signUserToken(userId: number, ttl = config.userTokenTtlSeconds): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub: userId, typ: "user", iat: now, exp: now + ttl } satisfies UserTokenPayload));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = Buffer.from(sign(`${header}.${payload}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const h = JSON.parse(Buffer.from(header, "base64url").toString());
    if (h.alg !== "HS256") return null;
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as UserTokenPayload;
    if (p.typ !== "user" || !Number.isInteger(p.sub)) return null;
    if (typeof p.exp !== "number" || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}
