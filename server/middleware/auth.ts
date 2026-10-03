import type { NextFunction, Request, Response } from "express";
import { queryOne } from "../db/pool.js";
import { ApiError } from "../lib/errors.js";
import { verifyUserToken } from "../lib/token.js";
import { getSettings } from "../services/settings.js";

export interface AuthedUser {
  id: number;
  blocked: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
      admin?: { id: number; username: string; role: "owner" | "admin" | "viewer"; csrf: string; sessionId: string };
    }
  }
}

export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new ApiError("UNAUTHORIZED", "Sign in required");
  const payload = verifyUserToken(token);
  if (!payload) throw new ApiError("INVALID_SESSION", "Your session has expired. Please reopen the app.");
  const user = await queryOne<{ id: number; blocked: boolean }>("SELECT id, blocked FROM users WHERE id = $1", [payload.sub]);
  if (!user) throw new ApiError("INVALID_SESSION", "Account not found. Please reopen the app.");
  if (user.blocked) throw new ApiError("BLOCKED", "This account has been suspended.");
  req.user = user;
  next();
}

export async function blockDuringMaintenance(_req: Request, _res: Response, next: NextFunction) {
  const s = await getSettings();
  if (s.maintenance_mode) throw new ApiError("MAINTENANCE", "SkinFlow is under maintenance. Please check back soon.");
  next();
}
