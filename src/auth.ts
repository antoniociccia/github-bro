import { type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { getUserCount, getConfig, setConfig } from "./db.js";

export function getJwtSecret(): string {
  // Prefer APP_SECRET env var (also shared with worker)
  if (process.env.APP_SECRET) return process.env.APP_SECRET;

  // Otherwise use an auto-generated secret stored in DB
  const config = getConfig();
  if (config.jwt_secret) return config.jwt_secret;

  const secret = crypto.randomBytes(32).toString("hex");
  setConfig("jwt_secret", secret);
  return secret;
}

export function signToken(expiresInSeconds: number = 7 * 24 * 3600): string {
  return jwt.sign({ role: "user" }, getJwtSecret(), { expiresIn: expiresInSeconds });
}

export function isAuthEnabled(): boolean {
  return getUserCount() > 0;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthEnabled()) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    jwt.verify(header.slice(7), getJwtSecret());
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
