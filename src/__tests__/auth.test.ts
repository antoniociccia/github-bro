import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { getJwtSecret, signToken, isAuthEnabled, requireAuth } from "../auth.js";
import { createUser, _db } from "../db.js";

function resetDb() {
  _db.exec("DELETE FROM users");
  _db.exec("DELETE FROM config");
}

describe("getJwtSecret", () => {
  beforeEach(() => {
    resetDb();
    delete process.env.APP_SECRET;
  });

  it("uses APP_SECRET env var when set", () => {
    process.env.APP_SECRET = "my-app-secret";
    expect(getJwtSecret()).toBe("my-app-secret");
    delete process.env.APP_SECRET;
  });

  it("auto-generates and persists secret in DB", () => {
    const secret = getJwtSecret();
    expect(secret).toHaveLength(64); // 32 bytes hex
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    // Verify it was stored in the config table
    const row = _db.prepare("SELECT value FROM config WHERE key = 'jwt_secret'").get() as any;
    expect(row.value).toBe(secret);
  });
});

describe("signToken + verify", () => {
  beforeEach(() => {
    resetDb();
    process.env.APP_SECRET = "test-secret-key";
  });

  it("signs a valid JWT that can be verified", () => {
    const token = signToken();
    const decoded = jwt.verify(token, "test-secret-key") as jwt.JwtPayload;
    expect(decoded.role).toBe("user");
  });

  it("respects custom expiry", () => {
    const token = signToken(1);
    const decoded = jwt.verify(token, "test-secret-key") as jwt.JwtPayload;
    expect(decoded.exp! - decoded.iat!).toBe(1);
  });

  afterAll(() => { delete process.env.APP_SECRET; });
});

describe("isAuthEnabled", () => {
  beforeEach(resetDb);

  it("returns false when no users exist", () => {
    expect(isAuthEnabled()).toBe(false);
  });

  it("returns true when users exist", () => {
    createUser("test@test.com", "hash");
    expect(isAuthEnabled()).toBe(true);
  });
});

describe("requireAuth middleware", () => {
  beforeEach(() => {
    resetDb();
    process.env.APP_SECRET = "test-secret";
  });

  function mockReqResNext(authHeader?: string) {
    const req = { headers: { authorization: authHeader } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    const next = vi.fn();
    return { req, res, next };
  }

  it("skips auth when no users exist", () => {
    const { req, res, next } = mockReqResNext();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("rejects requests without Authorization header", () => {
    createUser("a@b.com", "h");
    const { req, res, next } = mockReqResNext();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens", () => {
    createUser("a@b.com", "h");
    const { req, res, next } = mockReqResNext("Bearer bad-token");
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("passes valid tokens", () => {
    createUser("a@b.com", "h");
    const token = signToken();
    const { req, res, next } = mockReqResNext(`Bearer ${token}`);
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("rejects tokens signed with different secret", () => {
    createUser("a@b.com", "h");
    const token = jwt.sign({ role: "user" }, "wrong-secret", { expiresIn: 3600 });
    const { req, res, next } = mockReqResNext(`Bearer ${token}`);
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  afterAll(() => { delete process.env.APP_SECRET; });
});
