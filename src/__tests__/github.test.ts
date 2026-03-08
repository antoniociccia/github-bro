import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

// Test the event validation logic from github.ts
const ALLOWED_EVENTS = ["COMMENT", "REQUEST_CHANGES"] as const;
type ReviewEvent = (typeof ALLOWED_EVENTS)[number];

function sanitizeEvent(event: string): ReviewEvent {
  return ALLOWED_EVENTS.includes(event as ReviewEvent)
    ? (event as ReviewEvent)
    : "COMMENT";
}

describe("event validation", () => {
  it("allows COMMENT", () => {
    expect(sanitizeEvent("COMMENT")).toBe("COMMENT");
  });

  it("allows REQUEST_CHANGES", () => {
    expect(sanitizeEvent("REQUEST_CHANGES")).toBe("REQUEST_CHANGES");
  });

  it("defaults to COMMENT for unknown events", () => {
    expect(sanitizeEvent("APPROVE")).toBe("COMMENT");
    expect(sanitizeEvent("")).toBe("COMMENT");
    expect(sanitizeEvent("random")).toBe("COMMENT");
  });
});

describe("webhook signature verification", () => {

  function verifySignature(body: string, signature: string | undefined, secret: string | undefined): boolean {
    if (!secret) return true;
    if (!signature) return false;

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(body);
    const expected = `sha256=${hmac.digest("hex")}`;

    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  it("passes when no secret is configured", () => {
    expect(verifySignature("{}", undefined, undefined)).toBe(true);
  });

  it("fails when secret is set but no signature provided", () => {
    expect(verifySignature("{}", undefined, "my-secret")).toBe(false);
  });

  it("passes with valid signature", () => {
    const secret = "webhook-secret";
    const body = JSON.stringify({ action: "opened" });
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(body);
    const sig = `sha256=${hmac.digest("hex")}`;

    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  it("fails with invalid signature", () => {
    expect(verifySignature("{}", "sha256=invalid", "my-secret")).toBe(false);
  });

  it("fails with wrong secret", () => {
    const body = "{}";
    const hmac = crypto.createHmac("sha256", "secret-a");
    hmac.update(body);
    const sig = `sha256=${hmac.digest("hex")}`;

    expect(verifySignature(body, sig, "secret-b")).toBe(false);
  });
});
